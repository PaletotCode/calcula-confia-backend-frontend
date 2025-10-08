from __future__ import annotations

from typing import Any, Iterable, Optional, Tuple

from fastapi import Request, Response
from fastapi_cache import FastAPICache


def _extract_user_id(kwargs: Optional[dict[str, Any]]) -> Optional[int]:
    if not kwargs:
        return None

    for key in ("current_user", "user"):
        user_obj = kwargs.get(key)
        if user_obj is not None:
            return getattr(user_obj, "id", None)

    return None


def _collect_query_items(
    request: Optional[Request], kwargs: Optional[dict[str, Any]]
) -> Tuple[Tuple[str, str], ...]:
    if request is not None:
        return tuple(
            (str(key), str(value))
            for key, value in sorted(request.query_params.multi_items())
        )

    if not kwargs:
        return tuple()

    filtered_items = []
    for key, value in kwargs.items():
        if key in {"current_user", "user", "db"}:
            continue
        filtered_items.append((str(key), str(value)))

    filtered_items.sort(key=lambda item: item[0])
    return tuple(filtered_items)


def resolve_user_namespace(namespace: Optional[str], user_id: Optional[int]) -> str:
    base_namespace = namespace or "cache"
    user_token = "anon" if user_id is None else f"user:{user_id}"
    return f"{base_namespace}:{user_token}"


def build_user_scoped_cache_key(
    namespace: str,
    path: str,
    query_items: Iterable[Tuple[str, str]],
) -> str:
    try:
        prefix = FastAPICache.get_prefix()
    except AssertionError:
        prefix = ""
    safe_path = path or "_"
    query_part = "&".join(f"{key}={value}" for key, value in query_items)

    key_prefix = f"{prefix}:" if prefix else ""
    key = f"{key_prefix}{namespace}:{safe_path}"
    if query_part:
        key = f"{key}?{query_part}"
    return key


def user_scoped_cache_key_builder(
    func: Any,
    namespace: Optional[str] = "",
    request: Optional[Request] = None,
    response: Optional[Response] = None,
    args: Optional[tuple[Any, ...]] = None,
    kwargs: Optional[dict[str, Any]] = None,
) -> str:
    kwargs = kwargs or {}
    user_id = _extract_user_id(kwargs)
    effective_namespace = resolve_user_namespace(namespace, user_id)

    path = request.url.path if request is not None else getattr(func, "__name__", "_")
    query_items = _collect_query_items(request, kwargs)

    return build_user_scoped_cache_key(effective_namespace, path, query_items)