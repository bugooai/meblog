'use client';

import { useEffect } from 'react';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  icon?: string;
  title: string;
  description: string;
  logPrefix: string;
  retryLabel?: string;
}

export default function RouteError({
  error,
  reset,
  icon = '⚠️',
  title,
  description,
  logPrefix,
  retryLabel = '重新加载',
}: RouteErrorProps) {
  useEffect(() => {
    console.error(`${logPrefix}:`, error);
  }, [error, logPrefix]);

  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-2xl font-semibold text-[var(--color-foreground)] mb-2">{title}</h2>
      <p className="text-[var(--color-foreground-secondary)] mb-6">{description}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
      >
        {retryLabel}
      </button>
    </div>
  );
}
