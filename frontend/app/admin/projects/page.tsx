'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/project';
import AdminGuard from '@/components/AdminGuard';
import CoverImage from '@/components/CoverImage';
import OssUploadInput from '@/components/OssUploadInput';

export default function AdminProjectsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [cover, setCover] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [error, setError] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', 'admin-visible'],
    queryFn: () => projectsApi.getAll({ include_hidden: true }),
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.detail || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, cover, is_hidden }: { id: string; name: string; cover?: string | null; is_hidden?: boolean }) =>
      projectsApi.update(id, { name, cover, is_hidden }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      closeModal();
    },
    onError: (err: any) => setError(err.response?.data?.detail || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (err: any) => alert(err.response?.data?.detail || '删除失败'),
  });

  const openModal = (project?: { id: string; name: string; cover?: string | null; is_hidden?: boolean }) => {
    if (project) {
      setEditingId(project.id);
      setName(project.name);
      setCover(project.cover || '');
      setIsHidden(Boolean(project.is_hidden));
    } else {
      setEditingId(null);
      setName('');
      setCover('');
      setIsHidden(false);
    }
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setName('');
    setCover('');
    setEditingId(null);
    setIsHidden(false);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) updateMutation.mutate({ id: editingId, name, cover: cover.trim() || null, is_hidden: isHidden });
    else createMutation.mutate({ name, cover: cover.trim() || null, is_hidden: isHidden });
  };

  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              项目管理
            </h1>
            <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
              管理项目名称、封面、可见性及文章归属。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors">
              返回管理后台
            </Link>
            <button onClick={() => openModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              新建项目
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">封面</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">可见性</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">文章数</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-foreground-secondary)] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-[var(--color-background-secondary)]/60 transition-colors">
                    <td className="px-6 py-4 text-[var(--color-foreground)]">{project.name}</td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{project.slug}</td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">
                      {project.cover ? (
                        <CoverImage
                          src={project.cover}
                          alt={project.name}
                          className="w-16 h-10 object-cover rounded border border-gray-200 dark:border-gray-700"
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">
                      {project.is_hidden ? '隐藏' : '显示'}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-foreground-secondary)]">{project.post_count || 0}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openModal(project)} className="text-[var(--color-primary)] hover:underline">编辑</button>
                      <button onClick={() => confirm('确定要删除这个项目吗？') && deleteMutation.mutate(project.id)} className="text-red-500 hover:underline">删除</button>
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
              <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">{editingId ? '编辑项目' : '新建项目'}</h2>
              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">名称</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)]" autoFocus />
                </div>
                <div className="mb-4">
                  <OssUploadInput
                    label="封面图片 URL（可选）"
                    value={cover}
                    onChange={setCover}
                    folder="projects/covers"
                    placeholder="https://example.com/project-cover.jpg"
                  />
                </div>
                <div className="mb-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-foreground)]">
                    <input
                      type="checkbox"
                      checked={isHidden}
                      onChange={(e) => setIsHidden(e.target.checked)}
                      className="w-4 h-4 text-blue-600"
                    />
                    隐藏项目（前台不展示）
                  </label>
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
