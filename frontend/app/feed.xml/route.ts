import { NextResponse } from 'next/server';
import { fetchAllPublishedPosts, getSiteUrl } from '@/app/lib/seo';

export const revalidate = 1800;

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

export async function GET() {
  const siteUrl = getSiteUrl();
  const posts = await fetchAllPublishedPosts();
  const latest = posts.slice(0, 20);

  const items = latest
    .map((post) => {
      const link = `${siteUrl}/post/${post.slug}`;
      const description = escapeXml(stripMarkdown(post.summary || '').slice(0, 200));
      const pubDate = new Date(post.created_at).toUTCString();
      return [
        '<item>',
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<description>${description}</description>`,
        `<pubDate>${pubDate}</pubDate>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>Meblog</title>',
    `<link>${escapeXml(siteUrl)}</link>`,
    '<description>Meblog 最新文章</description>',
    '<language>zh-cn</language>',
    `<atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
    items,
    '</channel>',
    '</rss>',
  ].join('');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
