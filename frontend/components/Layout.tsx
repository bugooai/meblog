'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import WechatQR from './WechatQR';
import { FolderIcon, TagIcon, SparklesIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { projectsApi } from '@/api/project';
import { tagsApi } from '@/api/tags';
import { aboutApi } from '@/api/about';
import { siteSettingsApi } from '@/api/settings';
import { statsApi } from '@/api/stats';
import { useAuth } from '@/context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

function formatVisitCount(value: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(value || 0)));
  if (n < 10) return String(n);
  if (n < 100) return `${Math.floor(n / 10) * 10} +`;
  if (n < 1000) return `${Math.floor(n / 100) * 100} +`;
  if (n < 10000) return `${Math.floor(n / 1000)} k +`;

  const wValue = Math.floor((n / 10000) * 10) / 10;
  const text = Number.isInteger(wValue) ? String(wValue) : wValue.toFixed(1);
  return `${text} w +`;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdminViewer = Boolean(user?.is_admin);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState('');
  
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', isAdminViewer ? 'admin-visible' : 'public-visible'],
    queryFn: () => projectsApi.getAll(isAdminViewer ? { include_hidden: true } : undefined),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', isAdminViewer ? 'admin-visible' : 'public-visible'],
    queryFn: () => tagsApi.getAll(isAdminViewer ? { include_hidden: true } : undefined),
  });

  const { data: about } = useQuery({
    queryKey: ['about'],
    queryFn: aboutApi.getAbout,
  });
  const sidebarAvatarSource = about?.avatar_thumb_url || about?.avatar_url || '';

  useEffect(() => {
    setAvatarBroken(false);
  }, [sidebarAvatarSource]);

  useEffect(() => {
    let cancelled = false;
    let localBlobUrl = '';
    const sourceUrl = sidebarAvatarSource;
    if (!sourceUrl) {
      setCachedAvatarUrl('');
      return () => {};
    }

    const loadToLocalBlob = async () => {
      try {
        const resp = await fetch(sourceUrl);
        if (!resp.ok) throw new Error('Failed to fetch avatar image');
        const blob = await resp.blob();
        localBlobUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setCachedAvatarUrl(localBlobUrl);
        }
      } catch {
        if (!cancelled) {
          setCachedAvatarUrl(sourceUrl);
        }
      }
    };

    loadToLocalBlob();

    return () => {
      cancelled = true;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [sidebarAvatarSource]);

  const { data: summaryData } = useQuery({
    queryKey: [isAdminViewer ? 'admin-summary' : 'public-summary', isAdminViewer],
    queryFn: async () => {
      if (isAdminViewer) {
        const dashboard = await statsApi.getAdminDashboard();
        return {
          total_posts: dashboard.total_posts ?? 0,
          total_comments: dashboard.total_comments ?? 0,
          total_visits: dashboard.total_visits ?? 0,
        };
      }
      return await statsApi.getPublicSummary();
    },
  });

  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: siteSettingsApi.getSiteSettings,
  });

  // Don't show sidebar on admin pages
  const isAdminPage = pathname.startsWith('/admin');
  const isNoSidebarPage = pathname === '/login' || pathname === '/about';

  if (isAdminPage) {
    return (
      <div className="min-h-screen global-engineering-bg admin-surface">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen global-engineering-bg flex flex-col">
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 py-8 pb-2">
          <div className="lg:flex lg:gap-8">
            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {children}
            </main>

            {/* Sidebar */}
            {!isNoSidebarPage && (
            <aside className="lg:w-72 mt-8 lg:mt-0 space-y-6">
              {/* Author Summary Widget */}
              <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <Link href="/about" className="w-16 h-16 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-background-secondary)] shrink-0 block hover:opacity-90 transition-opacity">
                      {sidebarAvatarSource && !avatarBroken ? (
                        <img
                          src={cachedAvatarUrl || sidebarAvatarSource}
                          alt={about?.username || '作者头像'}
                          className="w-full h-full object-cover"
                          onError={() => setAvatarBroken(true)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-primary)] font-semibold">
                          {(about?.username || '作').slice(0, 1)}
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-[var(--color-foreground)] leading-tight truncate">{about?.username || '李衡'}</p>
                      <p className="mt-1 text-sm text-[var(--color-primary)] font-semibold">AI 应用平台技术专家</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-foreground-secondary)]">
                        <MapPinIcon className="w-3.5 h-3.5" />
                        中国 · 杭州
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-3 py-2">
                      <p className="text-xs text-[var(--color-foreground-secondary)]">文章数</p>
                      <p className="text-lg font-semibold text-[var(--color-foreground)]">{summaryData?.total_posts ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-3 py-2">
                      <p className="text-xs text-[var(--color-foreground-secondary)]">留言数</p>
                      <p className="text-lg font-semibold text-[var(--color-foreground)]">{summaryData?.total_comments ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-3 py-2">
                      <p className="text-xs text-[var(--color-foreground-secondary)]">访问量</p>
                      <p className="text-lg font-semibold text-[var(--color-foreground)]">{formatVisitCount(summaryData?.total_visits)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories Widget */}
              <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
                <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                  <h3 className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
                    <FolderIcon className="w-5 h-5 text-[var(--color-primary)]" />
                    项目
                  </h3>
                </div>
                <div className="p-4">
                  {projects.length === 0 ? (
                    <p className="text-sm text-[var(--color-foreground-secondary)]">暂无项目</p>
                  ) : (
                    <ul className="space-y-1">
                      {projects.map((proj) => (
                        <li key={proj.id}>
                          <Link
                            href={`/project/${proj.slug}`}
                            className="flex items-center justify-between px-3 py-2 text-sm rounded-[8px] text-[var(--color-foreground)] hover:bg-[var(--color-primary-light)]/30 hover:text-[var(--color-foreground)] transition-colors"
                          >
                            <span>{proj.name}</span>
                            <span className="px-2 py-0.5 text-xs bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] rounded-full">
                              {proj.post_count || 0}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Tags Widget */}
              <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-card-hover)]">
                <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-background-secondary)]">
                  <h3 className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
                    <TagIcon className="w-5 h-5 text-[var(--color-primary)]" />
                    标签
                  </h3>
                </div>
                <div className="p-4">
                  {tags.length === 0 ? (
                    <p className="text-sm text-[var(--color-foreground-secondary)]">暂无标签</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Link
                          key={tag.id}
                          href={`/tag/${tag.slug}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] rounded-[8px] hover:bg-[var(--color-primary-light)]/35 hover:text-[var(--color-foreground)] transition-colors"
                        >
                          <SparklesIcon className="w-3 h-3" />
                          {tag.name}
                          <span className="text-xs opacity-60">({tag.post_count || 0})</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Wechat QR Widget */}
              <WechatQR variant="sidebar" />
            </aside>
            )}
          </div>
        </div>
        </div>
        <Footer githubUrl={siteSettings?.footer_github_url} beianIcp={siteSettings?.beian_icp} />
      </div>
    </div>
  );
}
