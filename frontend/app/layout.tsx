import type { Metadata } from 'next';
import { Providers } from './providers';
import Layout from '@/components/Layout';
import { fetchFromServerApi } from '@/app/lib/server-api';
import type { SiteSettings } from '@/api/settings';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000';
const defaultSiteName = '技术博客';
const defaultDescription = '分享技术与生活的个人博客';
const defaultIcon = '/icon.svg?v=ahernli-round';
const defaultAppleIcon = '/bugoo-logo.png?v=ahernli-round';

async function getServerSiteSettings(): Promise<SiteSettings | null> {
  try {
    return await fetchFromServerApi<SiteSettings>('/settings/site', { revalidate: 180 });
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getServerSiteSettings();
  const siteName = siteSettings?.site_name || defaultSiteName;
  const faviconUrl = siteSettings?.site_favicon_url || defaultIcon;
  const siteLogoUrl = siteSettings?.site_logo_url || defaultAppleIcon;

  return {
    metadataBase: new URL(siteUrl),
    title: `${siteName} - 技术博客`,
    description: defaultDescription,
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: siteLogoUrl,
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Providers>
          <Layout>{children}</Layout>
        </Providers>
      </body>
    </html>
  );
}
