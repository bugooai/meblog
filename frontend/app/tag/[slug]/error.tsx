'use client';

import RouteError from '@/components/RouteError';

interface TagErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TagError({ error, reset }: TagErrorProps) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="标签页加载失败"
      description="当前页面暂时不可用，请稍后重试。"
      logPrefix="Tag page render error"
    />
  );
}
