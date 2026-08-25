"""
Tests for F2: rate limiting on LearnOrbit engagement / mutation endpoints.

Before this increment ``check_rate_limit`` existed and was wired into the
inherited LearnHouse auth/AI/invite/admin routes, but *no* LearnOrbit endpoint
used it (docs/SECURITY_REVIEW.md §2.17 / §21 / §54.16 / §54.17). Comments,
follows, likes, saves, shares, reports, content creation, quiz attempts and
parent-link requests could all be repeated without any ceiling.

``enforce_learnorbit_rate_limit`` is the shared gate. These tests pin its
contract:

* a per-action ceiling that allows normal use and denies floods,
* independent per-user buckets (one user cannot burn another's quota),
* an IP-keyed bucket for anonymous callers, capped tighter,
* keys that ignore request parameters, so re-targeting the same action at a
  different org/video/comment does not reset the counter,
* window expiry via the Redis TTL,
* 429 + ``Retry-After`` + the shared ``{"code": "RATE_LIMITED", ...}``
  envelope the frontend already handles,
* fail-open (not 500) when Redis is unavailable, matching the optional-Redis
  contract in ``src/core/redis.py``.
"""
import pytest
from fastapi import HTTPException

from src.db.users import AnonymousUser, PublicUser
from src.services.security import rate_limiting
from src.tests.fixtures.fake_redis import FakeRedis


@pytest.fixture
def fake_redis(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(rate_limiting, "get_redis_connection", lambda: fake)
    monkeypatch.setitem(rate_limiting.LEARNORBIT_RATE_LIMITS, "comment_write", (3, 60))
    rate_limiting.reset_learnorbit_rate_limit_state()
    yield fake
    rate_limiting.reset_learnorbit_rate_limit_state()


def _user(user_id: int) -> PublicUser:
    return PublicUser(
        id=user_id,
        username=f"user{user_id}",
        first_name="Test",
        last_name="User",
        email=f"user{user_id}@example.com",
        user_uuid=f"user_{user_id}",
    )


def _request(ip="203.0.113.9"):
    """Minimal Request-alike accepted by ``get_client_ip``."""

    class _Client:
        host = ip

    class _Request:
        client = _Client()
        headers: dict = {}

    return _Request()


# --- ceiling -------------------------------------------------------------

def test_calls_under_the_ceiling_are_allowed(fake_redis):
    for _ in range(3):
        allowed, retry = rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=1
        )
        assert allowed is True
        assert retry > 0


def test_call_over_the_ceiling_is_denied(fake_redis):
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    allowed, retry = rate_limiting.check_learnorbit_rate_limit(
        "comment_write", user_id=1
    )
    assert allowed is False
    assert retry > 0


def test_every_configured_action_has_a_positive_ceiling_and_window():
    assert rate_limiting.LEARNORBIT_RATE_LIMITS
    for action, (max_attempts, window) in rate_limiting.LEARNORBIT_RATE_LIMITS.items():
        assert max_attempts > 0, action
        assert window > 0, action


def test_unknown_action_is_a_programming_error(fake_redis):
    with pytest.raises(ValueError):
        rate_limiting.check_learnorbit_rate_limit("not_an_action", user_id=1)


# --- isolation between principals ---------------------------------------

def test_one_user_cannot_consume_another_users_quota(fake_redis):
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    capped, _ = rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert capped is False

    fresh, _ = rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=2)
    assert fresh is True


def test_actions_have_independent_buckets(fake_redis):
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert (
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)[0] is False
    )
    # A different action for the same user is unaffected.
    assert (
        rate_limiting.check_learnorbit_rate_limit("follow_toggle", user_id=1)[0] is True
    )


# --- parameter tampering -------------------------------------------------

def test_bucket_key_ignores_request_parameters(fake_redis):
    """The limiter keys on (action, identity) only.

    If org/video/comment ids were part of the key, an attacker could reset
    their own counter just by pointing the same abusive action at a different
    target — the exact bypass F2 has to rule out.
    """
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=7)
    assert (
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=7)[0] is False
    )
    assert list(fake_redis.store) == ["rate_limit:lo:comment_write:user:7"]


# --- anonymous / IP behaviour -------------------------------------------

def test_anonymous_callers_are_keyed_by_ip(fake_redis):
    req = _request("198.51.100.4")
    rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=0, request=req)
    assert "rate_limit:lo:comment_write:ip:198.51.100.4" in fake_redis.store


