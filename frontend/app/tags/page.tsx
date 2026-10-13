import TagsClient from './TagsClient';
import type { Tag } from '@/types';
import { fetchFromServerApi } from '@/app/lib/server-api';

export const revalidate = 180;
export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  let tags: Tag[] = [];
  let loadFailed = false;

  try {
    tags = await fetchFromServerApi<Tag[]>('/tags', { revalidate });
  } catch {
    loadFailed = true;
    // Keep page render resilient when API is temporarily unavailable.
  }

  if (loadFailed) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-semibold text-[var(--color-foreground)] mb-2">标签列表加载失败</h2>
        <p className="text-[var(--color-foreground-secondary)]">请稍后刷新页面重试。</p>
      </div>
    );
  }

  return <TagsClient initialTags={tags} />;
}
