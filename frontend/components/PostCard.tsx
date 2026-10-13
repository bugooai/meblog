import Link from 'next/link';
import { EyeIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { PostListItem } from '@/types';

interface PostCardProps {
  post: PostListItem;
}

export default function PostCard({ post }: PostCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <article className="group bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-300 overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-primary)]">
      <div className="p-6">
        {/* Title */}
        <Link href={`/post/${post.slug}`}>
          <h2 className="text-xl font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors mb-3 line-clamp-2" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {post.title}
          </h2>
        </Link>

        {/* Summary */}
        {post.summary && (
          <p className="text-[var(--color-foreground-secondary)] text-sm leading-relaxed mb-4 line-clamp-3">
            {post.summary}
          </p>
        )}

        {/* Tags (单独一行) */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/tag/${tag.slug}`}
                className="px-2.5 py-1 text-xs font-medium bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] rounded-[6px] hover:bg-[var(--color-background-secondary)] hover:text-[var(--color-foreground-secondary)] transition-colors whitespace-nowrap"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Meta row: 时间 | 项目 | 阅读数 | 阅读全文 */}
        <div className="flex items-center justify-between text-sm text-[var(--color-foreground-secondary)] pt-4 border-t border-[var(--color-border)]">
          {/* Left: 时间 | 项目 | 阅读数 */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              {formatDate(post.created_at)}
            </span>
            {post.project && (
              <Link
                href={`/project/${post.project.slug}`}
                className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              >
                {post.project.name}
              </Link>
            )}
            <span className="flex items-center gap-1">
              <EyeIcon className="w-4 h-4" />
              {post.view_count}
            </span>
          </div>

          {/* Right: 阅读全文 */}
          <Link
            href={`/post/${post.slug}`}
            className="inline-flex items-center gap-1 text-[var(--color-primary)] font-medium hover:gap-2 transition-all"
          >
            阅读全文
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}