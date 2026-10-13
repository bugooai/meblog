import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

interface RevalidatePayload {
  secret?: string;
  postSlug?: string | null;
  projectSlug?: string | null;
  tagSlugs?: string[] | null;
}

function normalizeSlug(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTagSlugs(value?: string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((tag) => normalizeSlug(tag))
    .filter((tag): tag is string => Boolean(tag));
}

function buildPaths(payload: RevalidatePayload): string[] {
  const paths = new Set<string>(['/', '/archive', '/projects', '/tags', '/sitemap.xml', '/feed.xml']);

  const postSlug = normalizeSlug(payload.postSlug);
  if (postSlug) {
    paths.add(`/post/${postSlug}`);
  }

  const projectSlug = normalizeSlug(payload.projectSlug);
  if (projectSlug) {
    paths.add(`/project/${projectSlug}`);
  }

  for (const tagSlug of normalizeTagSlugs(payload.tagSlugs)) {
    paths.add(`/tag/${tagSlug}`);
  }

  return Array.from(paths);
}

function isAuthorized(request: NextRequest, payload: RevalidatePayload): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return false;
  }

  const headerSecret = request.headers.get('x-revalidate-secret');
  return headerSecret === expected || payload.secret === expected;
}

export async function POST(request: NextRequest) {
  let payload: RevalidatePayload = {};

  try {
    payload = (await request.json()) as RevalidatePayload;
  } catch {
    // Keep empty payload; authorization can still come from headers.
  }

  if (!isAuthorized(request, payload)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const paths = buildPaths(payload);
  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    ok: true,
    revalidated: paths,
    timestamp: new Date().toISOString(),
  });
}
