'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { aboutApi } from '@/api/about';
import AdminGuard from '@/components/AdminGuard';
import OssUploadInput from '@/components/OssUploadInput';

interface ParsedTechItem {
  name: string;
  summary: string | null;
  sort_order: number | null;
  background_image_url: string | null;
}

interface ParsedCareerItem {
  period: string;
  title: string;
  description: string;
  tag: string | null;
  short_tag: string | null;
}

function parseCareerTimeline(text: string): ParsedCareerItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [period, title, description, tag, shortTag] = line.split('|').map((item) => item.trim());
      return {
        period: period || '',
        title: title || '',
        description: description || '',
        tag: tag || null,
        short_tag: shortTag || null,
      };
    })
    .filter((item) => item.period && item.title && item.description);
}

export default function AdminAuthorSettingsPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarThumbUrl, setAvatarThumbUrl] = useState('');
  const [bio, setBio] = useState('');
  const [techStackItems, setTechStackItems] = useState<ParsedTechItem[]>([]);
  const [careerTimelineText, setCareerTimelineText] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [zhihuUrl, setZhihuUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [wechatId, setWechatId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['about'],
    queryFn: aboutApi.getAbout,
  });

  useEffect(() => {
    if (!data) return;
    setUsername(data.username || '');
    setAvatarUrl(data.avatar_url || '');
    setAvatarThumbUrl(data.avatar_thumb_url || '');
    setBio(data.bio || '');
    setTechStackItems(
      (data.tech_stack_items?.length
        ? data.tech_stack_items
        : (data.tech_stack || []).map((name, index) => ({
            name,
            summary: null,
            sort_order: index,
            background_image_url: null,
          }))
      ).map((item, index) => ({
        name: item.name || '',
        summary: item.summary || null,
        sort_order: item.sort_order ?? index,
        background_image_url: item.background_image_url || null,
      }))
    );
    setCareerTimelineText(
      (data.career_timeline || [])
        .map((item) => [item.period, item.title, item.description, item.tag || '', item.short_tag || ''].join(' | '))
        .join('\n')
    );
    setGithubUrl(data.github_url || '');
    setZhihuUrl(data.zhihu_url || '');
    setTwitterUrl(data.twitter_url || '');
    setWechatId(data.wechat_id || '');
  }, [data]);

  const addTechStackItem = () => {
    setTechStackItems((prev) => [
      ...prev,
      { name: '', summary: null, sort_order: prev.length, background_image_url: null },
    ]);
  };

  const updateTechStackItem = (index: number, patch: Partial<ParsedTechItem>) => {
    setTechStackItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const removeTechStackItem = (index: number) => {
    setTechStackItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveTechStackItem = (index: number, direction: -1 | 1) => {
    setTechStackItems((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const cloned = [...prev];
      [cloned[index], cloned[targetIndex]] = [cloned[targetIndex], cloned[index]];
      return cloned;
    });
  };

  const updateMutation = useMutation({
    mutationFn: aboutApi.updateAbout,
    onSuccess: () => {
      setError('');
      setMessage('作者设置已保存');
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
    const normalizedTechStackItems = techStackItems
      .map((item, index) => ({
        name: item.name.trim(),
        summary: item.summary || null,
        sort_order: index,
        background_image_url: item.background_image_url || null,
      }))
      .filter((item) => item.name);
    const careerTimeline = parseCareerTimeline(careerTimelineText);
    updateMutation.mutate({
      username: username.trim() || undefined,
      avatar_url: avatarUrl || null,
      avatar_thumb_url: avatarThumbUrl || null,
      bio: bio || null,
      tech_stack: normalizedTechStackItems.map((item) => item.name),
      tech_stack_items: normalizedTechStackItems,
      career_timeline: careerTimeline,
      github_url: githubUrl || null,
      zhihu_url: zhihuUrl || null,
      twitter_url: twitterUrl || null,
      wechat_id: wechatId || null,
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
            作者设置
          </h1>
          <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
            维护作者资料、个人简介和社交账号链接。
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

            <div>
              <label className={labelClass}>作者名称</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} required />
            </div>

            <OssUploadInput
              label="头像 URL"
              value={avatarUrl}
              onChange={setAvatarUrl}
              folder="author/avatar"
              placeholder="https://example.com/avatar.png"
            />

            <OssUploadInput
              label="头像缩略图 URL（用于右侧边栏）"
              value={avatarThumbUrl}
              onChange={setAvatarThumbUrl}
              folder="author/avatar"
              placeholder="https://example.com/avatar-thumb.png"
            />

            <div>
              <label className={labelClass}>个人简介</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} h-24`} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass}>技术栈配置（名称 / 背景图 / 简介 / 顺序）</label>
                <button
                  type="button"
                  onClick={addTechStackItem}
                  className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  新增技术项
                </button>
              </div>

              <div className="space-y-4">
                {techStackItems.map((item, index) => (
                  <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>名称</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateTechStackItem(index, { name: e.target.value })}
                          className={inputClass}
                          placeholder="Python"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>简要介绍</label>
                        <input
                          type="text"
                          value={item.summary || ''}
                          onChange={(e) => updateTechStackItem(index, { summary: e.target.value || null })}
                          className={inputClass}
                          placeholder="核心开发语言"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <OssUploadInput
                        label="背景图 URL（可选）"
                        value={item.background_image_url || ''}
                        onChange={(value) => updateTechStackItem(index, { background_image_url: value || null })}
                        folder="author/tech-bg"
                        placeholder="https://example.com/bg.png"
                      />
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => moveTechStackItem(index, -1)}
                          disabled={index === 0}
                          className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-50"
                        >
                          上移
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTechStackItem(index, 1)}
                          disabled={index === techStackItems.length - 1}
                          className="px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] disabled:opacity-50"
                        >
                          下移
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTechStackItem(index)}
                          className="px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>工程足迹（每行：时间段 | 标题 | 描述 | 标签组 | 简短标签，后两项可省略）</label>
              <textarea
                value={careerTimelineText}
                onChange={(e) => setCareerTimelineText(e.target.value)}
                className={`${inputClass} h-40`}
                placeholder={`2022 - 至今 | AI 基础设施架构师 | 主导推理训练平台建设与工程体系演进 | FULL STACK AI / Agent / RAG / MCP / Infra | FULL STACK AI\n2018 - 2022 | 资深后端开发工程师 | 负责高并发系统治理与可观测性平台建设 | BACKEND SYSTEM | BACKEND SYSTEM`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]">
              <div>
                <label className={labelClass}>GitHub URL</label>
                <input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>知乎 URL</label>
                <input type="url" value={zhihuUrl} onChange={(e) => setZhihuUrl(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Twitter/X URL</label>
                <input type="url" value={twitterUrl} onChange={(e) => setTwitterUrl(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>微信号</label>
                <input type="text" value={wechatId} onChange={(e) => setWechatId(e.target.value)} className={inputClass} />
              </div>
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
