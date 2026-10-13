'use client';

import { useTheme } from '@/context/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const handleToggle = () => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2.5 rounded-lg bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] border border-[var(--color-border)] hover:text-[var(--color-foreground)] hover:border-[var(--color-primary)] transition-all duration-200 hover:scale-105 active:scale-95"
      title={`当前: ${resolvedTheme === 'dark' ? '深色' : '浅色'}模式，点击切换`}
    >
      {resolvedTheme === 'dark' ? (
        <SunIcon className="w-5 h-5 text-[var(--color-primary-hover)]" />
      ) : (
        <MoonIcon className="w-5 h-5 text-[var(--color-foreground-secondary)]" />
      )}
    </button>
  );
}
