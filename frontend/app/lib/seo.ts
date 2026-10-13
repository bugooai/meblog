import type { PostListItem, PostListResponse, Project, Tag } from '@/types';
import { fetchFromServerApi } from './server-api';

const DEFAULT_SITE_URL = 'http://localhost:3000';

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
