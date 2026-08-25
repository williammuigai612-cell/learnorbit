"""In-memory stand-in for the Redis commands the rate limiter uses.

Shared by the F2 rate-limit tests and by the autouse isolation fixture in
``src/tests/conftest.py``, so the suite behaves the same whether or not a real
Redis happens to be running on the developer's machine.
"""


class FakeRedis:
    """Covers exactly the commands ``check_rate_limit`` calls."""

    def __init__(self):
        self.store: dict[str, list] = {}  # key -> [value, ttl]
        self.fail = False

    def _maybe_fail(self):
        if self.fail:
            raise ConnectionError("redis down")

    def get(self, key):
        self._maybe_fail()
        entry = self.store.get(key)
        return entry[0] if entry else None

    def setex(self, key, ttl, value):
        self._maybe_fail()
        self.store[key] = [int(value), ttl]

    def incr(self, key):
        self._maybe_fail()
        entry = self.store.setdefault(key, [0, -1])
        entry[0] += 1
        return entry[0]

    def expire(self, key, ttl):
        self._maybe_fail()
        entry = self.store.get(key)
        if entry:
            entry[1] = ttl

    def ttl(self, key):
        self._maybe_fail()
        entry = self.store.get(key)
        return entry[1] if entry else -2

    def expire_window(self, key):
        """Simulate the rate-limit window elapsing for ``key``."""
        self.store.pop("rate_limit:" + key, None)
