"""App-level CSRF tests.

The 36 tests in ``test_csrf.py`` drive a bare ``CSRFProtectionMiddleware``
instance. None of them proves the middleware is actually *registered*, or how it
composes with CORS — and no other test in this suite mounts ``app.py`` (every
file builds its own bare ``FastAPI``), so registration had no coverage at all.

These mount the real middleware over a throwaway router through
``ASGITransport``, the same pattern as ``test_email_origin_and_smtp_tls.py``.

Note on the config patch: Starlette builds its middleware stack lazily, on the
first request — ``add_middleware`` only records the class. So the patch has to
stay active for the REQUEST, not just for registration, or the middleware
constructs itself against the real config and allows everything.
"""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.security.csrf import CSRFProtectionMiddleware, warn_if_origins_unscoped


ALLOWED = "https://learn.example.test"
# A different registrable domain, not a subdomain of the allowed one: the scoped
# regexp below matches *.example.test, so "evil.example.test" would legitimately
# pass and would not be testing anything.
ATTACKER = "https://evil.invalid"
CUSTOM_DOMAIN = "https://learn.acme.invalid"
SCOPED_REGEXP = r"^https://(?:[a-z0-9-]+\.)*example\.test(:\d+)?$"
CATCH_ALL_REGEXP = r"\b((?:https?://)[^\s/$.?#].[^\s]*)\b"


def _config(allowed_origins=None, allowed_regexp=SCOPED_REGEXP, development_mode=False):
    cfg = MagicMock()
    cfg.hosting_config.allowed_origins = allowed_origins or []
    cfg.hosting_config.allowed_regexp = allowed_regexp
    cfg.general_config.development_mode = development_mode
    return cfg


@contextmanager
def csrf_config(config=None):
    """Hold the config patch across registration AND the request."""
    with patch("src.security.csrf.get_learnhouse_config", return_value=config or _config()):
        yield


def _build_app(*, with_cors: bool = False) -> FastAPI:
    """A minimal app carrying the real CSRF middleware.

    Registration mirrors ``app.py``: CORS first, then CSRF — so CSRF ends up the
    OUTER middleware (Starlette's ``add_middleware`` prepends).
    """
    app = FastAPI()

    @app.get("/thing")
    async def read_thing():
        return {"ok": "read"}

    @app.post("/thing")
    async def write_thing():
        return {"ok": "write"}

    if with_cors:
        from fastapi.middleware.cors import CORSMiddleware

        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=SCOPED_REGEXP,
            allow_methods=["*"],
            allow_credentials=True,
            allow_headers=["*"],
        )
    app.add_middleware(CSRFProtectionMiddleware)
    return app


