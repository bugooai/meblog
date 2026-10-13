import { useEffect, useCallback } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/solid';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: TocItem[];
  onClose?: () => void;
}

export default function TableOfContents({ headings, onClose }: TableOfContentsProps) {
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Update active state via CSS class
            const allButtons = document.querySelectorAll('.toc-item');
            allButtons.forEach((btn) => btn.classList.remove('active'));
            const activeBtn = document.querySelector(`.toc-item[data-id="${entry.target.id}"]`);
            activeBtn?.classList.add('active');
          }
        });
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Account for sticky navbar (h-16 = 64px + some buffer)
      const navbarHeight = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navbarHeight,
        behavior: 'smooth'
      });
      // Close panel after scroll animation starts
      setTimeout(() => {
        onClose?.();
      }, 150);
    }
  }, [onClose]);

  if (headings.length === 0) {
    return (
      <p className="text-sm text-[var(--color-foreground-secondary)]">
        暂无目录
      </p>
    );
  }

  return (
    <nav className="space-y-0.5">
      {headings.map((item) => (
        <button
          key={item.id}
          data-id={item.id}
          onClick={() => handleClick(item.id)}
          className={`toc-item w-full text-left text-sm py-1.5 px-3 rounded transition-all flex items-start gap-1 hover:bg-[var(--color-background-secondary)]`}
          style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
        >
          <ChevronRightIcon className="w-3 h-3 mt-1.5 flex-shrink-0 opacity-50" />
          <span className="line-clamp-2 text-[var(--color-foreground)]">{item.text}</span>
        </button>
      ))}
      
      <style>{`
        .toc-item.active {
          color: var(--color-primary);
          background-color: var(--color-primary-light);
        }
        .toc-item.active span {
          font-weight: 500;
        }
      `}</style>
    </nav>
  );
}
