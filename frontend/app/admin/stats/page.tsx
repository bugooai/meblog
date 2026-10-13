'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats';
import AdminGuard from '@/components/AdminGuard';

export default function AdminStatsPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: statsApi.getAdminDashboard,
  });

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  };

  const clampText = (value: string, max = 80) => {
    if (!value) return '';
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
  };

  return (
    <AdminGuard>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              统计看板
            </h1>
            <p className="text-sm text-[var(--color-foreground-secondary)] mt-1">
              访问、留言、用户活跃度与文章热度的实时汇总。
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-background-secondary)] text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors"
          >
            返回管理后台
          </Link>
        </div>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">统计概览</h3>
          {isLoading ? (
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">今日访问频率最高用户</h3>
            {dashboard?.today_top_visitor ? (
              <div className="space-y-2 text-sm text-[var(--color-foreground-secondary)]">
                <p><span className="text-[var(--color-foreground)]">visitor_id：</span>{dashboard.today_top_visitor.visitor_id}</p>
                <p><span className="text-[var(--color-foreground)]">访问次数：</span>{dashboard.today_top_visitor.access_count}</p>
                <p><span className="text-[var(--color-foreground)]">访客标识：</span>{dashboard.today_top_visitor.visitor_key || '—'}</p>
                <p><span className="text-[var(--color-foreground)]">最后访问：</span>{formatDateTime(dashboard.today_top_visitor.last_access_at)}</p>
                <p className="break-all"><span className="text-[var(--color-foreground)]">User-Agent：</span>{dashboard.today_top_visitor.user_agent || '—'}</p>
                <p className="break-all"><span className="text-[var(--color-foreground)]">Referrer：</span>{dashboard.today_top_visitor.referrer || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-foreground-secondary)]">今日暂无访问数据。</p>
            )}
          </div>

          <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">历史访问频率最高用户</h3>
            {dashboard?.all_time_top_visitor ? (
              <div className="space-y-2 text-sm text-[var(--color-foreground-secondary)]">
                <p><span className="text-[var(--color-foreground)]">visitor_id：</span>{dashboard.all_time_top_visitor.visitor_id}</p>
                <p><span className="text-[var(--color-foreground)]">访问次数：</span>{dashboard.all_time_top_visitor.access_count}</p>
                <p><span className="text-[var(--color-foreground)]">访客标识：</span>{dashboard.all_time_top_visitor.visitor_key || '—'}</p>
                <p><span className="text-[var(--color-foreground)]">首次出现：</span>{formatDateTime(dashboard.all_time_top_visitor.first_seen_at)}</p>
                <p><span className="text-[var(--color-foreground)]">最后访问：</span>{formatDateTime(dashboard.all_time_top_visitor.last_access_at)}</p>
                <p className="break-all"><span className="text-[var(--color-foreground)]">User-Agent：</span>{dashboard.all_time_top_visitor.user_agent || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-foreground-secondary)]">暂无历史访问数据。</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">访问频率最高的文章</h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-[var(--color-foreground-secondary)] mb-1">今日 Top 文章</p>
                {dashboard?.top_post_today ? (
                  <p className="text-[var(--color-foreground)]">
                    <Link href={`/post/${dashboard.top_post_today.slug}`} className="text-[var(--color-primary)] hover:underline">
                      {dashboard.top_post_today.title}
                    </Link>
                    <span className="ml-2 text-[var(--color-foreground-secondary)]">({dashboard.top_post_today.access_count} 次)</span>
                  </p>
                ) : (
                  <p className="text-[var(--color-foreground-secondary)]">今日暂无访问记录。</p>
                )}
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-3">
                <p className="text-[var(--color-foreground-secondary)] mb-1">历史 Top 文章</p>
                {dashboard?.top_post_all_time ? (
                  <p className="text-[var(--color-foreground)]">
                    <Link href={`/post/${dashboard.top_post_all_time.slug}`} className="text-[var(--color-primary)] hover:underline">
                      {dashboard.top_post_all_time.title}
                    </Link>
                    <span className="ml-2 text-[var(--color-foreground-secondary)]">({dashboard.top_post_all_time.access_count} 次)</span>
                  </p>
                ) : (
                  <p className="text-[var(--color-foreground-secondary)]">暂无历史访问记录。</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
            <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">Top 文章榜单</h3>
            {dashboard?.top_posts?.length ? (
              <div className="space-y-2">
                {dashboard.top_posts.slice(0, 10).map((item, index) => (
                  <div key={item.post_id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] px-3 py-2 text-sm">
                    <p className="text-[var(--color-foreground)] min-w-0">
                      <span className="text-[var(--color-foreground-secondary)] mr-2">#{index + 1}</span>
                      <Link href={`/post/${item.slug}`} className="text-[var(--color-primary)] hover:underline">
                        {clampText(item.title, 28)}
                      </Link>
                    </p>
                    <span className="text-[var(--color-foreground-secondary)]">{item.access_count} 次</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-foreground-secondary)]">暂无文章访问记录。</p>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">今日新增留言（含用户信息）</h3>
          {dashboard?.today_new_comment_items?.length ? (
            <div className="space-y-3">
              {dashboard.today_new_comment_items.map((item) => (
                <div key={item.comment_id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-[var(--color-foreground)]">{item.nickname}</span>
                    <span className="text-[var(--color-foreground-secondary)]">{item.email}</span>
                    {item.website ? <span className="text-[var(--color-foreground-secondary)]">{item.website}</span> : null}
                    <span className="text-[var(--color-foreground-secondary)]">visitor_id: {item.visitor_id}</span>
                    <span className="text-[var(--color-foreground-secondary)]">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-2 text-[var(--color-foreground)] text-sm leading-6">{clampText(item.content, 160)}</p>
                  {item.reply_to_comment_id ? (
                    <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
                      <p className="text-xs text-[var(--color-foreground-secondary)]">
                        回复对象：
                        <span className="ml-1 text-[var(--color-foreground)] font-medium">{item.reply_to_nickname || '匿名用户'}</span>
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-foreground-secondary)] leading-6">
                        被回复留言：{clampText(item.reply_to_content || '（内容不可用）', 140)}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                    文章：
                    <Link href={`/post/${item.post_slug}`} className="text-[var(--color-primary)] hover:underline ml-1">
                      {item.post_title}
                    </Link>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-foreground-secondary)]">今日暂无新增留言。</p>
          )}
        </div>
      </div>
    </AdminGuard>
  );
}
