'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aboutApi } from '@/api/about';
import type { AboutData } from '@/api/about';
import clsx from 'clsx';
import {
  CodeBracketIcon,
  LinkIcon,
  MapPinIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

const TECH_SUBTITLE_MAP: Record<string, string> = {
  python: '核心开发语言',
  fastapi: '高性能 API 开发',
  langchain: 'LLM 应用开发框架',
  postgresql: '关系型数据库与事务一致性',
  kubernetes: '容器编排与弹性',
  elasticsearch: '搜索与数据分析',
  redis: '缓存与数据存储',
};

function normalizeTechSubtitleKey(name: string): string {
  const normalized = name.toLowerCase().replace(/[\s._-]+/g, '');
  if (normalized.includes('python')) return 'python';
  if (normalized.includes('fastapi')) return 'fastapi';
  if (normalized.includes('langchain')) return 'langchain';
  if (normalized.includes('kubernetes') || normalized === 'k8s') return 'kubernetes';
  if (normalized.includes('elastic')) return 'elasticsearch';
  if (normalized.includes('postgres')) return 'postgresql';
  if (normalized.includes('redis')) return 'redis';
  return normalized;
}

function normalizeTimelineTags(rawTag: string | null | undefined): string[] {
  if (!rawTag) return [];
  return rawTag
    .split(/[\/,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

interface AboutClientProps {
  // 服务端已经取到的作者资料。留空时退回浏览器自己拉一次，行为跟改造前一致。
  about: AboutData | null;
}

export default function AboutClient({ about }: AboutClientProps) {
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState('');
  const [cachedTechBgMap, setCachedTechBgMap] = useState<Record<string, string>>({});
  const { data, error } = useQuery({
    queryKey: ['about'],
    queryFn: aboutApi.getAbout,
    initialData: about ?? undefined,
  });

  useEffect(() => {
    let cancelled = false;
    let localBlobUrl = '';
    const sourceUrl = data?.avatar_url;
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
  }, [data?.avatar_url]);

  const configuredTechItems = data?.tech_stack_items ?? [];
  const techItems =
    configuredTechItems.length > 0
      ? configuredTechItems
      : (data?.tech_stack ?? []).map((name, index) => ({
          name,
          summary: null,
          sort_order: index,
          background_image_url: null,
        }));
  const orderedTechItems = [...techItems]
    .filter((item) => Boolean(item.name))
    .sort((a, b) => {
      const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });

  const timelineItems = (data?.career_timeline ?? []).filter(
    (item) => Boolean(item.period && item.title && item.description)
  );
  const profileLinks = [
    { label: 'GitHub', url: data?.github_url, icon: CodeBracketIcon },
    { label: '知乎', url: data?.zhihu_url, icon: LinkIcon },
    { label: 'X / Twitter', url: data?.twitter_url, icon: LinkIcon },
  ].filter((item): item is { label: string; url: string; icon: typeof LinkIcon } => Boolean(item.url));

  const techBgSourceKey = JSON.stringify(
    Array.from(
      new Set(orderedTechItems.map((item) => item.background_image_url).filter((url): url is string => Boolean(url)))
    )
  );

  useEffect(() => {
    let cancelled = false;
    const createdBlobUrls: string[] = [];
    const sourceUrls: string[] = JSON.parse(techBgSourceKey);

    if (sourceUrls.length === 0) {
      setCachedTechBgMap({});
      return () => {};
    }

    const loadTechBackgrounds = async () => {
      const pairs = await Promise.all(
        sourceUrls.map(async (sourceUrl) => {
          try {
            const resp = await fetch(sourceUrl);
            if (!resp.ok) throw new Error('Failed to fetch tech background');
            const blob = await resp.blob();
            const localBlobUrl = URL.createObjectURL(blob);
            createdBlobUrls.push(localBlobUrl);
            return [sourceUrl, localBlobUrl] as const;
          } catch {
            return [sourceUrl, sourceUrl] as const;
          }
        })
      );

      if (!cancelled) {
        setCachedTechBgMap(Object.fromEntries(pairs));
      }
    };

    loadTechBackgrounds();

    return () => {
      cancelled = true;
      createdBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [techBgSourceKey]);

  if (!data) {
    if (error) {
      return (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-[12px] border border-[var(--color-danger)]/25">
            加载失败，请稍后重试
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)]">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--color-foreground-secondary)]">加载中...</span>
          </div>
        </div>
      </div>
    );
  }


  const authorName = data.username?.trim() || '本站作者';
  const bio = data.bio?.trim() || '';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <section className="relative overflow-hidden rounded-[18px] border border-slate-800 bg-gradient-to-br from-[#041329] via-[#081f3f] to-[#0b1b33] text-white shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_45%)]" />
        <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-8 px-6 py-8 md:px-8 md:py-10">
          <div className="lg:col-span-3">
            <p className="text-xs tracking-[0.24em] text-[#93c5fd] font-semibold">关于作者</p>
            <h1 className="mt-3 text-3xl md:text-5xl font-extrabold leading-tight">
              <span className="text-[#f8fbff] [text-shadow:0_3px_14px_rgba(2,6,23,0.9)]">{authorName}</span>
            </h1>

            {bio ? (
              <p className="mt-5 text-slate-200 leading-8 text-sm md:text-base whitespace-pre-line">{bio}</p>
            ) : null}

            {profileLinks.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {profileLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.url}
                    target="_blank"
                    rel="me noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/35 px-3 py-1 text-xs text-slate-100 hover:border-[#60a5fa]"
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}

            {data.wechat_id ? (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/25 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-xs tracking-[0.16em] text-slate-300 font-semibold">
                  <UserIcon className="h-3.5 w-3.5" />
                  微信
                </p>
                <p className="mt-1 text-sm text-slate-100">{data.wechat_id}</p>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-2">
            <div className="w-full max-w-[320px] mx-auto rounded-2xl border border-slate-700 bg-slate-900/45 p-4 backdrop-blur-sm">
              {data.avatar_url ? (
                <img
                  src={cachedAvatarUrl || data.avatar_url}
                  alt={authorName}
                  className="aspect-[4/5] w-full max-w-[280px] mx-auto rounded-xl object-cover object-center"
                />
              ) : (
                <div className="aspect-[4/5] w-full max-w-[280px] mx-auto rounded-xl bg-gradient-to-br from-slate-400 to-slate-700 flex items-center justify-center text-5xl font-bold">
                  {authorName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="mt-4">
                <p className="text-3xl font-bold text-white">{authorName}</p>
                {timelineItems.length > 0 ? (
                  <p className="mt-2 text-slate-300 text-sm">{timelineItems[0].title}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {orderedTechItems.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
            <p className="text-xs tracking-[0.24em] text-[var(--color-foreground-secondary)] font-semibold">
              TECH STACK
            </p>
            <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
            <p className="text-sm text-[var(--color-foreground-secondary)]">
              {authorName} 在文章里用到的技术
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {orderedTechItems.map((tech) => {
              const key = normalizeTechSubtitleKey(tech.name);
              const subtitle = TECH_SUBTITLE_MAP[key] || '工程能力模块';
              return (
                <div
                  key={`${tech.name}-${tech.sort_order ?? 0}`}
                  className={clsx(
                    'relative overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-background)] p-3 shadow-[var(--shadow-card)] min-h-[132px]',
                    'transition-transform duration-200 hover:-translate-y-0.5'
                  )}
                >
                  {tech.background_image_url ? (
                    <div className="pointer-events-none absolute inset-0">
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-70"
                        style={{
                          backgroundImage: `url(${cachedTechBgMap[tech.background_image_url] || tech.background_image_url})`,
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-background)]/45 via-[var(--color-background)]/70 to-[var(--color-background)]/92" />
                    </div>
                  ) : null}

                  <p className="relative mt-3 font-bold text-lg text-[var(--color-foreground)]">{tech.name}</p>
                  <p className="relative mt-1 text-xs text-[var(--color-foreground-secondary)]">
                    {tech.summary || subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {timelineItems.length > 0 ? (
        <section className="mt-12">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h2
              className="text-4xl font-extrabold text-[var(--color-foreground)]"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              经历
            </h2>
            <div className="mt-2 h-1 w-14 rounded bg-[#3b82f6]" />
          </div>

          <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {timelineItems.map((item, index) => {
              const tags = normalizeTimelineTags(item.tag);
              return (
                <article
                  key={`${item.period}-${item.title}-${index}`}
                  className="grid grid-cols-1 md:grid-cols-[130px_24px_1fr_190px] gap-4 py-8"
                >
                  <div className="hidden md:block text-base font-semibold text-[var(--color-foreground-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4" />
                      {item.period}
                    </span>
                  </div>

                  <div className="relative hidden md:flex justify-center">
                    <div className="absolute top-0 bottom-0 w-px bg-[var(--color-border)]" />
                    <div className="relative mt-1 h-3.5 w-3.5 rounded-full border-2 border-[#60a5fa] bg-white dark:bg-[var(--color-background)]" />
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-[var(--color-foreground-secondary)] md:hidden">
                      {item.period}
                    </p>
                    <h3 className="text-[32px] leading-tight font-extrabold text-[var(--color-foreground)]">
                      {item.title}
                    </h3>
                    {item.short_tag ? (
                      <p className="mt-2 text-sm font-bold tracking-[0.12em] text-[#60a5fa] md:hidden">
                        {item.short_tag}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[var(--color-foreground-secondary)] leading-7">{item.description}</p>
                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={`${item.title}-${tag}`}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-2.5 py-1 text-xs text-[var(--color-foreground-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="hidden md:block text-left md:text-right">
                    {item.short_tag ? (
                      <p className="text-sm font-bold tracking-[0.14em] text-[#60a5fa]">{item.short_tag}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
