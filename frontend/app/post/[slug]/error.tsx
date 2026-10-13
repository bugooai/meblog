'use client';

import RouteError from '@/components/RouteError';

interface PostErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PostError({ error, reset }: PostErrorProps) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="文章加载失败"
      description="请稍后重试，或刷新页面后再次访问。"
      logPrefix="Post page render error"
    />
  );
}
