import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import Layout from '@/components/Layout';
import {
  DEFAULT_SITE_LOGO_URL,
  FALLBACK_SITE_DESCRIPTION,
  buildWebsiteJsonLd,
  fallbackOgImageUrl,
  fetchSeoMeta,
  getSiteUrl,
} from '@/app/lib/seo';
import './globals.css';

const defaultIcon = '/icon.svg?v=ahernli-round';
const defaultAppleIcon = DEFAULT_SITE_LOGO_URL;

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchSeoMeta();
  const siteUrl = getSiteUrl();
  const faviconUrl = seo.siteFaviconUrl || defaultIcon;
  const logoUrl = seo.siteLogoUrl || defaultAppleIcon;
  const description = seo.siteDescription || FALLBACK_SITE_DESCRIPTION;
  const ogImage = fallbackOgImageUrl(seo);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${seo.siteName} · 独立开发者与 AI 工程实践`,
      template: `%s · ${seo.siteName}`,
    },
    description,
    keywords: seo.siteKeywords.length ? seo.siteKeywords : undefined,
    alternates: {
      canonical: '/',
      types: { 'application/rss+xml': `${siteUrl}/feed.xml` },
    },
    openGraph: {
      type: 'website',
      siteName: seo.siteName,
      locale: 'zh_CN',
      url: siteUrl,
      title: seo.siteName,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: seo.siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.siteName,
      description,
      images: [ogImage],
    },
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: logoUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seo = await fetchSeoMeta();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebsiteJsonLd(seo)) }}
        />
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
