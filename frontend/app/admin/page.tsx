'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import { useAuth } from '@/context/AuthContext';
import AdminGuard from '@/components/AdminGuard';

export default function AdminPage() {
  const { user } = useAuth();
  const { data: dashboard, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: statsApi.getAdminDashboard,
  });

  return (
    <AdminGuard>
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] mb-8" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          管理后台
        </h1>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 mb-6 border border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-2">
            欢迎回来，{user?.username}！
          </h2>
          <p className="text-[var(--color-foreground-secondary)]">
            这里是你博客的管理后台，可以管理文章、项目、标签和站点配置。
          </p>
        </div>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 mb-8 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">快捷操作</h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/admin/posts/new" className="px-4 py-2 bg-[var(--color-primary)] !text-white rounded-[8px] hover:bg-[var(--color-primary-hover)] hover:!text-white transition-colors">
              写文章
            </Link>
            <Link href="/" className="px-4 py-2 bg-[var(--color-background-secondary)] !text-[var(--color-foreground)] rounded-[8px] hover:bg-[var(--color-border)] hover:!text-[var(--color-foreground)] transition-colors">
              查看博客
            </Link>
            <Link href="/admin/settings" className="px-4 py-2 bg-[var(--color-background-secondary)] !text-[var(--color-foreground)] rounded-[8px] hover:bg-[var(--color-border)] hover:!text-[var(--color-foreground)] transition-colors">
              打开设置
            </Link>
            <Link href="/admin/stats" className="px-4 py-2 bg-[var(--color-background-secondary)] !text-[var(--color-foreground)] rounded-[8px] hover:bg-[var(--color-border)] hover:!text-[var(--color-foreground)] transition-colors">
              统计信息
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          <Link href="/admin/posts" className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-[var(--color-primary)] mb-2">文章</h3>
            <p className="text-[var(--color-foreground-secondary)]">管理你的文章</p>
          </Link>

          <Link href="/admin/projects" className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-emerald-500 mb-2">项目</h3>
            <p className="text-[var(--color-foreground-secondary)]">管理文章项目</p>
          </Link>

          <Link href="/admin/tags" className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-purple-500 mb-2">标签</h3>
            <p className="text-[var(--color-foreground-secondary)]">管理文章标签</p>
          </Link>

          <Link href="/admin/settings/site" className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-cyan-500 mb-2">网站设置</h3>
            <p className="text-[var(--color-foreground-secondary)]">管理公众号和站点展示配置</p>
          </Link>

          <Link href="/admin/settings/author" className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-amber-500 mb-2">作者设置</h3>
            <p className="text-[var(--color-foreground-secondary)]">管理作者资料与社交链接</p>
          </Link>
        </div>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 mb-8 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">统计概览</h3>
          {statsLoading ? (
            <div className="text-[var(--color-foreground-secondary)]">统计加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-sm text-[var(--color-foreground-secondary)]">总访问数</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{dashboard?.total_visits ?? 0}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-sm text-[var(--color-foreground-secondary)]">总留言数</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{dashboard?.total_comments ?? 0}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-sm text-[var(--color-foreground-secondary)]">今日新增访问</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{dashboard?.today_new_visits ?? 0}</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4">
                <p className="text-sm text-[var(--color-foreground-secondary)]">今日新增留言</p>
                <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{dashboard?.today_new_comments ?? 0}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
