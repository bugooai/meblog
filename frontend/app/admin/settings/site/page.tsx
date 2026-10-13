'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { siteSettingsApi } from '@/api/settings';
import AdminGuard from '@/components/AdminGuard';
import OssUploadInput from '@/components/OssUploadInput';

export default function AdminSiteSettingsPage() {
  const queryClient = useQueryClient();
  const [siteName, setSiteName] = useState('');
  const [siteLogoUrl, setSiteLogoUrl] = useState('');
  const [siteFaviconUrl, setSiteFaviconUrl] = useState('');
  const [wechatQrUrl, setWechatQrUrl] = useState('');
  const [wechatGuideText, setWechatGuideText] = useState('');
  const [showOnArticle, setShowOnArticle] = useState(true);
  const [showInSidebar, setShowInSidebar] = useState(true);
  const [footerGithubUrl, setFooterGithubUrl] = useState('');
  const [beianIcp, setBeianIcp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: siteSettingsApi.getSiteSettings,
  });

  useEffect(() => {
    if (!data) return;
    setSiteName(data.site_name || '');
    setSiteLogoUrl(data.site_logo_url || '');
    setSiteFaviconUrl(data.site_favicon_url || '');
    setWechatQrUrl(data.wechat_qr_url || '');
    setWechatGuideText(data.wechat_guide_text || '');
    setShowOnArticle(Boolean(data.wechat_show_on_article));
    setShowInSidebar(Boolean(data.wechat_show_in_sidebar));
    setFooterGithubUrl(data.footer_github_url || '');
    setBeianIcp(data.beian_icp || '');
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: siteSettingsApi.updateSiteSettings,
    onSuccess: () => {
      setError('');
      setMessage('网站设置已保存');
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['about'] });
    },
    onError: (err: any) => {
      setMessage('');
      setError(err.response?.data?.detail || '保存失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    updateMutation.mutate({
      site_name: siteName.trim() || '技术博客',
      site_logo_url: siteLogoUrl || null,
      site_favicon_url: siteFaviconUrl || null,
      wechat_qr_url: wechatQrUrl || null,
      wechat_guide_text: wechatGuideText,
      wechat_show_on_article: showOnArticle,
      wechat_show_in_sidebar: showInSidebar,
      footer_github_url: footerGithubUrl || null,
      beian_icp: beianIcp || null,
    });
  };

  const inputClass =
    'w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]';
  const labelClass = 'block text-sm font-medium text-[var(--color-foreground)] mb-1';

  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            网站设置
          </h1>
          <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
            配置站点品牌信息、公众号二维码和展示策略。
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <HomeIcon className="w-4 h-4" />
            返回管理后台
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--color-background)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回设置列表
          </Link>
        </div>

        {isLoading && <div className="text-[var(--color-foreground-secondary)] py-10">加载中...</div>}

        {!isLoading && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-6 shadow-[var(--shadow-card)]">
            {message && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm">{message}</div>}
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>}

            <div className="space-y-1">
              <label className={labelClass}>网站名称</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className={inputClass}
                placeholder="请输入网站名称"
              />
            </div>

            <OssUploadInput
              label="网站 Logo URL"
              value={siteLogoUrl}
              onChange={setSiteLogoUrl}
              folder="site/branding"
              placeholder="https://example.com/site-logo.png"
            />

            <OssUploadInput
              label="网站 Favicon URL"
              value={siteFaviconUrl}
              onChange={setSiteFaviconUrl}
              folder="site/branding"
              placeholder="https://example.com/favicon.png"
              showPreview={false}
            />

            <OssUploadInput
              label="公众号二维码 URL"
              value={wechatQrUrl}
              onChange={setWechatQrUrl}
              folder="site/wechat"
              placeholder="https://example.com/wechat-qr.png"
            />

            <div className="space-y-1">
              <label className={labelClass}>公众号引导文案</label>
              <textarea
                value={wechatGuideText}
                onChange={(e) => setWechatGuideText(e.target.value)}
                className={`${inputClass} h-24`}
                placeholder="扫码关注公众号，获取更多精彩内容"
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>页脚 GitHub 链接</label>
              <input
                type="url"
                value={footerGithubUrl}
                onChange={(e) => setFooterGithubUrl(e.target.value)}
                className={inputClass}
                placeholder="https://github.com/yourname"
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>备案号</label>
              <input
                type="text"
                value={beianIcp}
                onChange={(e) => setBeianIcp(e.target.value)}
                className={inputClass}
                placeholder="粤ICP备xxxxxxxx号"
              />
            </div>

            <div className="space-y-3 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
              <p className="text-sm font-medium text-[var(--color-foreground)]">显示范围</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnArticle}
                  onChange={(e) => setShowOnArticle(e.target.checked)}
                  className="w-4 h-4 text-[var(--color-primary)]"
                />
                <span className="text-[var(--color-foreground)]">在文章详情页显示公众号卡片</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInSidebar}
                  onChange={(e) => setShowInSidebar(e.target.checked)}
                  className="w-4 h-4 text-[var(--color-primary)]"
                />
                <span className="text-[var(--color-foreground)]">在侧边栏显示公众号卡片</span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {updateMutation.isPending ? '保存中...' : '保存设置'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminGuard>
  );
}
