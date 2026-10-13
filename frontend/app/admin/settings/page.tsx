'use client';

import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard';

export default function AdminSettingsPage() {
  return (
    <AdminGuard>
      <div>
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-[var(--color-foreground)] mb-2"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            设置管理
          </h1>
          <p className="text-[var(--color-foreground-secondary)]">在这里维护网站展示配置和作者资料。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/settings/site"
            className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]"
          >
            <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-2">网站设置</h2>
            <p className="text-[var(--color-foreground-secondary)]">维护公众号二维码、引导文案和展示开关。</p>
          </Link>

          <Link
            href="/admin/settings/author"
            className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 hover:shadow-[var(--shadow-card-hover)] transition-all border border-[var(--color-border)]"
          >
            <h2 className="text-xl font-semibold text-emerald-500 mb-2">作者设置</h2>
            <p className="text-[var(--color-foreground-secondary)]">维护作者名称、头像、简介、技术栈和社交链接。</p>
          </Link>
        </div>
      </div>
    </AdminGuard>
  );
}