def _client(app) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class TestCSRFRegisteredOnAnApp:
    """The middleware behaves correctly when mounted, not just when instantiated."""

    @pytest.mark.asyncio
    async def test_same_origin_post_succeeds(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"Origin": ALLOWED})
        assert r.status_code == 200
        assert r.json() == {"ok": "write"}

    @pytest.mark.asyncio
    async def test_cross_origin_post_is_rejected(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"Origin": ATTACKER})
        assert r.status_code == 403
        assert "CSRF" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_post_without_origin_or_referer_is_rejected(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing")
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_referer_fallback_is_accepted(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"Referer": f"{ALLOWED}/some/page"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_get_is_unaffected(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.get("/thing")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_api_token_stays_exempt(self):
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"Authorization": "Bearer lh_abc123"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_internal_key_stays_exempt(self):
        """The collab server and the web billing plan write depend on this."""
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"x-internal-key": "shared"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_platform_key_stays_exempt(self):
        """services/billing/packs.ts depends on this."""
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post("/thing", headers={"x-platform-key": "shared"})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_plain_bearer_jwt_is_not_exempt(self):
        """Cookie fallback in get_current_user is exactly why this must not be exempt."""
        with csrf_config():
            async with _client(_build_app()) as c:
                r = await c.post(
                    "/thing", headers={"Authorization": "Bearer eyJhbGciOi.fake.jwt"}
                )
        assert r.status_code == 403


class TestCSRFCORSOrdering:
    """Starlette's add_middleware PREPENDS, so the last registered runs outermost.

    app.py registers CORS then CSRF, so CSRF wraps CORS: a rejected request is
    refused before CORS can attach its headers. That is a deliberate trade — the
    403 reads as an opaque CORS failure in the browser — and it is asserted here
    so it cannot change silently.
    """

    @pytest.mark.asyncio
    async def test_csrf_runs_outside_cors(self):
        with csrf_config():
            app = _build_app(with_cors=True)
            assert app.user_middleware[0].cls is CSRFProtectionMiddleware
            async with _client(app) as c:
                rejected = await c.post("/thing", headers={"Origin": ATTACKER})
        assert rejected.status_code == 403
        assert "access-control-allow-origin" not in rejected.headers

    @pytest.mark.asyncio
    async def test_allowed_origin_still_gets_cors_headers(self):
        with csrf_config():
            async with _client(_build_app(with_cors=True)) as c:
                r = await c.post("/thing", headers={"Origin": ALLOWED})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == ALLOWED

    @pytest.mark.asyncio
    async def test_cors_preflight_is_not_blocked(self):
        """OPTIONS is not state-changing, so CSRF must let the preflight through."""
        with csrf_config():
            async with _client(_build_app(with_cors=True)) as c:
                r = await c.options(
                    "/thing",
                    headers={
                        "Origin": ALLOWED,
                        "Access-Control-Request-Method": "POST",
                    },
                )
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == ALLOWED


class TestCSRFCustomDomainOnAnApp:
    """A verified org custom domain reaches the app on the slow path."""

    @pytest.mark.asyncio
    async def test_verified_custom_domain_post_succeeds(self):
        with csrf_config():
            app = _build_app()
            with patch.object(
                CSRFProtectionMiddleware,
                "_is_verified_custom_domain_origin",
                return_value=True,
            ):
                async with _client(app) as c:
                    r = await c.post("/thing", headers={"Origin": CUSTOM_DOMAIN})
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_unverified_custom_domain_post_is_rejected(self):
        with csrf_config():
            app = _build_app()
            with patch.object(
                CSRFProtectionMiddleware,
                "_is_verified_custom_domain_origin",
                return_value=False,
            ):
                async with _client(app) as c:
                    r = await c.post("/thing", headers={"Origin": CUSTOM_DOMAIN})
        assert r.status_code == 403


class TestProductionCatchAllGuard:
    """The shipped allowed_regexp matches any origin, which makes CSRF inert.

    Registering against it protects nothing, and does so silently. The guard logs
    CRITICAL rather than refusing to start: an existing deployment that inherited
    the catch-all must not be bricked by an upgrade.

    It is a module-level function called from app.py rather than work done in
    ``__init__``, because Starlette builds the middleware stack lazily — a check
    inside ``__init__`` would first run on the first request, not at startup.
    """

    def _run(self, config, caplog):
        with caplog.at_level("CRITICAL", logger="src.security.csrf"):
            unsafe = warn_if_origins_unscoped(config)
        return unsafe, [r for r in caplog.records if r.levelname == "CRITICAL"]

    def test_catch_all_in_production_logs_critical(self, caplog):
        unsafe, criticals = self._run(
            _config(allowed_regexp=CATCH_ALL_REGEXP, development_mode=False), caplog
        )
        assert unsafe is True
        assert criticals, "a catch-all regexp in production must be reported"
        assert "LEARNHOUSE_ALLOWED_REGEXP" in criticals[0].getMessage()

    def test_scoped_regexp_in_production_is_silent(self, caplog):
        unsafe, criticals = self._run(
            _config(allowed_regexp=SCOPED_REGEXP, development_mode=False), caplog
        )
        assert unsafe is False
        assert not criticals

    def test_development_mode_is_not_warned(self, caplog):
        """Local dev legitimately runs the shipped default."""
        unsafe, criticals = self._run(
            _config(allowed_regexp=CATCH_ALL_REGEXP, development_mode=True), caplog
        )
        assert unsafe is False
        assert not criticals

    def test_explicit_allowed_origins_still_warns_on_catch_all_regexp(self, caplog):
        """A scoped list does not undo an unscoped regexp — either one admits an origin."""
        unsafe, criticals = self._run(
            _config(allowed_origins=[ALLOWED], allowed_regexp=CATCH_ALL_REGEXP), caplog
        )
        assert unsafe is True
        assert criticals

    def test_empty_regexp_with_a_scoped_list_is_fine(self, caplog):
        """No regexp at all is not a catch-all; the explicit list is the allowlist."""
        unsafe, criticals = self._run(
            _config(allowed_origins=[ALLOWED], allowed_regexp=""), caplog
        )
        assert unsafe is False
        assert not criticals

    def test_reuses_the_email_scoped_regexp_helper(self):
        """Not a second implementation of 'is this pattern a catch-all'."""
        with patch(
            "src.services.email.utils._is_scoped_origin_regexp", return_value=False
        ) as helper:
            warn_if_origins_unscoped(_config(allowed_regexp=SCOPED_REGEXP))
        helper.assert_called_once_with(SCOPED_REGEXP)


class TestAppRegistrationContract:
    """app.py must register the middleware, in the documented position."""

    def _app_source(self) -> str:
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[3]
        return (root / "app.py").read_text(encoding="utf-8")

    def test_app_registers_the_csrf_middleware(self):
        src = self._app_source()
        assert "app.add_middleware(CSRFProtectionMiddleware)" in src

    def test_registered_after_cors_and_before_ee_hooks(self):
        src = self._app_source()
        cors = src.index("configure_cors(app)")
        csrf = src.index("app.add_middleware(CSRFProtectionMiddleware)")
        ee = src.index("register_ee_middlewares(app)")
        assert cors < csrf < ee

    def test_registration_is_unconditional(self):
        """Registering in app.py rather than via the EE hook means CSRF applies
        under LEARNHOUSE_SAAS=true too, where register_ee_middlewares returns
        early. Guard against it being nested behind a mode check."""
        src = self._app_source()
        line = next(
            ln for ln in src.splitlines()
            if "app.add_middleware(CSRFProtectionMiddleware)" in ln
        )
        assert not line.startswith(" "), "must not be nested under a conditional"

    def test_startup_runs_the_unscoped_origins_guard(self):
        src = self._app_source()
        assert "warn_if_origins_unscoped()" in src
