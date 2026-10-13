"""Helpers for notifying frontend to invalidate cached pages."""

from __future__ import annotations

import asyncio
import json
from urllib import error, request

from configs import settings
from app.utils.logger import logger


def _post_revalidate(url: str, token: str, payload: dict) -> int:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-revalidate-secret": token,
        },
        method="POST",
    )
    with request.urlopen(req, timeout=5) as resp:
        return int(resp.status)


async def notify_frontend_revalidate(
    *,
    post_slug: str | None = None,
    project_slug: str | None = None,
    tag_slugs: list[str] | None = None,
) -> None:
    endpoint = getattr(settings, "FRONTEND_REVALIDATE_URL", "").strip()
    token = getattr(settings, "FRONTEND_REVALIDATE_TOKEN", "").strip()

    if not endpoint or not token:
        return

    payload = {
        "postSlug": post_slug,
        "projectSlug": project_slug,
        "tagSlugs": tag_slugs or [],
    }

    try:
        status = await asyncio.to_thread(_post_revalidate, endpoint, token, payload)
        if status >= 400:
            logger.warning(f"Frontend revalidate returned status {status} for payload {payload}")
    except error.HTTPError as exc:
        logger.warning(f"Frontend revalidate HTTP error {exc.code}: {exc.reason}")
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(f"Failed to notify frontend revalidate: {exc}")
