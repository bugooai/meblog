'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { postsApi } from '@/api/posts';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import TableOfContents from '@/components/TableOfContents';
import WechatQR from '@/components/WechatQR';
import LikeButton from '@/components/LikeButton';
import { ListBulletIcon } from '@heroicons/react/24/outline';
import Comments from '@/components/Comments';

// Extract headings from markdown content (ignoring # in code blocks)
function extractHeadings(content: string): { id: string; text: string; level: number }[] {
  const withoutCodeBlocks = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: { id: string; text: string; level: number }[] = [];
  let match;

  while ((match = headingRegex.exec(withoutCodeBlocks)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    headings.push({ id, text, level });
  }

  return headings;
}

interface PostDetailClientProps {
  initialPost: any;
  initialSlug: string;
  initialLikeStatus?: {
    liked: boolean;
    like_count: number;
  } | null;
}

export default function PostDetailClient({
  initialPost,
  initialSlug,
  initialLikeStatus = null,
}: PostDetailClientProps) {
  const pathname = usePathname();
  const slugFromUrl = pathname ? pathname.split('/').pop() : null;
  const slug = initialSlug || slugFromUrl || '';
  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(!initialPost);

  // Fetch post data on client side if not provided - use polling to ensure it loads
  useEffect(() => {
    if (!initialPost && slug) {
      setLoading(true);
      const fetchPost = async () => {
        try {
          const data = await postsApi.getById(slug);
          setPost(data);
          setLoading(false);
        } catch (err: any) {
          console.error('Failed to fetch post:', err);
          console.error('Error message:', err.message);
          console.error('Error response:', err.response);
          setLoading(false);
        }
      };
      fetchPost();
    }
  }, [initialPost, slug]);

  const [showToc, setShowToc] = useState(false);
  const [headings, setHeadings] = useState<{ id: string; text: string; level: number }[]>([]);

  // Extract headings when post changes
  useEffect(() => {
    if (post?.content) {
      const extracted = extractHeadings(post.content);
      setHeadings(extracted);
    }
  }, [post]);

  const handleCloseToc = useCallback(() => {
    setShowToc(false);
  }, []);

  if (!post || loading) {
    return (
      <div className="text-center py-12 text-[var(--color-foreground-secondary)]">
        文章加载中...
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* TOC Toggle Button */}
      {headings.length > 0 && (
        <button
          onClick={() => setShowToc(!showToc)}
          className="fixed right-4 top-24 z-50 p-3 bg-[var(--color-background)] shadow-[var(--shadow-card-hover)] rounded-[8px] border border-[var(--color-border)] hover:bg-[var(--color-background-secondary)] transition-colors"
          title="文章目录"
        >
          <ListBulletIcon className="w-5 h-5 text-[var(--color-foreground-secondary)]" />
        </button>
      )}

      {/* TOC Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-72 bg-[var(--color-background)] shadow-xl z-40 transform transition-transform duration-300 ${
          showToc ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--color-foreground)]">文章目录</h3>
            <button
              onClick={() => setShowToc(false)}
              className="text-[var(--color-foreground-secondary)] hover:text-[var(--color-foreground)] text-lg"
            >
              ✕
            </button>
          </div>
          <TableOfContents headings={headings} onClose={handleCloseToc} />
        </div>
      </div>

      {/* Overlay */}
      {showToc && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setShowToc(false)}
        />
      )}

      {/* Main Content */}
      <article className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-block mb-6 text-[var(--color-primary)] hover:underline"
        >
          ← 返回首页
        </Link>

        <header className="mb-6 text-center">
          {/* 标题 */}
          <h1 className="text-4xl font-bold text-[var(--color-foreground)] mb-4 leading-tight text-center" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {post.title}
          </h1>

          {/* 元信息 */}
          <div className="inline-block text-left">
            <div className="text-base text-[var(--color-foreground-secondary)] mb-1">
              <span className="inline-block w-12 text-right">作者</span>
              <span>:</span>
              <Link href="/about" className="text-[var(--color-primary)] hover:underline ml-1">
                {post.author?.username || 'admin'}
              </Link>
            </div>

            <div className="text-base text-[var(--color-foreground-secondary)] mb-1">
              <span className="inline-block w-12 text-right">日期</span>
              <span>:</span>
              <span className="ml-1">{formatDate(post.created_at)}</span>
            </div>

            {post.project && (
              <div className="text-base text-[var(--color-foreground-secondary)] mb-1">
                <span className="inline-block w-12 text-right">项目</span>
                <span>:</span>
                <Link href={`/project/${post.project.slug}`} className="text-[var(--color-primary)] hover:underline ml-1">
                  {post.project.name}
                </Link>
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="text-base text-[var(--color-foreground-secondary)]">
                <span className="inline-block w-12 text-right">标签</span>
                <span>:</span>
                {post.tags.map((tag: any, index: number) => (
                  <span key={tag.id} className="ml-1">
                    {index > 0 && <span className="text-[var(--color-foreground-secondary)]">、</span>}
                    <Link
                      href={`/tag/${tag.slug}`}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {tag.name}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="bg-[var(--color-background)] rounded-[12px] shadow-[var(--shadow-card)] p-6 md:p-8 border border-[var(--color-border)]">
          <MarkdownRenderer content={post.content} />
        </div>

        {/* Like Button */}
        {slug && (
          <div className="mt-8 flex justify-center">
            <LikeButton
              key={slug}
              slug={slug}
              initialLiked={initialLikeStatus?.liked}
              initialCount={initialLikeStatus?.like_count ?? post?.like_count ?? 0}
            />
          </div>
        )}

        {/* Wechat QR */}
        <WechatQR variant="article-end" />

        {/* Comments */}
        {post.id && <Comments postSlug={slug} postId={post.id} />}

      </article>
    </div>
  );
}