def test_anonymous_ceiling_is_never_looser_than_the_user_ceiling(fake_redis, monkeypatch):
    monkeypatch.setitem(rate_limiting.LEARNORBIT_RATE_LIMITS, "comment_write", (500, 60))
    req = _request("198.51.100.5")
    allowed_count = 0
    for _ in range(rate_limiting.LEARNORBIT_ANON_MAX_ATTEMPTS + 5):
        allowed, _ = rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=0, request=req
        )
        allowed_count += int(allowed)
    assert allowed_count == rate_limiting.LEARNORBIT_ANON_MAX_ATTEMPTS


def test_separate_ips_have_independent_anonymous_buckets(fake_redis):
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=0, request=_request("198.51.100.6")
        )
    capped, _ = rate_limiting.check_learnorbit_rate_limit(
        "comment_write", user_id=0, request=_request("198.51.100.6")
    )
    assert capped is False
    fresh, _ = rate_limiting.check_learnorbit_rate_limit(
        "comment_write", user_id=0, request=_request("198.51.100.7")
    )
    assert fresh is True


def test_authenticated_bucket_is_not_shared_with_the_ip_bucket(fake_redis):
    """Two students behind one school NAT must not share a quota."""
    req = _request("198.51.100.8")
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=11, request=req
        )
    assert (
        rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=11, request=req
        )[0]
        is False
    )
    assert (
        rate_limiting.check_learnorbit_rate_limit(
            "comment_write", user_id=12, request=req
        )[0]
        is True
    )


# --- window expiry -------------------------------------------------------

def test_window_expiry_restores_the_quota(fake_redis):
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert (
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)[0] is False
    )

    fake_redis.expire_window("lo:comment_write:user:1")

    allowed, _ = rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert allowed is True


def test_counter_always_carries_a_ttl(fake_redis):
    """A counter without a TTL would block the key forever."""
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    _value, ttl = fake_redis.store["rate_limit:lo:comment_write:user:1"]
    assert ttl > 0


# --- enforce wrapper -----------------------------------------------------

def test_enforce_passes_under_the_ceiling(fake_redis):
    rate_limiting.enforce_learnorbit_rate_limit("comment_write", _user(1))


def test_enforce_raises_429_with_retry_after_and_shared_envelope(fake_redis):
    user = _user(1)
    for _ in range(3):
        rate_limiting.enforce_learnorbit_rate_limit("comment_write", user)

    with pytest.raises(HTTPException) as exc_info:
        rate_limiting.enforce_learnorbit_rate_limit("comment_write", user)

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail["code"] == "RATE_LIMITED"
    assert isinstance(detail["retry_after"], int) and detail["retry_after"] > 0
    assert int(exc_info.value.headers["Retry-After"]) > 0


def test_enforce_error_does_not_leak_internals(fake_redis):
    user = _user(1)
    with pytest.raises(HTTPException) as exc_info:
        for _ in range(4):
            rate_limiting.enforce_learnorbit_rate_limit("comment_write", user)
    message = exc_info.value.detail["message"]
    # No identity, no Redis key, no internal action name in the message.
    assert "1" not in message
    assert "redis" not in message.lower()
    assert "comment_write" not in message


def test_enforce_uses_the_ip_bucket_for_anonymous_callers(fake_redis):
    rate_limiting.enforce_learnorbit_rate_limit(
        "comment_write", AnonymousUser(), _request("198.51.100.20")
    )
    assert "rate_limit:lo:comment_write:ip:198.51.100.20" in fake_redis.store


# --- Redis unavailable ---------------------------------------------------

def test_redis_failure_fails_open_instead_of_erroring(fake_redis):
    """Engagement endpoints must not go down with Redis.

    ``src/core/redis.py`` treats Redis as optional and degrades; the same
    contract applies here. Auth endpoints keep their own stricter behaviour.
    """
    fake_redis.fail = True
    allowed, retry = rate_limiting.check_learnorbit_rate_limit(
        "comment_write", user_id=1
    )
    assert allowed is True
    assert retry > 0


def test_redis_failure_backs_off_instead_of_retrying_every_request(fake_redis, monkeypatch):
    """A dead Redis must not add a connect timeout to every request."""
    fake_redis.fail = True
    rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)

    calls = {"n": 0}

    def _boom():
        calls["n"] += 1
        raise ConnectionError("redis down")

    monkeypatch.setattr(rate_limiting, "get_redis_connection", _boom)
    rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert calls["n"] == 0


def test_reset_clears_the_backoff(fake_redis):
    fake_redis.fail = True
    rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    rate_limiting.reset_learnorbit_rate_limit_state()
    fake_redis.fail = False
    for _ in range(3):
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)
    assert (
        rate_limiting.check_learnorbit_rate_limit("comment_write", user_id=1)[0] is False
    )
