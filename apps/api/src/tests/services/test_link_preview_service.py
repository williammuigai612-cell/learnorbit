import logging
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import pytest
from fastapi import HTTPException

from src.services.utils import link_preview
from src.services.utils.link_preview import fetch_link_preview
from src.services.utils.ssrf_guard import SSRFBlockedError

_PEER_IP = "93.184.216.34"

_MINIMAL_PREVIEW = {
    "title": None,
    "description": None,
    "og_image": None,
    "favicon": "https://example.com/favicon.ico",
    "og_type": None,
    "og_url": "https://example.com/page",
    "url": "https://example.com/page",
}

# Captured before any patching: `link_preview` does `import httpx`, so patching
# "src.services.utils.link_preview.httpx.AsyncClient" replaces the attribute on
# the httpx module itself -- the factory below would otherwise recurse into itself.
_REAL_ASYNC_CLIENT = httpx.AsyncClient


class _Handler:
    """MockTransport handler that serves scripted outcomes and records requests.

    Each entry is either an ``httpx.Response`` to return or an exception to
    raise, consumed one per outgoing request.
    """

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.requested_urls = []
        self.request_headers = []

    def __call__(self, request):
        self.requested_urls.append(str(request.url))
        self.request_headers.append(request.headers)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _patch_client(handler):
    """Patch ``httpx.AsyncClient`` so the service talks to ``handler`` instead."""

    def _factory(**kwargs):
        return _REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handler), **kwargs)

    return patch("src.services.utils.link_preview.httpx.AsyncClient", _factory)


def _html_response(html, *, status_code=200, content_type="text/html; charset=utf-8", headers=None):
    all_headers = {"content-type": content_type}
    if headers:
        all_headers.update(headers)
    return httpx.Response(status_code, headers=all_headers, content=html.encode())


def _redirect_response(location=None, *, status_code=301):
    return httpx.Response(status_code, headers={"location": location} if location else {})


class _RaisingStream(httpx.AsyncByteStream):
    """A body that cannot be read at all."""

    async def __aiter__(self):
        raise ValueError("cannot decode body")
        yield b""  # pragma: no cover


class _FakeSoup:
    def __init__(self, *, title_text=None, links=None):
        self.title = SimpleNamespace(string=title_text) if title_text is not None else None
        self._links = links or []

    def find(self, *_args, **_kwargs):
        return None

    def find_all(self, *_args, **_kwargs):
        return self._links


@pytest.mark.asyncio
async def test_fetch_link_preview_success_with_redirect_and_relative_assets():
    redirect_url = "https://example.com/final"
    handler = _Handler(
        [
            _redirect_response(redirect_url),
            _html_response(
                "<html>"
                "<head>"
                "<title>  Example Title  </title>"
                '<meta property="og:description" content="A short description">'
                '<meta property="og:image" content="/images/preview.png">'
                '<meta property="og:type" content="article">'
                '<meta property="og:url" content="https://canonical.example/page">'
                '<link rel="shortcut icon" href="/static/favicon.ico">'
                "</head>"
                "<body>content</body>"
                "</html>"
            ),
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=[{_PEER_IP}, {_PEER_IP}],
    ) as mock_validate, patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ) as mock_peer_allowed, _patch_client(handler):
        result = await fetch_link_preview("https://example.com/start")

    assert result == {
        "title": "Example Title",
        "description": "A short description",
        "og_image": "https://example.com/images/preview.png",
        "favicon": "https://example.com/static/favicon.ico",
        "og_type": "article",
        "og_url": "https://canonical.example/page",
        "url": "https://example.com/start",
    }
    assert handler.requested_urls == ["https://example.com/start", redirect_url]
    assert mock_validate.call_args_list[0].args == ("https://example.com/start",)
    assert mock_validate.call_args_list[1].args == (redirect_url,)
    assert mock_peer_allowed.call_count == 2


