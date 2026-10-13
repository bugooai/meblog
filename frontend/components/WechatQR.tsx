'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi } from '@/api/settings';

interface WechatQRProps {
  /** Display variant: article-end (larger, full-width) or sidebar (compact) */
  variant?: 'article-end' | 'sidebar';
}

export default function WechatQR({ variant = 'article-end' }: WechatQRProps) {
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: siteSettingsApi.getSiteSettings,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const [displayQrUrl, setDisplayQrUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    let localBlobUrl = '';
    const sourceUrl = siteSettings?.wechat_qr_url;
    if (!sourceUrl) {
      setDisplayQrUrl('');
      return () => {};
    }

    const loadToLocalBlob = async () => {
      try {
        const resp = await fetch(sourceUrl);
        if (!resp.ok) throw new Error('Failed to fetch QR image');
        const blob = await resp.blob();
        localBlobUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setDisplayQrUrl(localBlobUrl);
        }
      } catch {
        if (!cancelled) {
          setDisplayQrUrl(sourceUrl);
        }
      }
    };

    loadToLocalBlob();

    return () => {
      cancelled = true;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [siteSettings?.wechat_qr_url]);

  const resolvedQrUrl = displayQrUrl || siteSettings?.wechat_qr_url || '';

  const handleQrLoadError = () => {
    // Keep current source and avoid extra network retries.
    try {
      console.warn('Failed to load WeChat QR image');
    } catch {
      // no-op
    }
  };

  // Don't render if disabled
  if (variant === 'article-end' && !siteSettings?.wechat_show_on_article) {
    return null;
  }
  if (variant === 'sidebar' && !siteSettings?.wechat_show_in_sidebar) {
    return null;
  }

  // Don't render if no QR URL configured
  if (!siteSettings?.wechat_qr_url) {
    return null;
  }

  if (variant === 'sidebar') {
    return (
      <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] bg-emerald-500/10">
          <h3 className="font-semibold text-[var(--color-foreground)] flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.87c-.135-.004-.272-.014-.406-.012zM14.4 9.34c-.642 0-1.162.529-1.162 1.18a1.17 1.17 0 001.162 1.178c.642 0 1.162-.528 1.162-1.178 0-.651-.52-1.18-1.162-1.18zm4.183 0c-.642 0-1.162.529-1.162 1.18a1.17 1.17 0 001.162 1.178c.642 0 1.162-.528 1.162-1.178 0-.651-.52-1.18-1.162-1.18z"/>
            </svg>
            关注公众号
          </h3>
        </div>
        <div className="p-4 flex flex-col items-center">
          <img
            src={resolvedQrUrl}
            alt="微信公众号二维码"
            className="w-36 h-36 object-contain rounded-[8px] border border-[var(--color-border)]"
            onError={handleQrLoadError}
          />
          <p className="mt-3 text-xs text-[var(--color-foreground-secondary)] text-center leading-relaxed">
            {siteSettings.wechat_guide_text}
          </p>
        </div>
      </div>
    );
  }

  // article-end variant
  return (
    <div className="mt-12 py-8 border-t border-b border-[var(--color-border)] flex flex-col items-center">
      <div className="flex flex-col items-center">
        <img
          src={resolvedQrUrl}
          alt="微信公众号二维码"
          className="w-48 h-48 object-contain rounded-[12px] border border-[var(--color-border)] shadow-[var(--shadow-card)]"
          onError={handleQrLoadError}
        />
        <p className="mt-4 text-base text-[var(--color-foreground-secondary)] text-center">
          {siteSettings.wechat_guide_text}
        </p>
      </div>
    </div>
  );
}
