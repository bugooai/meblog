import { fetchFromServerApi } from '@/app/lib/server-api';
import type { PostListItem } from '@/types';
import Link from 'next/link';

export const revalidate = 180;

interface MonthBucket {
  month: number;
  posts: PostListItem[];
}

interface YearBucket {
  year: number;
  months: MonthBucket[];
}

function formatArchiveItemDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

function formatMonthZh(month: number): string {
  const zhMonths = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  return zhMonths[month - 1] || `${month}月`;
}

function toYearBuckets(posts: PostListItem[]): YearBucket[] {
  const map = new Map<number, Map<number, PostListItem[]>>();

  for (const post of posts) {
    const date = new Date(post.created_at);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (!map.has(year)) map.set(year, new Map());
    const yearMap = map.get(year)!;
    if (!yearMap.has(month)) yearMap.set(month, []);
    yearMap.get(month)!.push(post);
  }

  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, monthMap]) => ({
      year,
      months: [...monthMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([month, monthPosts]) => ({
          month,
          posts: monthPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        })),
    }));
}

export default async function Archive() {
  let posts: PostListItem[] = [];
  try {
    const response = await fetchFromServerApi<{ items: PostListItem[] }>(`/posts?page=1&size=100&include_hidden=true`, {
      revalidate,
    });
    posts = response?.items ?? [];
  } catch {
    // 构建时后端不可用
  }

  const timeline = toYearBuckets(posts);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-6 md:mb-8 min-h-[150px] md:min-h-[170px]">
        <p className="text-xs tracking-[0.35em] text-[var(--color-foreground-secondary)] mb-3 uppercase">
          Memory Bank
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold text-[var(--color-foreground)] mb-4"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          档案回顾
        </h1>
        <p className="text-[var(--color-foreground-secondary)] leading-8 max-w-3xl">
          该档案系统用于结构化沉淀项目实践、技术研究与方法论复盘。
          所有内容按时间轴索引，当前累计收录 {posts.length} 篇可检索文章。
        </p>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-[var(--color-foreground)] mb-2">暂无文章</h3>
          <p className="text-[var(--color-foreground-secondary)]">稍后再来看看吧</p>
        </div>
      ) : (
        <div className="space-y-14">
          {timeline.map((yearBlock, yearIndex) => (
            <section key={yearBlock.year} className="space-y-7">
              <div className="flex items-end gap-5">
                <div className="w-1 h-14 bg-[var(--color-primary)] rounded-full" />
                <div>
                  <h2
                    className="text-5xl md:text-6xl font-bold text-[var(--color-foreground)] leading-none"
                    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  >
                    {yearBlock.year}
                  </h2>
                  <p className="text-sm text-[var(--color-foreground-secondary)] mt-2">
                    {yearIndex === 0 ? '当前年度' : '历史归档'}
                  </p>
                </div>
              </div>

              {yearBlock.months.map((monthBlock) => (
                <div key={`${yearBlock.year}-${monthBlock.month}`} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-semibold text-[var(--color-foreground)] min-w-[76px]">
                      {formatMonthZh(monthBlock.month)}
                    </h3>
                    <div className="h-px bg-[var(--color-border)] flex-1" />
                  </div>

                  <div className="space-y-4">
                    {monthBlock.posts.map((post) => (
                      <Link
                        key={post.id}
                        href={`/post/${post.slug}`}
                        className="group block bg-[var(--color-background)] border border-[var(--color-border)] rounded-[10px] p-5 md:p-6 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-card)] transition-all duration-300"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h4
                              className="text-2xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors mb-2 leading-tight"
                              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                            >
                              {post.title}
                            </h4>
                            {post.summary && (
                              <p className="text-[var(--color-foreground-secondary)] leading-relaxed line-clamp-2">
                                {post.summary}
                              </p>
                            )}
                            {post.tags && post.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-4">
                                {post.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-2.5 py-1 text-[11px] font-medium tracking-wide bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] rounded"
                                  >
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--color-foreground-secondary)] shrink-0 mt-1">
                            {formatArchiveItemDate(new Date(post.created_at))}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
