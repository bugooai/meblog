'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { postsApi } from '@/api/posts';
import AdminGuard from '@/components/AdminGuard';
import CoverImage from '@/components/CoverImage';

export default function AdminPostsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-posts', page],
    queryFn: () => postsApi.getAll({ page, size: 20, include_unpublished: true, include_hidden: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: postsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这篇文章吗？')) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              文章管理
            </h1>
            <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
              管理文章内容、发布状态、封面与可见性。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors">
              返回管理后台
            </Link>
            <Link href="/admin/posts/new" className="px-4 py-2 bg-blue-600 !text-white rounded-lg hover:bg-blue-700 hover:!text-white">
              新建文章
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-[var(--color-foreground-secondary)]">加载中...</div>
        ) : (
          <div className="bg-[var(--color-background)] rounded-xl shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-background-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">标题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">封面</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">是否隐藏</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">项目</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">创建时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data?.items.map((post) => (
                  <tr key={post.id} className="hover:bg-[var(--color-background-secondary)]/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/post/${post.slug}`} className="!text-[var(--color-foreground)] hover:!text-[var(--color-primary)]">
                        {post.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">
                      {post.cover ? (
                        <CoverImage
                          src={post.cover}
                          alt={post.title}
                          className="w-16 h-10 object-cover rounded border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('px-2.5 py-1 text-xs rounded-full font-medium', post.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                        {post.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">
                      {post.is_hidden ? '是' : '否'}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{post.project?.name || '-'}</td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{formatDate(post.created_at)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link href={`/admin/posts/${post.id}/edit`} className="!text-[var(--color-primary)] hover:underline">
                        编辑
                      </Link>
                      <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:underline">
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.items.length === 0 && (
              <div className="text-center py-12 text-[var(--color-foreground-secondary)]">
                暂无文章，<Link href="/admin/posts/new" className="!text-blue-600 hover:underline">创建第一篇</Link>
              </div>
            )}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={clsx('w-10 h-10 rounded-lg text-sm border transition-colors', p === page ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-foreground-secondary)] border-[var(--color-border)] hover:bg-[var(--color-background-secondary)]')}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
