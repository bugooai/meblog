'use client';

import { useEffect, useRef, useState } from 'react';
import { filesApi } from '@/api/files';

interface OssUploadInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  folder: string;
  placeholder?: string;
  accept?: string;
  showPreview?: boolean;
}

export default function OssUploadInput({
  label,
  value,
  onChange,
  folder,
  placeholder,
  accept = 'image/*',
  showPreview = true,
}: OssUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  const localBlobUrlRef = useRef<string>('');

  useEffect(() => {
    setPreviewFailed(false);
    let cancelled = false;
    let effectBlobUrl = '';
    const resolvePreview = async () => {
      if (!value) {
        if (localBlobUrlRef.current) {
          URL.revokeObjectURL(localBlobUrlRef.current);
          localBlobUrlRef.current = '';
        }
        setPreviewSrc('');
        return;
      }
      try {
        const sourceUrl = value.startsWith('oss://')
          ? (await filesApi.getSignedUrl(value)).signed_url
          : value;
        const imageResp = await fetch(sourceUrl);
        if (!imageResp.ok) throw new Error('Failed to fetch preview image');
        const blob = await imageResp.blob();
        effectBlobUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          if (localBlobUrlRef.current) {
            URL.revokeObjectURL(localBlobUrlRef.current);
          }
          localBlobUrlRef.current = effectBlobUrl;
          setPreviewSrc(effectBlobUrl);
        }
      } catch {
        if (!cancelled) {
          setPreviewSrc('');
          setPreviewFailed(true);
        }
      }
    };
    resolvePreview();
    return () => {
      cancelled = true;
      if (effectBlobUrl && effectBlobUrl !== localBlobUrlRef.current) {
        URL.revokeObjectURL(effectBlobUrl);
      }
    };
  }, [value]);

  useEffect(() => {
    return () => {
      if (localBlobUrlRef.current) {
        URL.revokeObjectURL(localBlobUrlRef.current);
      }
    };
  }, []);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const uploaded = await filesApi.upload(file, folder);
      onChange(uploaded.storage_key || uploaded.url);
      setPreviewFailed(false);
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || '上传失败，请稍后重试');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--color-foreground)]">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={handlePickFile}
          disabled={uploading}
          className="shrink-0 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-60 transition-colors"
        >
          {uploading ? '上传中...' : '上传到 OSS'}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
      {uploadError ? <p className="text-xs text-[var(--color-danger)]">{uploadError}</p> : null}
      {showPreview && value ? (
        <div className="mt-2">
          <p className="text-xs text-[var(--color-foreground-secondary)] mb-2">预览</p>
          <div className="w-full max-w-sm h-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] overflow-hidden">
            {previewFailed || !previewSrc ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-foreground-secondary)] px-3 text-center">
                预览加载失败，请检查图片是否可公开访问
              </div>
            ) : (
              <img
                key={previewSrc}
                src={previewSrc}
                alt="上传预览"
                className="w-full h-full object-cover"
                onError={() => setPreviewFailed(true)}
                onLoad={() => setPreviewFailed(false)}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
