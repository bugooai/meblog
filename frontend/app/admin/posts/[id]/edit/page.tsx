'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/api/posts';
import { projectsApi } from '@/api/project';
import { tagsApi } from '@/api/tags';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import AdminGuard from '@/components/AdminGuard';
import OssUploadInput from '@/components/OssUploadInput';
import { filesApi } from '@/api/files';

export default function AdminPostEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isHidden, setIsHidden] = useState(false);
  const [error, setError] = useState('');
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: () => postsApi.getById(id, { include_unpublished: true, include_hidden: true }),
    enabled: !!id,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'admin-visible'],
    queryFn: () => projectsApi.getAll({ include_hidden: true }),
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', 'admin-visible'],
    queryFn: () => tagsApi.getAll({ include_hidden: true }),
  });

  useEffect(() => {
    if (!post) return;
    setTitle(post.title);
    setCover(post.cover || '');
    setContent(post.content);
    setSummary(post.summary || '');
    setProjectId(post.project?.id || null);
    setTagIds(post.tags.map((t) => t.id));
    setStatus(post.status as 'draft' | 'published');
    setIsHidden(Boolean(post.is_hidden));
  }, [post]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => postsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      router.push('/admin/posts');
    },
    onError: (err: any) => setError(err.response?.data?.detail || '更新失败'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    updateMutation.mutate({
      title,
      cover: cover.trim() || null,
      content,
      summary,
      project_id: projectId,
      tag_ids: tagIds,
      status,
      is_hidden: isHidden,
    });
  };

  const handleTagToggle = (tagId: string) => {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((tid) => tid !== tagId) : [...prev, tagId]));
  };

  const insertInlineImageMarkdown = (imageUrl: string, filename: string) => {
    const textarea = contentTextareaRef.current;
    const safeFilename = filename.replace(/\.[^/.]+$/, '') || '图片';
    const markdown = `\n![${safeFilename}](${imageUrl})\n`;
    if (!textarea) {
      setContent((prev) => `${prev}${markdown}`);
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const nextContent = `${content.slice(0, start)}${markdown}${content.slice(end)}`;
    const nextCursor = start + markdown.length;
    setContent(nextContent);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handlePickInlineImage = () => {
    inlineImageInputRef.current?.click();
  };

  const handleInlineImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingInlineImage(true);
    try {
      const uploaded = await filesApi.upload(file, 'posts/content');
      const imageUrl = uploaded.storage_key || uploaded.url;
      if (!imageUrl) {
        throw new Error('图片上传成功但未返回可用地址');
      }
      insertInlineImageMarkdown(imageUrl, file.name);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '正文图片上传失败');
    } finally {
      setUploadingInlineImage(false);
      event.target.value = '';
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]';
  const labelClass = 'block text-sm font-medium text-[var(--color-foreground)] mb-1';
  const sectionClass = 'p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] space-y-4';

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            编辑文章
          </h1>
          <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
            修改文章内容、封面与发布状态，保存后会同步刷新列表数据。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
          <Link
            href="/admin"
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            返回管理后台
          </Link>
          <Link
            href="/admin/posts"
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            返回文章列表
          </Link>
        </div>

        {postLoading && <div className="text-center py-12 text-[var(--color-foreground-secondary)]">加载中...</div>}
        {error && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{error}</div>}

        {!postLoading && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-6 shadow-[var(--shadow-card)]">
            <div className={sectionClass}>
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">基础信息</h2>
              <label className={labelClass}>标题</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />

              <OssUploadInput
                label="封面图片 URL（可选）"
                value={cover}
                onChange={setCover}
                folder="posts/covers"
                placeholder="https://example.com/cover.jpg"
              />

              <label className={labelClass}>项目（可选）</label>
              <select value={projectId || ''} onChange={(e) => setProjectId(e.target.value || null)} className={inputClass}>
                <option value="">无项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={sectionClass}>
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">标签与可见性</h2>
              <label className={labelClass}>标签</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => handleTagToggle(tag.id)} className={`px-3 py-1 text-sm rounded-full transition-colors ${tagIds.includes(tag.id) ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] hover:opacity-90'}`}>
                    {tag.name}
                  </button>
                ))}
              </div>

              <label className={labelClass}>状态</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value="draft" checked={status === 'draft'} onChange={() => setStatus('draft')} className="w-4 h-4 text-blue-600" />
                  <span className="text-[var(--color-foreground)]">草稿</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value="published" checked={status === 'published'} onChange={() => setStatus('published')} className="w-4 h-4 text-blue-600" />
                  <span className="text-[var(--color-foreground)]">发布</span>
                </label>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHidden}
                  onChange={(e) => setIsHidden(e.target.checked)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-[var(--color-foreground)]">隐藏文章（前台不展示）</span>
              </label>
            </div>

            <div className={sectionClass}>
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">正文内容</h2>
              <div className="flex items-center justify-between gap-3">
                <label className={labelClass}>正文 (Markdown)</label>
                <button
                  type="button"
                  onClick={handlePickInlineImage}
                  disabled={uploadingInlineImage}
                  className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-60 transition-colors"
                >
                  {uploadingInlineImage ? '上传中...' : '插入图片'}
                </button>
                <input
                  ref={inlineImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInlineImageChange}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <textarea
                  ref={contentTextareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`${inputClass} h-96 font-mono text-sm`}
                  required
                />
                <div className="h-96 overflow-auto bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
                  <MarkdownRenderer content={content || '*预览区域*'} />
                </div>
              </div>

              <label className={labelClass}>摘要（可选）</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className={`${inputClass} h-24`} />
            </div>

            <div className="flex gap-4">
              <button type="submit" disabled={updateMutation.isPending} className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
              <button type="button" onClick={() => router.push('/admin/posts')} className="px-6 py-2 bg-[var(--color-background-secondary)] text-[var(--color-foreground)] rounded-lg hover:bg-[var(--color-border)]">
                取消
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminGuard>
  );
}
