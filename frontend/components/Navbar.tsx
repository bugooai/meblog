'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { siteSettingsApi } from '@/api/settings';
import ThemeToggle from '@/components/ThemeToggle';
import { Menu } from '@headlessui/react';
import {
  HomeIcon,
  FolderIcon,
  TagIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  Bars3Icon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: siteSettingsApi.getSiteSettings,
  });
  const siteName = siteSettings?.site_name || '技术博客';
  const siteLogo = siteSettings?.site_logo_url || '/bugoo-logo.png';

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <nav className="sticky top-0 z-50 h-16 md:h-[72px] flex items-center border-b border-[var(--color-border)] bg-[var(--color-background)] dark:border-[var(--color-border)]/85 dark:bg-[var(--color-background)]/86 dark:backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="relative flex justify-between items-center h-full">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            <img
              src={siteLogo}
              alt={`${siteName} logo`}
              className="w-10 h-10 rounded-full object-cover border border-[var(--color-border)]"
            />
            <span className="inline-block">{siteName}</span>
          </Link>

          {/* Desktop Nav (centered) */}
          <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            <NavLink href="/" icon={<HomeIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Home" pathname={pathname} />
            <NavLink href="/projects" icon={<FolderIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Projects" pathname={pathname} />
            <NavLink href="/tags" icon={<TagIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Tags" pathname={pathname} />
            <NavLink href="/archive" icon={<ClockIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="Archives" pathname={pathname} />
            <NavLink href="/about" icon={<UserCircleIcon className="w-[18px] h-[18px]" strokeWidth={1.5} />} label="About" pathname={pathname} />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {isAuthenticated && (
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center gap-2 text-sm text-[var(--color-foreground)] hover:text-[var(--color-primary)] transition-colors rounded-lg px-2 py-1">
                  <UserCircleIcon className="w-6 h-6" strokeWidth={1.5} />
                  <span className="font-medium">{user?.username}</span>
                </Menu.Button>
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card-hover)] ring-1 ring-[var(--color-border)]/40 focus:outline-none border border-[var(--color-border)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)]">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{user?.username}</p>
                  </div>
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/admin"
                          className={`flex items-center gap-2 px-4 py-2 text-sm ${
                            active
                              ? 'bg-[var(--color-primary)] text-white'
                              : 'text-[var(--color-foreground)]'
                          }`}
                        >
                          <Cog6ToothIcon className="w-4 h-4" />
                          管理后台
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={handleLogout}
                          className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left ${
                            active
                              ? 'bg-[var(--color-danger)] text-white'
                              : 'text-[var(--color-foreground)]'
                          }`}
                        >
                          <ArrowRightOnRectangleIcon className="w-4 h-4" />
                          退出登录
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Menu>
            )}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <MobileMenu isAuthenticated={isAuthenticated} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Nav link component - 修复样式：选中时蓝色字体+浅蓝背景，未选中时黑色字体
// 确保所有状态下的尺寸完全一致，防止布局偏移
function NavLink({ href, icon, label, pathname }: { href: string; icon: React.ReactNode; label: string; pathname: string }) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`relative flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold transition-colors no-underline min-w-[78px] h-9 ${
        isActive
          ? '!text-[var(--color-primary)]'
          : '!text-[var(--color-foreground-secondary)] hover:!text-[var(--color-foreground)]'
      }`}
    >
      {icon}
      {label}
      <span
        className={`absolute left-2 right-2 -bottom-[6px] h-0.5 rounded-full transition-all ${
          isActive ? 'bg-[var(--color-primary)] opacity-100' : 'bg-transparent opacity-0'
        }`}
      />
    </Link>
  );
}

// Mobile menu component
function MobileMenu({ isAuthenticated: _isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button className="p-2 text-[var(--color-foreground)] hover:bg-[var(--color-background-secondary)] rounded-[8px] transition-colors">
        <Bars3Icon className="w-6 h-6" />
      </Menu.Button>
      <Menu.Items className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1rem)] origin-top-right bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card-hover)] ring-1 ring-[var(--color-border)]/40 focus:outline-none border border-[var(--color-border)] overflow-hidden">
        <div className="py-2">
          <Menu.Item>
            {({ active }) => (
              <Link prefetch={false} href="/" className={`flex items-center gap-2 px-4 py-3 text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-foreground)]'}`}>
                <HomeIcon className="w-5 h-5" />
                Home
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <Link prefetch={false} href="/projects" className={`flex items-center gap-2 px-4 py-3 text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-foreground)]'}`}>
                <FolderIcon className="w-5 h-5" />
                Projects
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <Link prefetch={false} href="/tags" className={`flex items-center gap-2 px-4 py-3 text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-foreground)]'}`}>
                <TagIcon className="w-5 h-5" />
                Tags
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <Link prefetch={false} href="/archive" className={`flex items-center gap-2 px-4 py-3 text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-foreground)]'}`}>
                <ClockIcon className="w-5 h-5" />
                Archives
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <Link prefetch={false} href="/about" className={`flex items-center gap-2 px-4 py-3 text-sm ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-foreground)]'}`}>
                <UserCircleIcon className="w-5 h-5" />
                About
              </Link>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  );
}