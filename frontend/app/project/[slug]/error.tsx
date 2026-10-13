'use client';

import RouteError from '@/components/RouteError';

interface ProjectErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProjectError({ error, reset }: ProjectErrorProps) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="项目加载失败"
      description="当前页面暂时不可用，请稍后再试。"
      logPrefix="Project page render error"
    />
  );
}
