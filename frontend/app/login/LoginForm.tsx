'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';

type Mode = 'login' | 'bootstrap';

// 后端失败时 detail 是给人看的短句，直接顶到界面上；拿不到就当通用失败，
// 不把 axios 的错误形状漏给界面。
function errorDetail(error: unknown): string | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail ? detail : null;
}

// 站里还没有任何账号时，登录是不可能的：必须先有一个管理员。
// 这个面板只做一件事——把「第一个账号」的创建入口从 curl 挪到页面上。
// 后端才是唯一裁判：空库的第一个注册才是管理员，一旦有了账号这里就消失，
// 开关 ALLOW_REGISTRATION 也不会因此放开。
export default function LoginForm({ needsBootstrap }: { needsBootstrap: boolean }) {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);

  const mode: Mode = modeOverride ?? (needsBootstrap ? 'bootstrap' : 'login');

  const enter = async (token: string) => {
    localStorage.setItem('token', token);
    const user = await authApi.getMe();
    login(token, user);
    router.push(user.is_admin ? '/admin' : '/');
  };

  const loginMutation = useMutation({
    mutationFn: async () => authApi.login({ username, password }),
    onSuccess: (data) => enter(data.access_token),
    onError: (error) => {
      setError(errorDetail(error) || '登录失败');
    },
  });

  // 建号和登录共用一份用户刚输入的凭据，所以两步必须在一次提交里做完：
  // 只建号不登录的话，用户看到的还是一个空后台前的登录页。
  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      await authApi.register({ username, email, password });
      return authApi.login({ username, password });
    },
    onSuccess: (data) => enter(data.access_token),
    onError: (error) => {
      setError(errorDetail(error) || '初始化失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'bootstrap') {
      bootstrapMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const busy = loginMutation.isPending || bootstrapMutation.isPending;
  const inputClass =
    'w-full px-3 py-2 border border-[var(--color-border)] rounded-[8px] bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-8 border border-[var(--color-border)]">
        <h1
          className="text-2xl font-bold text-[var(--color-foreground)] mb-2 text-center"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          {mode === 'bootstrap' ? '初始化站点' : '登录'}
        </h1>

        {mode === 'bootstrap' && (
          <p className="mb-6 text-center text-sm text-[var(--color-foreground-secondary)]">
            这个站点还没有任何账号。下面这个账号会成为管理员，而且只有一次机会。
          </p>
        )}

        {error && (
          <div className="mb-4 p-3 bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-[8px] text-sm border border-[var(--color-danger)]/25">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
              {mode === 'bootstrap' ? '用户名' : '用户名 / 邮箱'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              minLength={mode === 'bootstrap' ? 3 : undefined}
              maxLength={mode === 'bootstrap' ? 20 : undefined}
              required
            />
            {mode === 'bootstrap' && (
              <p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">
                3-20 个字符，只用字母、数字或下划线
              </p>
            )}
          </div>

          {mode === 'bootstrap' && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)] mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              minLength={mode === 'bootstrap' ? 8 : undefined}
              required
            />
            {mode === 'bootstrap' && (
              <p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">至少 8 位</p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 px-4 bg-[var(--color-primary)] text-white rounded-[8px] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy
              ? mode === 'bootstrap'
                ? '创建中...'
                : '登录中...'
              : mode === 'bootstrap'
                ? '创建管理员并进入后台'
                : '登录'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-[var(--color-foreground-secondary)]">
          {mode === 'bootstrap' ? (
            <button
              type="button"
              className="text-[var(--color-primary)] hover:underline"
              onClick={() => {
                setError('');
                setModeOverride('login');
              }}
            >
              我已经有账号了，去登录
            </button>
          ) : (
            <p>
              登录后可访问{' '}
              <Link href="/admin" className="text-[var(--color-primary)] hover:underline">
                管理后台
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
