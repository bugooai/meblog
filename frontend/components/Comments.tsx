'use client';

import { useEffect, useMemo, useState } from 'react';
import sanitizeHtml from 'sanitize-html';
import { commentsApi, Comment as ApiComment } from '../api/comments';

export interface Comment {
  id: string;
  nickname: string;
  avatarSeed?: string;
  email: string;
  website?: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  replies?: Comment[];
}

interface CommentsProps {
  postId: string;
  postSlug: string;
  visible?: boolean;
}

interface CommentFormData {
  nickname: string;
  email: string;
  website?: string;
  content: string;
}

interface ReplyTarget {
  id: string;
  nickname: string;
  excerpt: string;
}

function fromApiComment(c: ApiComment): Comment {
  return {
    id: String(c.id),
    nickname: c.nickname,
    avatarSeed: c.avatar_seed ?? undefined,
    email: c.email ?? '',
    website: c.website ?? undefined,
    content: c.content,
    createdAt: c.created_at,
    parentId: c.parent_id != null ? String(c.parent_id) : null,
    replies: c.replies?.map(fromApiComment),
  };
}

function countAllComments(comments: Comment[]): number {
  let total = 0;
  for (const c of comments) {
    total += 1;
    if (c.replies && c.replies.length > 0) {
      total += countAllComments(c.replies);
    }
  }
  return total;
}

function formatDiscussionTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 1000 / 60));
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 60) return `${diffMin} MINUTES AGO`;
  if (diffHour < 24) return `${diffHour} HOURS AGO`;
  if (diffDay < 7) return `${diffDay} DAYS AGO`;

  return date
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    .toUpperCase();
}

function getAvatarText(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return 'U';
  const first = trimmed[0];
  return /[\u4e00-\u9fa5]/.test(first) ? first : first.toUpperCase();
}

function buildAvatarSeed(comment: Comment): string {
  if (comment.avatarSeed && comment.avatarSeed.trim()) {
    return comment.avatarSeed.trim();
  }
  const nickname = (comment.nickname || '').trim().toLowerCase();
  const website = (comment.website || '').trim().toLowerCase();
  return `${nickname}|${website}`;
}

function buildGithubIdenticonUrl(seed: string): string {
  return `https://github.com/identicons/${encodeURIComponent(seed || 'anonymous')}.png`;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildPixelPattern(seed: string): boolean[][] {
  const h = hashSeed(seed || 'anonymous');
  const rows = 5;
  const cols = 5;
  const pattern: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const bitIndex = r * 3 + c;
      const on = ((h >> bitIndex) & 1) === 1;
      pattern[r][c] = on;
      pattern[r][cols - 1 - c] = on;
    }
  }
  return pattern;
}

function pickAvatarColor(seed: string): string {
  const palette = [
    'var(--color-primary)',
    'var(--color-primary-hover)',
    'var(--color-foreground-secondary)',
    'var(--color-foreground)',
  ];
  const h = hashSeed(seed || 'anonymous');
  return palette[h % palette.length];
}

function PixelAvatar({ seed, alt }: { seed: string; alt: string }) {
  const pattern = buildPixelPattern(seed);
  const color = pickAvatarColor(seed);
  const cell = 10;
  const size = cell * 5;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" role="img" aria-label={alt}>
      <rect width={size} height={size} fill="var(--color-background)" />
      {pattern.map((row, r) =>
        row.map((isOn, c) =>
          isOn ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={color} /> : null
        )
      )}
    </svg>
  );
}

function GithubStyleAvatar({ comment }: { comment: Comment }) {
  const seed = buildAvatarSeed(comment);
  const avatarText = getAvatarText(comment.nickname);

  return (
    <div className="w-11 h-11 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-background-secondary)] overflow-hidden">
      <PixelAvatar seed={seed} alt={`${comment.nickname || avatarText} avatar`} />
    </div>
  );
}

interface CommentFormProps {
  onSubmit: (data: CommentFormData, parentId: string | null) => Promise<void>;
  loading?: boolean;
  replyTarget: ReplyTarget | null;
  onCancelReply: () => void;
}

function buildReplyPlaceholder(target: ReplyTarget): string {
  const hhmm = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `回复 @${target.nickname}：${target.excerpt} [${hhmm}] `;
}