@pytest.mark.asyncio
async def test_fetch_link_preview_breaks_when_redirect_has_no_next_request():
    """A 3xx with no usable Location must end the hop loop, not spin on it."""
    handler = _Handler([_redirect_response(None)])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ) as mock_peer_allowed, _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW
    assert handler.requested_urls == ["https://example.com/page"]
    mock_peer_allowed.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_link_preview_blocks_redirect_url_validation_errors():
    redirect_url = "https://example.com/blocked"
    handler = _Handler([_redirect_response(redirect_url)])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=[{_PEER_IP}, SSRFBlockedError("blocked redirect URL")],
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ) as mock_peer_allowed, _patch_client(handler):
        with pytest.raises(HTTPException) as exc_info:
            await fetch_link_preview("https://example.com/page")

    assert exc_info.value.status_code == 400
    # SECURITY: the guard reason stays server-side; the caller gets the
    # generic message only.
    assert exc_info.value.detail == link_preview._BLOCKED_URL_DETAIL
    assert "blocked redirect URL" not in exc_info.value.detail
    assert handler.requested_urls == ["https://example.com/page"]
    mock_peer_allowed.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_link_preview_uses_fallbacks_when_metadata_missing():
    handler = _Handler([_html_response("<html><head></head><body>No metadata</body></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ) as mock_peer_allowed, _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == {
        "title": None,
        "description": None,
        "og_image": None,
        "favicon": "https://example.com/favicon.ico",
        "og_type": None,
        "og_url": "https://example.com/page",
        "url": "https://example.com/page",
    }
    mock_peer_allowed.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_link_preview_blocks_invalid_url_before_request():
    handler = _Handler([_html_response("<html><head><title>Nope</title></head></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=SSRFBlockedError("Blocked hostname: localhost"),
    ), _patch_client(handler):
        with pytest.raises(HTTPException) as exc_info:
            await fetch_link_preview("http://localhost/page")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == link_preview._BLOCKED_URL_DETAIL
    assert "localhost" not in exc_info.value.detail
    # The client is opened, but the guard runs before the first hop is sent.
    assert handler.requested_urls == []


@pytest.mark.asyncio
async def test_fetch_link_preview_blocks_peer_validation_errors():
    handler = _Handler([_html_response("<html><head><title>Title</title></head></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed",
        side_effect=SSRFBlockedError("DNS rebinding detected"),
    ), _patch_client(handler):
        with pytest.raises(HTTPException) as exc_info:
            await fetch_link_preview("https://example.com/page")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == link_preview._BLOCKED_URL_DETAIL
    assert "rebinding" not in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_for_oversized_responses():
    handler = _Handler(
        [
            _html_response(
                "<html><head><title>Too big</title></head></html>",
                headers={"content-length": str(5 * 1024 * 1024 + 1)},
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == {
        "title": None,
        "description": None,
        "og_image": None,
        "favicon": "https://example.com/favicon.ico",
        "og_type": None,
        "og_url": "https://example.com/page",
        "url": "https://example.com/page",
    }


@pytest.mark.asyncio
async def test_fetch_link_preview_blocks_redirect_peer_validation_and_fallback_favicon():
    redirect_url = "https://example.com/redirected"
    handler = _Handler(
        [
            _redirect_response(redirect_url),
            _html_response("<html><head><title>Redirected</title></head></html>"),
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=[{_PEER_IP}, {_PEER_IP}],
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed",
        side_effect=[None, SSRFBlockedError("blocked redirect peer")],
    ), _patch_client(handler):
        with pytest.raises(HTTPException) as exc_info:
            await fetch_link_preview("https://example.com/page")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == link_preview._BLOCKED_URL_DETAIL
    assert "peer" not in exc_info.value.detail.lower()
    assert handler.requested_urls == ["https://example.com/page", redirect_url]


@pytest.mark.asyncio
async def test_fetch_link_preview_skips_non_tag_links_when_discovering_favicon():
    handler = _Handler(
        [_html_response("<html><head><title>Title</title></head><body></body></html>")]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler), patch(
        "src.services.utils.link_preview.BeautifulSoup",
        return_value=_FakeSoup(title_text="Title", links=[object()]),
    ):
        result = await fetch_link_preview("https://example.com/page")

    assert result["title"] == "Title"
    assert result["favicon"] == "https://example.com/favicon.ico"


@pytest.mark.asyncio
async def test_fetch_link_preview_uses_fallback_favicon_for_relative_icon():
    handler = _Handler(
        [
            _html_response(
                "<html><head>"
                "<title>Title</title>"
                '<link rel="icon" href="/favicon-alt.ico">'
                "</head></html>"
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result["favicon"] == "https://example.com/favicon-alt.ico"


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_when_upstream_returns_4xx():
    handler = _Handler(
        [_html_response("<html><body>blocked by waf</body></html>", status_code=403)]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_for_non_html_content_type():
    handler = _Handler(
        [_html_response("%PDF-1.4 not html", content_type="application/pdf")]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_when_httpx_raises():
    handler = _Handler([httpx.ConnectError("connection refused")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW
    assert handler.requested_urls == ["https://example.com/page"]


@pytest.mark.asyncio
async def test_fetch_link_preview_sends_browser_user_agent():
    handler = _Handler([_html_response("<html><head><title>OK</title></head></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        await fetch_link_preview("https://example.com/page")

    headers = handler.request_headers[0]
    assert "Mozilla/5.0" in headers["user-agent"]
    assert "html" in headers["accept"]


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_when_redirect_get_raises():
    """A network error while following a redirect must fall back to a minimal
    preview rather than propagating (covers the redirect-hop httpx.HTTPError)."""
    redirect_url = "https://example.com/redirected"
    handler = _Handler(
        [
            _redirect_response(redirect_url),
            httpx.HTTPError("redirect hop failed"),
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=[{_PEER_IP}, {_PEER_IP}],
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW
    assert handler.requested_urls == ["https://example.com/page", redirect_url]


@pytest.mark.asyncio
async def test_fetch_link_preview_ignores_non_integer_content_length():
    """A non-integer Content-Length must be ignored (ValueError swallowed) and
    parsing must continue normally."""
    handler = _Handler(
        [
            _html_response(
                "<html><head><title>Parsed OK</title></head></html>",
                headers={"content-length": "not-a-number"},
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result["title"] == "Parsed OK"


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_when_body_decode_raises():
    """If reading the response body raises, fall back to a minimal preview."""
    handler = _Handler(
        [
            httpx.Response(
                200, headers={"content-type": "text/html"}, stream=_RaisingStream()
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW


@pytest.mark.asyncio
async def test_fetch_link_preview_falls_back_when_soup_parse_raises():
    """A BeautifulSoup parse failure must fall back to a minimal preview."""
    handler = _Handler([_html_response("<html><head><title>Title</title></head></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler), patch(
        "src.services.utils.link_preview.BeautifulSoup",
        side_effect=ValueError("broken parser"),
    ):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW


@pytest.mark.asyncio
async def test_fetch_link_preview_prefers_twitter_card_when_og_missing():
    handler = _Handler(
        [
            _html_response(
                "<html><head>"
                "<title>Fallback Title</title>"
                '<meta name="twitter:title" content="Twitter Title">'
                '<meta name="twitter:description" content="From twitter card">'
                '<meta name="twitter:image" content="https://cdn.example.com/tw.png">'
                "</head></html>"
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result["title"] == "Twitter Title"
    assert result["description"] == "From twitter card"
    assert result["og_image"] == "https://cdn.example.com/tw.png"


@pytest.mark.asyncio
async def test_fetch_link_preview_decodes_with_utf8_when_charset_is_unknown():
    """A charset Python has no codec for must not lose the preview: the read
    falls back to utf-8 instead of raising LookupError out of the fetch."""
    handler = _Handler(
        [
            _html_response(
                "<html><head><title>Café</title></head></html>",
                content_type="text/html; charset=totally-not-a-charset",
            )
        ]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result["title"] == "Café"


@pytest.mark.asyncio
async def test_fetch_link_preview_stops_after_the_redirect_budget():
    """An endless redirect chain is abandoned at _MAX_REDIRECTS hops and answers
    a minimal preview, rather than being followed forever."""
    hops = link_preview._MAX_REDIRECTS + 1
    handler = _Handler(
        [_redirect_response(f"https://example.com/hop{i}") for i in range(hops)]
    )

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        return_value={_PEER_IP},
    ), patch(
        "src.services.utils.link_preview.assert_connected_peer_allowed"
    ), _patch_client(handler):
        result = await fetch_link_preview("https://example.com/page")

    assert result == _MINIMAL_PREVIEW
    assert len(handler.requested_urls) == hops


# ── SSRF detail must never reach the client ──────────────────────────────
# SECURITY_REVIEW.md §19 / §54.15. The guard's exception text names the
# internal detail that caused the block — the private address a hostname
# resolved to, the peer set a rebinding attempt was measured against. It used
# to be returned verbatim as the 400's `detail`, which made this endpoint an
# internal-network oracle: aim it at a host and read the topology out of the
# error. These tests assert on the *absence* of that data, so they fail if
# anyone reinstates `detail=str(exc)`.

# Verbatim messages from ssrf_guard.py, carrying exactly the internal facts
# that must not escape.
_LEAKY_RESOLVE_MESSAGE = (
    "URL http://internal.example.com/ resolves to blocked address range (10.1.2.3)"
)
_LEAKY_PEER_MESSAGE = (
    "DNS rebinding detected: connected to 192.168.7.7, "
    "validated addresses were ['93.184.216.34']"
)

# Every internal token that appears in the two messages above.
_INTERNAL_TOKENS = [
    "10.1.2.3",
    "192.168.7.7",
    "93.184.216.34",
    "blocked address range",
    "rebinding",
    "validated addresses",
    "internal.example.com",
]


def _assert_no_internal_detail(detail):
    assert detail == link_preview._BLOCKED_URL_DETAIL
    lowered = str(detail).lower()
    for token in _INTERNAL_TOKENS:
        assert token.lower() not in lowered, f"leaked {token!r} to the client"


@pytest.mark.asyncio
async def test_resolve_block_does_not_leak_internal_address_to_client(caplog):
    """A hostname resolving into a private range must not tell the caller
    *which* private address it was — while the server log still records it."""
    handler = _Handler([_html_response("<html><head><title>Nope</title></head></html>")])

    with caplog.at_level(logging.WARNING, logger="src.services.utils.link_preview"):
        with patch(
            "src.services.utils.link_preview.resolve_and_validate_url",
            side_effect=SSRFBlockedError(_LEAKY_RESOLVE_MESSAGE),
        ), _patch_client(handler):
            with pytest.raises(HTTPException) as exc_info:
                await fetch_link_preview("http://internal.example.com/")

    assert exc_info.value.status_code == 400
    _assert_no_internal_detail(exc_info.value.detail)
    # Diagnostics preserved server-side.
    assert _LEAKY_RESOLVE_MESSAGE in caplog.text


@pytest.mark.asyncio
async def test_peer_block_does_not_leak_validated_address_set_to_client(caplog):
    """Rebinding detection must not hand back the peer it connected to, nor
    the validated set it was compared against."""
    handler = _Handler([_html_response("<html><head><title>Nope</title></head></html>")])

    with caplog.at_level(logging.WARNING, logger="src.services.utils.link_preview"):
        with patch(
            "src.services.utils.link_preview.resolve_and_validate_url",
            return_value={_PEER_IP},
        ), patch(
            "src.services.utils.link_preview.assert_connected_peer_allowed",
            side_effect=SSRFBlockedError(_LEAKY_PEER_MESSAGE),
        ), _patch_client(handler):
            with pytest.raises(HTTPException) as exc_info:
                await fetch_link_preview("https://example.com/page")

    assert exc_info.value.status_code == 400
    _assert_no_internal_detail(exc_info.value.detail)
    assert _LEAKY_PEER_MESSAGE in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "guard_message",
    [
        "URL scheme not allowed: 'file'",
        "Blocked hostname: metadata.google.internal",
        "URL http://x/ resolves to blocked address range (169.254.169.254)",
        "DNS rebinding detected: connected to 127.0.0.1, validated addresses were ['8.8.8.8']",
    ],
)
async def test_every_block_reason_returns_the_same_indistinguishable_message(guard_message):
    """The four block reasons must be indistinguishable from each other. A
    per-reason message would leak the same topology, just more slowly — an
    attacker could still tell "blocked because private range" from "blocked
    because bad scheme" and walk the network that way."""
    handler = _Handler([_html_response("<html><head><title>Nope</title></head></html>")])

    with patch(
        "src.services.utils.link_preview.resolve_and_validate_url",
        side_effect=SSRFBlockedError(guard_message),
    ), _patch_client(handler):
        with pytest.raises(HTTPException) as exc_info:
            await fetch_link_preview("http://example.com/page")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == link_preview._BLOCKED_URL_DETAIL


def test_blocked_url_detail_carries_no_network_vocabulary():
    """Guards the constant itself: the generic message must stay generic if
    someone later makes it more 'helpful'."""
    lowered = link_preview._BLOCKED_URL_DETAIL.lower()
    for token in ("ip", "address", "resolve", "dns", "private", "internal", "localhost", "peer"):
        assert token not in lowered
