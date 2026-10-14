import PostDetailClient from './PostDetailClient';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { AboutData } from '@/api/about';
import type { PostDetail } from '@/types';
import {
  absoluteUrl,
  authorDisplayName,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  fallbackOgImageUrl,
  fetchSeoMeta,
  metadataImageUrl,
  postImageUrl,
} from '@/app/lib/seo';
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

async function getAuthorProfile(): Promise<AboutData | null> {
  try {
    return await fetchFromServerApi<AboutData>('/about', { revalidate: 300 });
  } catch {
    return null;
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

  const seo = await fetchSeoMeta();
  const description = (post.summary || fallbackDescription(post.content)).slice(0, 200);
  const image = (await metadataImageUrl(postImageUrl(post, null), fallbackOgImageUrl(seo))) ?? undefined;
  const canonicalUrl = absoluteUrl(`/post/${post.slug}`);
  const authorName = authorDisplayName(await getAuthorProfile(), post.author?.username || seo.siteName);

  return {
    title: post.title,
    description,
    keywords: post.tags.map((tag) => tag.name).join(', ') || undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      siteName: seo.siteName,
      locale: 'zh_CN',
      title: post.title,
      description,
      url: canonicalUrl,
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      authors: [authorName],
      tags: post.tags.map((tag) => tag.name),
      images: image ? [{ url: image, width: 1200, height: 630, alt: post.title }] : [],
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  assertValidSlug(slug);
  const post = await getPostBySlug(slug);
  const ensuredPost = ensurePostExists(post);
  const likeStatus = await getLikeStatusBySlug(slug);
  const [seo, about] = await Promise.all([fetchSeoMeta(), getAuthorProfile()]);
  const authorName = authorDisplayName(about, ensuredPost.author?.username || seo.siteName);
  const article = await buildArticleJsonLd(ensuredPost, seo, authorName);
  const breadcrumbItems = [
    { name: '首页', path: '/' },
    ...(ensuredPost.project ? [{ name: ensuredPost.project.name, path: `/project/${ensuredPost.project.slug}` }] : []),
    { name: ensuredPost.title, path: `/post/${ensuredPost.slug}` },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([article, buildBreadcrumbJsonLd(breadcrumbItems)]),
        }}
      />
      <PostDetailClient
        initialPost={ensuredPost}
        initialSlug={slug}
        initialLikeStatus={likeStatus}
      />
    </>
  );
}
