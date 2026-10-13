import clsx from 'clsx';
import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  getPageHref?: (page: number) => string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  getPageHref,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const hasHref = typeof getPageHref === 'function';

  const renderPageControl = (page: number, label: string, disabled = false, isActive = false) => {
    const className = clsx(
      'inline-flex items-center justify-center select-none transition-colors',
      label === '上一页' || label === '下一页'
        ? 'px-4 h-10 rounded-[10px] text-sm border'
        : 'w-10 h-10 rounded-[10px] text-sm border font-medium',
      disabled
        ? 'text-[var(--color-foreground-secondary)] border-[var(--color-border)] cursor-not-allowed opacity-50'
        : isActive
          ? 'bg-[var(--color-primary)] !text-white border-[var(--color-primary)] font-semibold shadow-sm'
          : 'text-[var(--color-foreground)] border-[var(--color-border)] hover:bg-[var(--color-background-secondary)]'
    );

    if (hasHref) {
      const href = getPageHref!(page);
      return (
        <Link
          href={disabled ? '#' : href}
          aria-disabled={disabled}
          aria-current={isActive ? 'page' : undefined}
          className={clsx(className, disabled && 'pointer-events-none')}
        >
          {label}
        </Link>
      );
    }

    return (
      <button
        onClick={() => onPageChange?.(page)}
        disabled={disabled}
        aria-current={isActive ? 'page' : undefined}
        className={className}
      >
        {label}
      </button>
    );
  };

  return (
    <nav className="flex justify-center gap-2 mt-8">
      {/* Previous */}
      {renderPageControl(
        Math.max(1, Math.min(currentPage - 1, totalPages)),
        '上一页',
        currentPage === 1
      )}

      {/* Page numbers */}
      {pages.map((page) => (
        <span key={page}>{renderPageControl(page, String(page), false, page === currentPage)}</span>
      ))}

      {/* Next */}
      {renderPageControl(
        Math.max(1, Math.min(currentPage + 1, totalPages)),
        '下一页',
        currentPage === totalPages
      )}
    </nav>
  );
}
