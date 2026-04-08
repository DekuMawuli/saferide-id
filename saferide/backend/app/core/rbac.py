"""Role-based home routes and OAuth `next` validation."""

from __future__ import annotations

# Roles persisted on Operator (lowercase).
OPERATOR_ROLES: frozenset[str] = frozenset(
    {"passenger", "driver", "officer", "admin", "monitor", "support", "system_admin"}
)
DEFAULT_ROLE = "driver"

# Relative paths on the frontend app (must match Next.js routes).
ROLE_HOME_PATH: dict[str, str] = {
    "passenger": "/rider/status",
    "driver": "/driver/profile",
    "officer": "/portal",
    "admin": "/admin",
    "monitor": "/admin",
    "support": "/portal",
    "system_admin": "/admin",
}


def normalize_operator_role(role: str | None) -> str:
    if not role:
        return DEFAULT_ROLE
    r = role.strip().lower()
    return r if r in OPERATOR_ROLES else DEFAULT_ROLE


def home_path_for_role(role: str) -> str:
    r = normalize_operator_role(role)
    return ROLE_HOME_PATH.get(r, ROLE_HOME_PATH[DEFAULT_ROLE])


def parse_next_allowlist_csv(csv: str) -> frozenset[str]:
    return frozenset(p.strip() for p in csv.split(",") if p.strip())


def sanitize_next_path(path: str | None, allowlist: frozenset[str]) -> str | None:
    """Return a safe relative path if it is in the allowlist, else None."""
    if not path:
        return None
    p = path.strip()
    if not p.startswith("/") or ".." in p or "\n" in p or "\r" in p:
        return None
    if p in allowlist:
        return p
    # Allow deep links under role shells when the shell root is allowlisted.
    for base in ("/portal", "/admin", "/driver"):
        if base in allowlist and (p == base or p.startswith(f"{base}/")):
            return p
    return None


SHARED_NEXT_PATHS: frozenset[str] = frozenset(
    {
        "/",
        "/login",
        "/verify",
        "/report",
        "/how-it-works",
        "/privacy",
        "/offline",
    }
)


def next_path_allowed_for_role(path: str, role: str) -> bool:
    """Ensure `next` is not used to escalate to another role's app shell."""
    r = normalize_operator_role(role)
    if path in SHARED_NEXT_PATHS:
        return True
    if r == "passenger":
        return path in SHARED_NEXT_PATHS
    prefix_by_role = {
        "driver": "/driver",
        "officer": "/portal",
        "support": "/portal",
        "admin": "/admin",
        "monitor": "/admin",
        "system_admin": "/admin",
    }
    prefix = prefix_by_role.get(r, "")
    return path == prefix or path.startswith(f"{prefix}/")


def resolve_post_login_path(
    operator_role: str,
    next_from_oauth_cookie: str | None,
    allowlist: frozenset[str],
) -> str:
    """
    Prefer validated `next` from the login URL if it matches this operator's role; else RBAC home.
    """
    n = sanitize_next_path(next_from_oauth_cookie, allowlist)
    if n is not None and next_path_allowed_for_role(n, operator_role):
        return n
    return home_path_for_role(operator_role)
