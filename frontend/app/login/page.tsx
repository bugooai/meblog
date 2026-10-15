import type { Metadata } from 'next';
import { fetchFromServerApi, type ServerApiError } from '@/app/lib/server-api';
import type { AuthStatus } from '@/api/auth';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: '登录',
  robots: { index: false, follow: false },
};

// 空库时必须让登录页直接显示「初始化」面板，所以这个判断放在服务端：
// 客户端再查一次会让首屏先闪一个根本用不了的登录框，而且新站第一次打开时
// HTML 里写的应该是「建站」而不是「登录」。
export const dynamic = 'force-dynamic';

async function loadAuthStatus(): Promise<AuthStatus | null> {
  try {
    return await fetchFromServerApi<AuthStatus>('/auth/status', { cache: 'no-store' });
  } catch (error) {
    // 后端没起来 / 拿不到状态时退回普通登录页，别把登录本身也变不见。
    console.error('[login] 拿不到 /auth/status，按普通登录页渲染', (error as ServerApiError)?.status);
    return null;
  }
}

export default async function LoginPage() {
  const status = await loadAuthStatus();
  return <LoginForm needsBootstrap={status?.needs_bootstrap ?? false} />;
}
