'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { authApi } from '@/api/auth';
import AdminGuard from '@/components/AdminGuard';

// 后端失败时 detail 是给人看的短句，直接顶到界面上；拿不到就当通用失败。
function errorDetail(error: unknown): string | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : null;
}

const MIN_LENGTH = 8;

export default function AdminPasswordSettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const changeMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({ old_password: oldPassword, new_password: newPassword }),
    onSuccess: () => {
      setError('');
      setMessage('口令已更新');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      setMessage('');
      setError(errorDetail(error) || '修改失败');
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword === confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!canSubmit || mismatch) {
      setError(mismatch ? '两次输入的新口令不一致' : `新口令至少 ${MIN_LENGTH} 位`);
      return;
    }
    changeMutation.mutate();
  };

  const inputClass =
    'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]';
  const labelClass = 'block text-sm font-medium text-[var(--color-foreground)] mb-1';

  return (
    <AdminGuard>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1
            className="text-3xl font-bold text-[var(--color-foreground)]"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            登录口令
          </h1>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回设置列表
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-6 shadow-[var(--shadow-card)]"
        >
          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className={labelClass}>当前口令</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>新口令</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              placeholder={`至少 ${MIN_LENGTH} 位`}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>确认新口令</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
            {mismatch && <p className="text-sm text-red-600">两次输入的新口令不一致</p>}
          </div>

          {/* 这条取舍要写在界面上：改口令不等于踢掉别的设备。
              token 里没有口令版本号，旧 JWT 有效到自然过期为止。 */}
          <p className="text-sm text-[var(--color-foreground-secondary)] leading-relaxed">
            改完后这个浏览器仍然保持登录。其它已登录的设备不会立刻掉线 ——
            登录令牌里没有口令版本，它要等到自己过期才失效。
          </p>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changeMutation.isPending || !canSubmit}
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {changeMutation.isPending ? '提交中...' : '修改口令'}
            </button>
          </div>
        </form>
      </div>
    </AdminGuard>
  );
}
