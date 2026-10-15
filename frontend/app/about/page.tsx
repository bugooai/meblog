import type { Metadata } from 'next';
import type { AboutData } from '@/api/about';
import AboutClient from './AboutClient';
import {
  absoluteUrl,
  authorDisplayName,
  buildAuthorJsonLd,
  fallbackOgImageUrl,
  fetchSeoMeta,
  metadataImageUrl,
} from '@/app/lib/seo';
import { fetchFromServerApi } from '@/app/lib/server-api';

// 每次请求都在服务端渲染，不把这一页烘进构建产物：`next build` 时后端往往不可达，
// 那样会静默产出一个「关于 <站点名>」的空壳页面，比报错难查。
export const dynamic = 'force-dynamic';
// 300 秒必须明显短于 OSS 签名有效期（默认 3600），否则页面会发出去已过期的图片地址。
export const revalidate = 300;

// 之前这一页是纯客户端组件：作者名、简介、经历全靠浏览器 fetch 之后才出现，
// 服务端 HTML 里一个字都没有。单作者博客最需要被爬虫看到的正是「作者是谁」，
// 而文章页的 JSON-LD 又把 author.url 指向这里 —— 等于作者实体指向一张白页。
// 现在改成服务端先取一次，取不到再让客户端兜底重试。
async function getAuthorProfile(): Promise<AboutData | null> {
  try {
    return await fetchFromServerApi<AboutData>('/about', { revalidate: 300 });
  } catch (error) {
    console.error('[about] 服务端取作者资料失败，退回客户端拉取', error);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [seo, about] = await Promise.all([fetchSeoMeta(), getAuthorProfile()]);
  const name = authorDisplayName(about, seo.siteName);
  const description = about?.bio?.trim() || `关于 ${name} —— ${seo.siteDescription}`;
  const canonicalUrl = absoluteUrl('/about');
  const image = (await metadataImageUrl(about?.avatar_url, fallbackOgImageUrl(seo))) ?? undefined;

  return {
    title: `关于 ${name}`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'profile',
      siteName: seo.siteName,
      locale: 'zh_CN',
      title: `关于 ${name}`,
      description,
      url: canonicalUrl,
      images: image ? [{ url: image, width: 1200, height: 630, alt: name }] : [],
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `关于 ${name}`,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function AboutPage() {
  const [seo, about] = await Promise.all([fetchSeoMeta(), getAuthorProfile()]);
  const person = buildAuthorJsonLd(about, seo);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person) }}
      />
      <AboutClient about={about} />
    </>
  );
}
