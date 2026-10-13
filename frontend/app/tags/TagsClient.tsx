'use client';

import Link from 'next/link';
import type { Tag } from '@/types';

interface TagWithCount extends Tag {
  post_count?: number;
}

interface TagsClientProps {
  initialTags: TagWithCount[];
}

export default function TagsClient({ initialTags }: TagsClientProps) {
  const tags = initialTags || [];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-6 md:mb-8 min-h-[150px] md:min-h-[170px]">
        <p className="text-xs tracking-[0.3em] text-[var(--color-foreground-secondary)] mb-3 uppercase">Knowledge Tags</p>
        <h1
          className="text-4xl md:text-5xl font-bold text-[var(--color-foreground)] mb-4"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          技术体系标签
        </h1>
        <p className="text-[var(--color-foreground-secondary)] max-w-3xl leading-8">
          按领域组织的技术知识库，快速探索我在工程与 AI 方向的实践沉淀。
        </p>
      </div>

      {!tags || tags.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-[var(--color-foreground)] mb-2">暂无标签</h3>
          <p className="text-[var(--color-foreground-secondary)]">稍后再来看看吧</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => {
            const count = tag.post_count || 0;
            return (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="group p-6 rounded-2xl bg-[var(--color-background)]/80 backdrop-blur border border-[var(--color-border)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 transition"
              >
                <div className="flex items-center justify-between">
                  <h2
                    className="text-xl font-semibold text-[var(--color-foreground)]"
                    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  >
                    {tag.name}
                  </h2>
                  <span className="opacity-0 group-hover:opacity-100 transition text-[var(--color-foreground-secondary)]">→</span>
                </div>
                <p className="mt-4 text-sm text-[var(--color-foreground-secondary)]">
                  {count} {count === 1 ? 'Article' : 'Articles'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
