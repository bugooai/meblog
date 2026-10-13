interface SocialLinksProps {
  github_url: string | null;
  zhihu_url: string | null;
  twitter_url: string | null;
  wechat_id: string | null;
}

export default function SocialLinks({ github_url, zhihu_url, twitter_url, wechat_id }: SocialLinksProps) {
  const links = [
    github_url && {
      label: 'GitHub',
      url: github_url,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      ),
      color: 'hover:text-[var(--color-primary-hover)]',
    },
    zhihu_url && {
      label: '知乎',
      url: zhihu_url,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.558C21.751 24 24 21.749 24 18.28V5.72C24 2.249 21.749 0 18.279 0H5.721zm12.026 14.006c-1.466 1.466-3.895 1.466-5.362 0L8.26 9.88l-.526-.527c-.39-1.837.237-3.536 1.945-4.05 1.653-.498 3.129.788 3.129.788.395-.527 1.053-.658 1.578-.395.526.263.79.92.658 1.447l-.79 3.011c-.395 1.317-.526 2.501-.263 3.552h1.58l1.317-1.317 1.316-1.316V4.34s.132-1.713-1.448-2.34c-1.579-.658-3.552.79-4.214 1.714-.395.658-.263 1.58-.132 2.37l.658 2.766-2.37 2.37-2.896-2.9s-.395-3.292-2.634-3.292c-1.712 0-3.026 1.448-3.026 3.292v9.47s.263 3.026 2.766 3.026h7.11s2.634.132 2.634-2.766v-1.712h1.844l.79-1.316v-3.42s-.132-1.448-1.053-2.238z"/>
        </svg>
      ),
      color: 'hover:text-[var(--color-primary-hover)]',
    },
    twitter_url && {
      label: 'Twitter',
      url: twitter_url,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'hover:text-[var(--color-primary-hover)]',
    },
    wechat_id && {
      label: `微信: ${wechat_id}`,
      url: null,
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.87c-.135-.004-.272-.014-.406-.012zM14.4 9.34c-.642 0-1.162.529-1.162 1.18a1.17 1.17 0 001.162 1.178c.642 0 1.162-.528 1.162-1.178 0-.651-.52-1.18-1.162-1.18zm4.183 0c-.642 0-1.162.529-1.162 1.18a1.17 1.17 0 001.162 1.178c.642 0 1.162-.528 1.162-1.178 0-.651-.52-1.18-1.162-1.18z"/>
        </svg>
      ),
      color: 'hover:text-[var(--color-primary-hover)]',
    },
  ].filter(Boolean) as { label: string; url: string | null; icon: React.ReactNode; color: string }[];

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center gap-4">
      {links.map((link, index) => (
        <div key={index} className="relative group">
          {link.url ? (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] ${link.color} transition-all hover:bg-[var(--color-border)]`}
              title={link.label}
            >
              {link.icon}
            </a>
          ) : (
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] cursor-default"
              title={link.label}
            >
              {link.icon}
            </div>
          )}
          {/* Tooltip */}
          {link.url && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--color-background-secondary)] border border-[var(--color-border)] text-[var(--color-foreground)] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {link.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
