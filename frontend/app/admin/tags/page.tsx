'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '@/api/tags';
import AdminGuard from '@/components/AdminGuard';

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.detail || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => tagsApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.detail || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
    onError: (err: any) => alert(err.response?.data?.detail || '删除失败'),
  });

  const openModal = (tag?: { id: string; name: string }) => {
    if (tag) {
      setEditingId(tag.id);
      setName(tag.name);
    } else {
      setEditingId(null);
      setName('');
    }
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setName('');
    setEditingId(null);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) updateMutation.mutate({ id: editingId, name });
    else createMutation.mutate({ name });
  };

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              标签管理
            </h1>
            <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
              管理标签名称与文章聚合，保持内容分类清晰。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors">
              返回管理后台
            </Link>
            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              新建标签
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-[var(--color-foreground-secondary)]">加载中...</div>
        ) : (
          <div className="bg-[var(--color-background)] rounded-xl shadow-[var(--shadow-card)] border border-[var(--color-border)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-background-secondary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">名称</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">别名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">文章数</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-[var(--color-background-secondary)]/60 transition-colors">
                    <td className="px-6 py-4 text-[var(--color-foreground)]">{tag.name}</td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{tag.slug}</td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{tag.post_count || 0}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(tag)} className="text-[var(--color-primary)] hover:underline">编辑</button>
                      <button onClick={() => confirm('确定要删除这个标签吗？') && deleteMutation.mutate(tag.id)} className="text-red-500 hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-background)] rounded-xl shadow-[var(--shadow-card-hover)] border border-[var(--color-border)] p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">{editingId ? '编辑标签' : '新建标签'}</h2>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">名称</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)]" autoFocus />
                </div>
                <div className="flex gap-4 justify-end">
                  <button type="button" onClick={closeModal} className="px-4 py-2 bg-[var(--color-background-secondary)] text-[var(--color-foreground)] rounded-lg hover:bg-[var(--color-border)]">取消</button>
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