function CommentForm({ onSubmit, loading = false, replyTarget, onCancelReply }: CommentFormProps) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [content, setContent] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Partial<CommentFormData>>({});

  useEffect(() => {
    const savedNickname = localStorage.getItem('comment_nickname');
    const savedEmail = localStorage.getItem('comment_email');
    const savedWebsite = localStorage.getItem('comment_website');
    if (savedNickname) setNickname(savedNickname);
    if (savedEmail) setEmail(savedEmail);
    if (savedWebsite) setWebsite(savedWebsite);
  }, []);

  const inputClass =
    'w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-foreground)] rounded-lg outline-none focus:border-[var(--color-primary)] transition-colors';

  const validate = (): boolean => {
    const nextErrors: Partial<CommentFormData> = {};
    if (!nickname.trim()) nextErrors.nickname = '请填写姓名';
    if (!email.trim()) {
      nextErrors.email = '请填写邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = '邮箱格式不正确';
    }
    if (!content.trim()) nextErrors.content = '请填写留言内容';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      nickname: nickname.trim(),
      email: email.trim(),
      website: website.trim(),
      content: content.trim(),
    }, replyTarget?.id ?? null);

    setContent('');
    onCancelReply();
    if (rememberMe) {
      localStorage.setItem('comment_nickname', nickname.trim());
      localStorage.setItem('comment_email', email.trim());
      localStorage.setItem('comment_website', website.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3
        className="text-3xl font-bold text-[var(--color-foreground)]"
        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
      >
        发表留言
      </h3>

      {replyTarget && (
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--color-primary)] bg-[var(--color-background-secondary)]">
          <p className="text-sm text-[var(--color-foreground-secondary)]">
            正在回复 <span className="font-semibold text-[var(--color-foreground)]">@{replyTarget.nickname}</span>
          </p>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-foreground-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            取消回复
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-foreground-secondary)] uppercase">姓名 *</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例如：张三"
            className={inputClass}
            aria-label="姓名"
          />
          {errors.nickname && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.nickname}</p>}
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-foreground-secondary)] uppercase">邮箱 *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
            aria-label="邮箱"
          />
          {errors.email && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.email}</p>}
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-foreground-secondary)] uppercase">个人网址</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className={inputClass}
            aria-label="个人网址"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold tracking-[0.14em] text-[var(--color-foreground-secondary)] uppercase">留言内容 *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={replyTarget ? buildReplyPlaceholder(replyTarget) : '写下你的观点...'}
          rows={6}
          className={`${inputClass} resize-none`}
          aria-label="留言内容"
          id="comment-content-field"
        />
        {errors.content && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.content}</p>}
      </div>

      <label className="flex items-center gap-3 text-sm text-[var(--color-foreground-secondary)]">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 accent-[var(--color-primary)]"
        />
        在浏览器中保存我的姓名、邮箱和网址，以便下次留言。
      </label>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center px-8 py-3 bg-[var(--color-primary)] text-white text-sm font-semibold tracking-[0.16em] rounded-lg border border-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '提交中...' : '发布留言'}
      </button>
    </form>
  );
}

interface CommentItemProps {
  comment: Comment;
  depth?: number;
  onReplyIntent?: (comment: Comment) => void;
  commentLookup: Map<string, Comment>;
}

