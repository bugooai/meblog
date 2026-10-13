'use client';

import { useState, useEffect } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import api from '@/api/client';
import clsx from 'clsx';

interface LikeStatus {
  liked: boolean;
  like_count: number;
}

interface LikeButtonProps {
  slug: string;
  initialLiked?: boolean;
  initialCount?: number;
}

export default function LikeButton({ slug, initialLiked, initialCount = 0 }: LikeButtonProps) {
  const hasInitialLike = typeof initialLiked === 'boolean';
  const [liked, setLiked] = useState<boolean | null>(hasInitialLike ? initialLiked : null);
  const [count, setCount] = useState(initialCount);
  const [initializing, setInitializing] = useState(!hasInitialLike);
  const [loading, setLoading] = useState(false);

  // Initialize status when switching to another post.
  useEffect(() => {
    const hasInitial = typeof initialLiked === 'boolean';
    setLiked(hasInitial ? initialLiked : null);
    setCount(initialCount);
    setInitializing(!hasInitial);
    setLoading(false);

    let cancelled = false;
    const loadLikeStatus = async () => {
      try {
        const res = await api.get<LikeStatus>(`/posts/${slug}/like`);
        if (cancelled) return;
        setLiked(res.data.liked);
        setCount(res.data.like_count);
      } catch {
        // Keep fallback values when status query fails.
        if (!cancelled) {
          setLiked(initialLiked ?? false);
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    if (slug && !hasInitial) {
      loadLikeStatus();
    }

    return () => {
      cancelled = true;
    };
  }, [slug, initialLiked, initialCount]);

  const handleLike = async () => {
    if (loading || initializing || liked === null) return;
    setLoading(true);

    // Optimistic update: immediately toggle
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);

    try {
      const res = await api.post<LikeStatus>(`/posts/${slug}/like`);
      // Sync with server response
      setLiked(res.data.liked);
      setCount(res.data.like_count);
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading || initializing || liked === null}
      className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200',
        'border focus:outline-none focus:ring-2 focus:ring-offset-2',
        liked === null
          ? 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground-secondary)]'
          : liked
          ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger-soft)] text-[var(--color-danger)] focus:ring-[var(--color-danger)]'
          : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground-secondary)] hover:border-[var(--color-danger)]/50 hover:text-[var(--color-danger)] focus:ring-[var(--color-border)]',
        (loading || initializing || liked === null) && 'opacity-60 cursor-not-allowed'
      )}
      aria-label={liked ? '取消点赞' : '点赞'}
    >
      {liked ? (
        <HeartIconSolid className="w-5 h-5" />
      ) : (
        <HeartIcon className="w-5 h-5" />
      )}
      <span className="font-medium text-sm">{count}</span>
    </button>
  );
}
