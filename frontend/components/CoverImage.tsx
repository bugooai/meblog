'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { buildCoverFallbackCandidates } from '@/app/lib/cover-fallback';
import { isSignableOssMediaUrl, resolveSignedMediaUrl } from '@/app/lib/media-url';

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderSrc?: string;
}

export default function CoverImage({
  src,
  alt,
  className,
  placeholderSrc = '/cover-placeholder.svg',
}: CoverImageProps) {
  // Cache signed URL per src with TTL to avoid repeated resolution calls.
  // oss-signature 有效期默认 3600s，不应永久缓存。
  type CacheEntry = { url: string; expiresAt: number }; // expiresAt = Date.now() + ttl_ms
  const cacheRef = useRef<Record<string, CacheEntry>>({});
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    // Hydration-safe initial value: use src directly; signed resolution runs in useEffect.
    return src;
  });

  useEffect(() => {
    // Return early if already cached and not expired.
    const cached = cacheRef.current[src];
    if (cached && Date.now() < cached.expiresAt) {
      setResolvedSrc(cached.url);
      return;
    }

    let cancelled = false;
    const resolveSrc = async () => {
      if (!src || !isSignableOssMediaUrl(src)) {
        // 非 OSS URL 不过期，缓存一个极大值
        cacheRef.current[src] = { url: src, expiresAt: Number.MAX_SAFE_INTEGER };
        if (!cancelled) setResolvedSrc(src);
        return;
      }
      try {
        const { signed_url, expires_in } = await resolveSignedMediaUrl(src);
        const entry = { url: signed_url, expiresAt: Date.now() + expires_in * 1000 };
        cacheRef.current[src] = entry;
        if (!cancelled) setResolvedSrc(signed_url);
      } catch {
        if (!cancelled) setResolvedSrc(src);
      }
    };
    resolveSrc();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const candidates = useMemo(() => {
    const fallbackCandidates = buildCoverFallbackCandidates(resolvedSrc, {
      giteeAssetsBase: process.env.NEXT_PUBLIC_GITEE_ASSETS_BASE || null,
    });
    return Array.from(new Set([...fallbackCandidates, placeholderSrc]));
  }, [resolvedSrc, placeholderSrc]);

  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [resolvedSrc, placeholderSrc]);

  const currentSrc = candidates[candidateIndex] || placeholderSrc;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => {
        setCandidateIndex((current) => (current < candidates.length - 1 ? current + 1 : current));
      }}
    />
  );
}