function collectDescendants(comment: Comment): Comment[] {
  const result: Comment[] = [];
  const walk = (node: Comment) => {
    if (!node.replies || node.replies.length === 0) return;
    for (const child of node.replies) {
      result.push(child);
      walk(child);
    }
  };
  walk(comment);
  return result.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function CommentItem({ comment, depth = 0, onReplyIntent, commentLookup }: CommentItemProps) {
  const safeContent = sanitizeHtml(comment.content, { allowedTags: [], allowedAttributes: {} });
  const secondLevelReplies = depth === 0 ? collectDescendants(comment) : [];
  const replyToNickname =
    comment.parentId && depth > 0 ? commentLookup.get(comment.parentId)?.nickname ?? null : null;

  return (
    <div className={depth > 0 ? 'mt-5' : ''}>
      <div className="flex gap-4">
        <GithubStyleAvatar comment={comment} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h4 className="text-xl font-semibold text-[var(--color-foreground)] leading-tight">
              {comment.nickname}
            </h4>
            <span className="text-xs font-semibold tracking-[0.14em] text-[var(--color-foreground-secondary)] uppercase whitespace-nowrap mt-1">
              {formatDiscussionTime(comment.createdAt)}
            </span>
          </div>
          <div className="mt-2 text-[15px] text-[var(--color-foreground-secondary)] leading-8 whitespace-pre-wrap break-words">
            {replyToNickname && (
              <span className="inline-flex items-center text-[var(--color-primary)] mr-2 font-semibold">
                @{replyToNickname}
              </span>
            )}
            <span dangerouslySetInnerHTML={{ __html: safeContent }} />
          </div>
          {onReplyIntent && (
            <button
              onClick={() => onReplyIntent(comment)}
              className="mt-3 inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold tracking-[0.08em] text-[var(--color-primary)] bg-[var(--color-primary-light)]/35 hover:bg-[var(--color-primary-light)]/55 transition-colors"
            >
              回复
            </button>
          )}
        </div>
      </div>

      {depth === 0 && secondLevelReplies.length > 0 && (
        <div className="mt-2 ml-8 pl-5 border-l-2 border-[var(--color-border)]">
          {secondLevelReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={{ ...reply, replies: [] }}
              depth={1}
              onReplyIntent={onReplyIntent}
              commentLookup={commentLookup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Comments({ postId, postSlug, visible = true }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    if (!postSlug) return;
    setLoading(true);
    commentsApi
      .getBySlug(postSlug)
      .then((res) => setComments(res.items.map(fromApiComment)))
      .catch(() => {
        // Graceful degradation: keep empty list when request fails.
      })
      .finally(() => setLoading(false));
  }, [postSlug]);

  const totalCommentCount = useMemo(() => countAllComments(comments), [comments]);
  const commentLookup = useMemo(() => {
    const map = new Map<string, Comment>();
    const walk = (items: Comment[]) => {
      for (const item of items) {
        map.set(item.id, item);
        if (item.replies && item.replies.length > 0) {
          walk(item.replies);
        }
      }
    };
    walk(comments);
    return map;
  }, [comments]);

  const refreshComments = async () => {
    const res = await commentsApi.getBySlug(postSlug);
    setComments(res.items.map(fromApiComment));
  };

  const handleSubmit = async (data: CommentFormData, parentId: string | null) => {
    setSubmitLoading(true);
    try {
      await commentsApi.create({
        post_id: postId,
        parent_id: parentId,
        nickname: data.nickname,
        email: data.email,
        website: data.website || undefined,
        content: data.content,
      });
      await refreshComments();
      setReplyTarget(null);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReplyIntent = (comment: Comment) => {
    const excerpt = sanitizeHtml(comment.content, { allowedTags: [], allowedAttributes: {} })
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 28);
    setReplyTarget({
      id: comment.id,
      nickname: comment.nickname,
      excerpt: excerpt.length >= 28 ? `${excerpt}...` : excerpt,
    });
    document.getElementById('comment-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      document.getElementById('comment-content-field')?.focus();
    }, 250);
  };

  if (!visible) return null;

  return (
    <section id="comment-form" className="mt-14 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(107,114,128,0.18) 1px, transparent 0), linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '16px 16px, 24px 24px, 24px 24px',
          backgroundPosition: '0 0, 0 0, 0 0',
        }}
      />
      <div className="relative">
      <div className="mb-8">
        <h2
          className="text-4xl font-bold text-[var(--color-foreground)]"
          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          留言 ({totalCommentCount})
        </h2>
      </div>

      {loading ? (
        <div className="py-8 text-sm text-[var(--color-foreground-secondary)]">留言加载中...</div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-sm text-[var(--color-foreground-secondary)]">
          暂无留言，欢迎抢先留言。
        </div>
      ) : (
        <div className="space-y-7 border-t border-[var(--color-border)] pt-7 bg-[var(--color-background-secondary)]/55 rounded-xl p-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReplyIntent={handleReplyIntent}
              commentLookup={commentLookup}
            />
          ))}
        </div>
      )}

      <div id="comment-editor" className="mt-12 border border-[var(--color-border)] bg-[var(--color-background-secondary)]/70 rounded-xl p-8 md:p-10 shadow-[var(--shadow-card)]">
        <CommentForm
          onSubmit={handleSubmit}
          loading={submitLoading}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
        />
      </div>
      </div>
    </section>
  );
}
