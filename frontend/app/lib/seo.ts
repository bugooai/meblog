import type { AboutData } from '@/api/about';
import type { SeoSettings, SiteSettings } from '@/api/settings';
import type { PostDetail, PostListItem, PostListResponse, Project, Tag } from '@/types';
import { fetchFromServerApi } from './server-api';

const DEFAULT_SITE_URL = 'http://localhost:3000';

export const FALLBACK_SITE_NAME = 'Meblog';
export const FALLBACK_SITE_DESCRIPTION = '分享技术与生活的个人博客';
export const DEFAULT_SITE_LOGO_URL = '/bugoo-logo.png?v=ahernli-round';


export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL;
  return siteUrl.replace(/\/+$/, '');
}

export async function fetchAllPublishedPosts(pageSize = 100): Promise<PostListItem[]> {
  try {
    const firstPage = await fetchFromServerApi<PostListResponse>(`/posts?page=1&size=${pageSize}`, {
      revalidate: 1800,
    });

    const posts = [...firstPage.items];
    for (let page = 2; page <= firstPage.pages; page += 1) {
      const nextPage = await fetchFromServerApi<PostListResponse>(`/posts?page=${page}&size=${pageSize}`, {
        revalidate: 1800,
      });
      posts.push(...nextPage.items);
    }

    return posts;
  } catch (error) {
    console.error('[seo] fallback to empty posts for feed/sitemap generation', error);
    return [];
  }
}

export async function fetchAllProjects(): Promise<Project[]> {
  try {
    return await fetchFromServerApi<Project[]>('/projects', { revalidate: 1800 });
  } catch (error) {
    console.error('[seo] fallback to empty projects for sitemap generation', error);
    return [];
  }
}

export async function fetchAllTags(): Promise<Tag[]> {
  try {
    return await fetchFromServerApi<Tag[]>('/tags', { revalidate: 1800 });
  } catch (error) {
    console.error('[seo] fallback to empty tags for sitemap generation', error);
    return [];
  }
}

export interface SeoMeta {
  siteName: string;
  siteDescription: string;
  siteKeywords: string[];
  defaultOgImageUrl: string | null;
  siteLogoUrl: string | null;
  siteFaviconUrl: string | null;
}

export async function fetchSeoMeta(): Promise<SeoMeta> {
  const [seoSettings, siteSettings] = await Promise.all([
    fetchFromServerApi<SeoSettings>('/settings/seo', { revalidate: 180 }).catch(() => null),
    fetchFromServerApi<SiteSettings>('/settings/site', { revalidate: 180 }).catch(() => null),
  ]);

  return {
    siteName: seoSettings?.site_name || siteSettings?.site_name || FALLBACK_SITE_NAME,
    siteDescription: seoSettings?.site_description || FALLBACK_SITE_DESCRIPTION,
    siteKeywords: splitKeywords(seoSettings?.site_keywords),
    defaultOgImageUrl: seoSettings?.default_og_image_url || null,
    siteLogoUrl: siteSettings?.site_logo_url || null,
    siteFaviconUrl: siteSettings?.site_favicon_url || null,
  };
}

export function splitKeywords(keywords: string | null | undefined): string[] {
  if (!keywords) return [];
  return keywords
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getSiteUrl()}/${pathOrUrl.replace(/^\/+/, '')}`;
}

export function postImageUrl(post: PostDetail, fallback: string | null): string | null {
  return post.cover || post.project?.cover || fallback || null;
}

// 分享卡片的图片兜底链：后台默认 OG 图 -> 站点 logo -> 仓库自带 logo。
// 没有这条兜底时，没封面的文章 og:image 会整个缺失，微信/Twitter 分享出去是白板。
export function fallbackOgImageUrl(meta: SeoMeta): string {
  return meta.defaultOgImageUrl || meta.siteLogoUrl || DEFAULT_SITE_LOGO_URL;
}

export function buildWebsiteJsonLd(meta: SeoMeta): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: meta.siteName,
    url: getSiteUrl(),
    description: meta.siteDescription,
    inLanguage: 'zh-CN',
  };
}

export function buildArticleJsonLd(
  post: PostDetail,
  meta: SeoMeta,
  authorName: string
): Record<string, unknown> {
  const url = absoluteUrl(`/post/${post.slug}`);
  const image = postImageUrl(post, fallbackOgImageUrl(meta));
  const publisherLogo = meta.siteLogoUrl ? absoluteUrl(meta.siteLogoUrl) : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title.slice(0, 110),
    description: post.summary || undefined,
    image: image ? [absoluteUrl(image)] : undefined,
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    inLanguage: 'zh-CN',
    author: { '@type': 'Person', name: authorName, url: absoluteUrl('/about') },
    publisher: {
      '@type': 'Organization',
      name: meta.siteName,
      url: getSiteUrl(),
      ...(publisherLogo ? { logo: { '@type': 'ImageObject', url: publisherLogo } } : {}),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    keywords: post.tags.map((tag) => tag.name).join(', ') || undefined,
  };
}

export function buildBreadcrumbJsonLd(
  items: { name: string; path: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function authorDisplayName(about: AboutData | null, fallback: string): string {
  return about?.username?.trim() || fallback;
}
