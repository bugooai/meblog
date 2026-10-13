'use client';

interface FooterProps {
  githubUrl?: string | null;
  beianIcp?: string | null;
}

export default function Footer({ githubUrl, beianIcp }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--color-foreground-secondary)]">
        {beianIcp ? <span>{beianIcp}</span> : null}
        {githubUrl ? (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
              <path d="M12 .5C5.65.5.5 5.73.5 12.2c0 5.18 3.3 9.57 7.88 11.12.57.1.77-.25.77-.56v-2.03c-3.2.71-3.87-1.58-3.87-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.04-.73.08-.72.08-.72 1.15.08 1.76 1.2 1.76 1.2 1.02 1.79 2.69 1.27 3.34.97.1-.76.4-1.27.73-1.57-2.55-.3-5.23-1.3-5.23-5.8 0-1.28.45-2.32 1.18-3.14-.12-.3-.51-1.52.11-3.17 0 0 .97-.32 3.19 1.2a10.9 10.9 0 0 1 5.8 0c2.21-1.52 3.18-1.2 3.18-1.2.63 1.65.24 2.87.12 3.17.73.82 1.18 1.86 1.18 3.14 0 4.52-2.68 5.5-5.24 5.8.42.37.78 1.08.78 2.18v3.23c0 .31.2.67.78.56A11.72 11.72 0 0 0 23.5 12.2C23.5 5.73 18.35.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
              <path d="M12 .5C5.65.5.5 5.73.5 12.2c0 5.18 3.3 9.57 7.88 11.12.57.1.77-.25.77-.56v-2.03c-3.2.71-3.87-1.58-3.87-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.04-.73.08-.72.08-.72 1.15.08 1.76 1.2 1.76 1.2 1.02 1.79 2.69 1.27 3.34.97.1-.76.4-1.27.73-1.57-2.55-.3-5.23-1.3-5.23-5.8 0-1.28.45-2.32 1.18-3.14-.12-.3-.51-1.52.11-3.17 0 0 .97-.32 3.19 1.2a10.9 10.9 0 0 1 5.8 0c2.21-1.52 3.18-1.2 3.18-1.2.63 1.65.24 2.87.12 3.17.73.82 1.18 1.86 1.18 3.14 0 4.52-2.68 5.5-5.24 5.8.42.37.78 1.08.78 2.18v3.23c0 .31.2.67.78.56A11.72 11.72 0 0 0 23.5 12.2C23.5 5.73 18.35.5 12 .5Z" />
            </svg>
            <span>GitHub</span>
          </span>
        )}
      </div>
    </footer>
  );
}
