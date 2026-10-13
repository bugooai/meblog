#!/usr/bin/env python3
"""Backward-compatible entrypoint for seeding demo posts.

Historically the project used ``add_posts.py`` for test/demo data. The
maintained implementation now lives in ``seed_rich_posts.py``. Keep this file
as a stable wrapper so existing scripts/commands continue to work.
"""

from __future__ import annotations

from seed_rich_posts import main


if __name__ == "__main__":
    main()
