import PostDetailClient from './PostDetailClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { PostDetail } from '@/types';
import { fetchFromServerApi, ServerApiError } from '@/app/lib/server-api';

export const revalidate = 180;
export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

interface LikeStatus {
  liked: boolean;
  like_count: number;
}

function fallbackDescription(content: string): string {
  return content.replace(/[#*`_~\[\]]/g, '').slice(0, 200);
}

async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  try {
    const encodedSlug = encodeURIComponent(slug);
    return await fetchFromServerApi<PostDetail>(
      `/posts/${encodedSlug}?include_hidden=true`,
      {
        revalidate,
      }
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function getLikeStatusBySlug(slug: string): Promise<LikeStatus | null> {
  try {
    const requestHeaders = await headers();
    const userAgent = requestHeaders.get('user-agent');

    const forwardedHeaders: Record<string, string> = {};
    if (userAgent) {
      forwardedHeaders['user-agent'] = userAgent;
    }

    return await fetchFromServerApi<LikeStatus>(`/posts/${encodeURIComponent(slug)}/like`, {
      cache: 'no-store',
      revalidate: 0,
      headers: forwardedHeaders,
      suppressErrorStatuses: [404],
    });
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) {
      return null;
    }
    return null;
  }
}

function assertValidSlug(slug: string): void {
  if (!slug || !slug.trim()) {
    notFound();
  }
}

function ensurePostExists(post: PostDetail | null): PostDetail {
  if (!post) {
    notFound();
  }

  return post;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  assertValidSlug(slug);
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: '文章不存在 - Meblog',
      description: '未找到该文章内容',
    };
  }

  const description = post.summary || fallbackDescription(post.content);
  const image = post.project?.cover;
  const canonicalUrl = `/post/${post.slug}`;

  return {
    title: post.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url: canonicalUrl,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  assertValidSlug(slug);
  const post = await getPostBySlug(slug);
  const ensuredPost = ensurePostExists(post);
  const likeStatus = await getLikeStatusBySlug(slug);
  return (
    <PostDetailClient
      initialPost={ensuredPost}
      initialSlug={slug}
      initialLikeStatus={likeStatus}
    />
  );
}
