'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aboutApi } from '@/api/about';
import clsx from 'clsx';
import {
  BoltIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  CpuChipIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_TECH_STACK = ['Python', 'FastAPI', 'LangChain', 'Kubernetes', 'Elasticsearch', 'Redis'];
const DEFAULT_CAREER_TIMELINE = [
  {
    period: '2024 - 至今',
    title: 'AI 应用平台技术专家',
    description: '专注于企业级 LLM 应用平台与多 Agent 协作架构建设，推动 AI 从单点能力向平台化、工程化、规模化演进。',
    tag: 'FULL STACK AI / MCP / Infra',
    short_tag: 'FULL STACK AI',
  },
  {
    period: '2020 - 2024',
    title: '高级后端开发工程师',
    description: '主导微服务治理、服务可观测性、数据库性能优化与高并发链路稳定性建设，形成标准化工程实践。',
    tag: 'BACKEND SYSTEM',
    short_tag: 'BACKEND SYSTEM',
  },
  {
    period: '2017 - 2020',
    title: '后端开发工程师',
    description: '参与核心业务系统开发，完成需求分析、接口设计与上线运营的全流程交付，夯实 Web 后端工程能力。',
    tag: 'BACKEND SYSTEM',
    short_tag: 'BACKEND SYSTEM',
  },
];

const TECH_SUBTITLE_MAP: Record<string, string> = {
  python: '核心开发语言',
  fastapi: '高性能 API 开发',
  langchain: 'LLM 应用开发框架',
  postgresql: '关系型数据库与事务一致性',
  kubernetes: '容器编排与弹性',
  elasticsearch: '搜索与数据分析',
  redis: '缓存与数据存储',
};

const HERO_BADGES = [
  { label: 'AI 架构设计', icon: CpuChipIcon },
  { label: '多 Agent 协作', icon: SparklesIcon },
  { label: '数据驱动决策', icon: CircleStackIcon },
  { label: '工程化落地', icon: WrenchScrewdriverIcon },
];

const HERO_METRICS = [
  { label: '工程实践经验', value: '9 +' },
  { label: 'AI 平台项目落地', value: '10 +' },
  { label: 'AI方案落地率', value: '90% +' },
  { label: '系统可用性', value: '99.9%' },
];

const HERO_FOCUS_AREAS = ['Agent 协同编排', 'RAG 检索增强', 'MCP 工具集成', 'AI Infra 平台化'];

const BOTTOM_PILLARS = [
  { title: '工程化思维', desc: '构建稳定、可复用、可扩展的交付体系。', icon: CommandLineIcon },
  { title: '可观测与治理', desc: '建立监控、告警、审计闭环能力。', icon: Cog6ToothIcon },
  { title: '用户价值导向', desc: '从业务目标出发，交付可验证的 AI 价值。', icon: UserGroupIcon },
  { title: '持续迭代优化', desc: '沉淀模型、服务与工程实践。', icon: BoltIcon },
];

function normalizeTimelineTags(rawTag: string | null | undefined): string[] {
  if (!rawTag) return [];
  return rawTag
    .split(/[\/,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTechSubtitleKey(rawName: string): string {
  const normalized = rawName.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'elastcisesarch' || normalized === 'elastticsearch') return 'elasticsearch';
  if (normalized === 'postgreasql') return 'postgresql';
  return normalized;
}

export default function About() {
  const [cachedAvatarUrl, setCachedAvatarUrl] = useState('');
  const [cachedTechBgMap, setCachedTechBgMap] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ['about'],
    queryFn: aboutApi.getAbout,
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
  const fallbackTechStack = data?.tech_stack?.length ? data.tech_stack : DEFAULT_TECH_STACK;
  const techItems =
    configuredTechItems.length > 0
      ? configuredTechItems
      : fallbackTechStack.map((name) => ({
          name,
          summary: null,
          sort_order: null,
          background_image_url: null,
        }));
  const orderedTechItems = [...techItems].sort((a, b) => {
    const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const configuredTimeline = data?.career_timeline ?? [];
  const timelineItems = configuredTimeline.length > 0 ? configuredTimeline : DEFAULT_CAREER_TIMELINE;
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

  if (isLoading) {
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

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-[12px] border border-[var(--color-danger)]/25">
          加载失败，请稍后重试
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <section className="relative overflow-hidden rounded-[18px] border border-slate-800 bg-gradient-to-br from-[#041329] via-[#081f3f] to-[#0b1b33] text-white shadow-[0_24px_60px_rgba(2,8,23,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_45%)]" />
        <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-8 px-6 py-8 md:px-8 md:py-10">
          <div className="lg:col-span-3">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              <span className="text-[#f8fbff] [text-shadow:0_3px_14px_rgba(2,6,23,0.9)]">从高并发后端架构到</span>
              <br />
              <span className="text-[#60a5fa] [text-shadow:0_2px_10px_rgba(30,64,175,0.9)]">AI 基础设施</span>
              <span className="text-[#f8fbff] [text-shadow:0_3px_14px_rgba(2,6,23,0.9)]"> 的深度实践者</span>
            </h1>
            <p className="mt-3 text-slate-200 text-lg">构建可落地的智能系统，驱动业务增长与组织进化</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {HERO_BADGES.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900/35 px-3 py-1 text-xs text-slate-100"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              ))}
            </div>

            <p className="mt-5 text-slate-200 leading-8 text-sm md:text-base">
              {data.bio ||
                '10+ 年工程经验，专注于大模型应用平台与智能体系建设，擅长将前沿 AI 技术与工程实践深度结合，打造高质量、可扩展、可运营的企业 AI 产品。'}
            </p>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {HERO_METRICS.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3">
                  <p className="text-3xl font-extrabold text-[#60a5fa]">{metric.value}</p>
                  <p className="text-xs text-slate-300 mt-1">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/25 px-4 py-3">
              <p className="text-xs tracking-[0.16em] text-slate-300 font-semibold">CURRENT FOCUS</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HERO_FOCUS_AREAS.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/40 px-2.5 py-1 text-xs text-slate-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="w-full max-w-[320px] mx-auto rounded-2xl border border-slate-700 bg-slate-900/45 p-4 backdrop-blur-sm">
              {data.avatar_url ? (
                <img
                  src={cachedAvatarUrl || data.avatar_url}
                  alt={data.username || 'avatar'}
                  className="aspect-[4/5] w-full max-w-[280px] mx-auto rounded-xl object-cover object-center"
                />
              ) : (
                <div className="aspect-[4/5] w-full max-w-[280px] mx-auto rounded-xl bg-gradient-to-br from-slate-400 to-slate-700 flex items-center justify-center text-5xl font-bold">
                  {(data.username || 'ME').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="mt-4">
                <p className="text-3xl font-bold text-white">{data.username || '工程实践者'}</p>
                <p className="mt-1 text-[#93c5fd] text-sm font-semibold">AI 应用平台技术专家</p>
                <p className="mt-2 text-slate-300 text-sm">FULL STACK AI ENGINEER</p>
                <p className="mt-1 text-xs text-slate-400">架构 · 工程 · 产品 · 组织</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
          <p className="text-xs tracking-[0.24em] text-[var(--color-foreground-secondary)] font-semibold">TECH RADAR</p>
          <div className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          <p className="text-sm text-[var(--color-foreground-secondary)]">构建可持续演进的工程系统</p>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {orderedTechItems.slice(0, 6).map((tech) => {
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
                      style={{ backgroundImage: `url(${cachedTechBgMap[tech.background_image_url] || tech.background_image_url})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-background)]/45 via-[var(--color-background)]/70 to-[var(--color-background)]/92" />
                  </div>
                ) : null}

                <p className="relative mt-3 font-bold text-lg text-[var(--color-foreground)]">
                  {tech.name}
                </p>
                <p className="relative mt-1 text-xs text-[var(--color-foreground-secondary)]">
                  {tech.summary || subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <div className="border-b border-[var(--color-border)] pb-3">
          <h2
            className="text-4xl font-extrabold text-[var(--color-foreground)]"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            工程足迹
          </h2>
          <div className="mt-2 h-1 w-14 rounded bg-[#3b82f6]" />
        </div>

        <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {timelineItems.map((item, index) => {
            const tags = normalizeTimelineTags(item.tag);
            return (
              <article key={`${item.period}-${item.title}-${index}`} className="grid grid-cols-1 md:grid-cols-[130px_24px_1fr_190px] gap-4 py-8">
                <div className="hidden md:block text-base font-semibold text-[var(--color-foreground-secondary)]">{item.period}</div>

                <div className="relative hidden md:flex justify-center">
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--color-border)]" />
                  <div className="relative mt-1 h-3.5 w-3.5 rounded-full border-2 border-[#60a5fa] bg-white dark:bg-[var(--color-background)]" />
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-[var(--color-foreground-secondary)] md:hidden">{item.period}</p>
                  <h3 className="text-[32px] leading-tight font-extrabold text-[var(--color-foreground)]">{item.title}</h3>
                  {item.short_tag ? <p className="mt-2 text-sm font-bold tracking-[0.12em] text-[#60a5fa] md:hidden">{item.short_tag}</p> : null}
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
                  {item.short_tag ? <p className="text-sm font-bold tracking-[0.14em] text-[#60a5fa]">{item.short_tag}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 rounded-2xl border border-slate-800 bg-gradient-to-r from-[#06162f] via-[#0a2041] to-[#10264a] p-3">
          {BOTTOM_PILLARS.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-950/35 p-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900/50">
                <item.icon className="h-5 w-5 text-[#93c5fd]" />
              </div>
              <p className="mt-3 text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm text-slate-300 leading-6">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
