import Link from 'next/link';
import type { Project } from '@/types';
import { fetchFromServerApi } from '@/app/lib/server-api';
import CoverImage from '@/components/CoverImage';

export const revalidate = 180;
export const dynamic = 'force-dynamic';

function isImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('oss://') ||
    lower.startsWith('/') ||
    lower.startsWith('data:image/')
  );
}

export default async function ProjectsPage() {
  let projects: Project[] = [];
  let loadFailed = false;

  try {
    projects = (await fetchFromServerApi<Project[]>('/projects?include_hidden=true', { revalidate })) || [];
  } catch {
    loadFailed = true;
    // Keep page render resilient when API is temporarily unavailable.
  }

  if (loadFailed) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-semibold text-[var(--color-foreground)] mb-2">项目列表加载失败</h2>
        <p className="text-[var(--color-foreground-secondary)]">请稍后刷新页面重试。</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-6 md:mb-8 min-h-[150px] md:min-h-[170px]">
        <p className="text-xs tracking-[0.3em] text-[var(--color-foreground-secondary)] mb-3 uppercase">
          Project Index
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold text-[var(--color-foreground)] mb-4"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          项目体系
        </h1>
        <p className="text-[var(--color-foreground-secondary)] max-w-3xl leading-8">
          按项目组织的技术与实践集合，沉淀从探索到落地的完整过程，当前共 {projects.length} 个项目。
        </p>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-[var(--color-foreground)] mb-2">暂无项目</h3>
          <p className="text-[var(--color-foreground-secondary)]">稍后再来看看吧</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const count = proj.post_count || 0;
            return (
              <Link
                key={proj.id}
                href={`/project/${proj.slug}`}
                className="group rounded-2xl overflow-hidden bg-[var(--color-background)]/80 backdrop-blur border border-[var(--color-border)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 transition"
              >
                <div className="h-40 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                  {isImageUrl(proj.cover) ? (
                    <CoverImage
                      src={proj.cover!}
                      alt={proj.name}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h2
                      className="text-xl font-semibold text-[var(--color-foreground)]"
                      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                    >
                      {proj.name}
                    </h2>
                    <span className="opacity-0 group-hover:opacity-100 transition text-[var(--color-foreground-secondary)]">→</span>
                  </div>
                  <p className="mt-4 text-sm text-[var(--color-foreground-secondary)]">
                    {count} {count === 1 ? 'Article' : 'Articles'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
