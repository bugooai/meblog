import { filesApi } from '@/api/files';

const ALIYUN_OSS_HTTP_PATTERN = /^https?:\/\/[^/]+\.aliyuncs\.com\/.+/i;

export function isSignableOssMediaUrl(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('oss://')) return true;
  return ALIYUN_OSS_HTTP_PATTERN.test(src);
}

export async function resolveSignedMediaUrl(
  src: string,
): Promise<{ signed_url: string; expires_in: number }> {
  if (!isSignableOssMediaUrl(src)) {
    return { signed_url: src, expires_in: Number.MAX_SAFE_INTEGER };
  }
  const result = await filesApi.getSignedUrl(src);
  return result;
}
