import TagClient from './TagClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PostListResponse } from '@/types';
import { fetchFromServerApi } from '@/app/lib/server-api';

export const revalidate = 180;
export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

interface TagPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

function formatTagName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function getTagPosts(slug: string, page: number): Promise<PostListResponse> {
  return fetchFromServerApi<PostListResponse>(
    `/posts?tag=${encodeURIComponent(slug)}&page=${page}&size=5`,
    { revalidate }
  );
}

function assertValidPage(page: number): void {
  if (!Number.isInteger(page) || page < 1) {
    notFound();
  }
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tagName = formatTagName(slug);

  return {
    title: `${tagName} - 标签文章`,
    description: `浏览 ${tagName} 标签下的最新文章`,
    alternates: { canonical: `/tag/${slug}` },
  };
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = parseInt(pageStr || '1', 10);
  assertValidPage(page);
  let initialData: PostListResponse = { items: [], total: 0, page, size: 5, pages: 1 };
  let loadFailed = false;

  try {
    initialData = await getTagPosts(slug, page);
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-semibold text-[var(--color-foreground)] mb-2">标签文章加载失败</h2>
        <p className="text-[var(--color-foreground-secondary)]">请稍后刷新页面重试。</p>
      </div>
    );
  }

  return <TagClient initialTagSlug={slug} initialData={initialData} initialPage={page} />;
}
