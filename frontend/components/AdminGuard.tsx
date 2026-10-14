'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // 后台所有写接口都要管理员 token，但只有 token 不够：登录页谁都能进来。
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="text-center py-12 text-[var(--color-foreground-secondary)]">加载中...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-[var(--color-foreground-secondary)]">
        这个账号没有后台权限，正在回首页…
      </div>
    );
  }

  return <>{children}</>;
}
