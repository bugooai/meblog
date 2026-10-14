import { NextResponse } from 'next/server';
import type { AboutData } from '@/api/about';
import {
  DEFAULT_SITE_LOGO_URL,
  authorDisplayName,
  absoluteUrl,
  fetchSeoMeta,
  fetchAllPublishedPosts,
  metadataImageUrl,
  getSiteUrl,
} from '@/app/lib/seo';
import { fetchFromServerApi } from '@/app/lib/server-api';

export const revalidate = 1800;

const ITEM_LIMIT = 20;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .replace(/[#>*_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rfc822(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toUTCString();
}

async function getAuthorName(fallback: string): Promise<string> {
  try {
    const about = await fetchFromServerApi<AboutData>('/about', { revalidate: 1800 });
    return authorDisplayName(about, fallback);
  } catch {
    return fallback;
  }
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const [seo, posts] = await Promise.all([fetchSeoMeta(), fetchAllPublishedPosts()]);
  const authorName = await getAuthorName(seo.siteName);
  const latest = posts.slice(0, ITEM_LIMIT);
  const buildDate = rfc822(latest[0]?.created_at) || new Date().toUTCString();

  const items = (
    await Promise.all(
      latest.map(async (post) => {
      const link = absoluteUrl(`/post/${post.slug}`);
      const description = escapeXml(stripMarkdown(post.summary || '').slice(0, 300));
      const categories = post.tags.map((tag) => `      <category>${escapeXml(tag.name)}</category>`).join('\n');
      const image = await metadataImageUrl(post.cover || post.project?.cover);
      return [
        '    <item>',
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${description}</description>`,
        image ? `      <media:content url="${escapeXml(image)}" medium="image" />` : '',
        `      <author>${escapeXml(authorName)}</author>`,
        categories,
        `      <pubDate>${rfc822(post.created_at)}</pubDate>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
      })
    )
  ).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:atom="http://www.w3.org/2005/Atom"',
    '  xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    `    <title>${escapeXml(seo.siteName)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(seo.siteDescription)}</description>`,
    '    <language>zh-cn</language>',
    '    <docs>https://www.rssboard.org/rss-specification</docs>',
    '    <ttl>30</ttl>',
    `    <atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    `    <lastBuildDate>${buildDate}</lastBuildDate>`,
    `    <managingEditor>${escapeXml(authorName)} (${escapeXml(siteUrl)})</managingEditor>`,
    `    <webMaster>${escapeXml(authorName)} (${escapeXml(siteUrl)})</webMaster>`,
    '    <image>',
    '      <url>' + escapeXml(absoluteUrl(seo.siteLogoUrl || DEFAULT_SITE_LOGO_URL)) + '</url>',
    `      <title>${escapeXml(seo.siteName)}</title>`,
    `      <link>${escapeXml(siteUrl)}</link>`,
    '    </image>',
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
