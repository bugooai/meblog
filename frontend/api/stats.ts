import apiClient from './client';

export interface UniqueVisitors {
  post_id: number;
  unique_visitors: number;
  days: number;
}

export interface TrendData {
  date: string;
  visitors: number;
  views: number;
}

export interface Trends {
  days: number;
  total_visitors: number;
  total_views: number;
  daily: TrendData[];
}

export interface PopularPost {
  id: number;
  title: string;
  slug: string;
  visitors: number;
  views: number;
}

export interface PopularPosts {
  days: number;
  posts: PopularPost[];
}

export interface Summary {
  total_posts: number;
  total_views: number;
}

export interface PublicSummary {
  total_posts: number;
  total_comments: number;
  total_visits: number;
}

export interface TopVisitorInfo {
  visitor_id: string;
  access_count: number;
  last_access_at: string;
  visitor_key: string | null;
  first_seen_at: string | null;
  visitor_last_seen_at: string | null;
  user_agent: string | null;
  referrer: string | null;
}

export interface AdminDashboardCommentItem {
  comment_id: string;
  nickname: string;
  email: string;
  website: string | null;
  content: string;
  created_at: string;
  visitor_id: string;
  parent_id: string | null;
  post_id: string;
  post_slug: string;
  post_title: string;
  reply_to_comment_id: string | null;
  reply_to_nickname: string | null;
  reply_to_content: string | null;
}

export interface TopPostItem {
  post_id: string;
  slug: string;
  title: string;
  access_count: number;
}

export interface AdminDashboardStats {
  total_posts: number;
  total_visits: number;
  total_comments: number;
  today_new_visits: number;
  today_new_comments: number;
  today_top_visitor: TopVisitorInfo | null;
  all_time_top_visitor: TopVisitorInfo | null;
  today_new_comment_items: AdminDashboardCommentItem[];
  top_post_today: TopPostItem | null;
  top_post_all_time: TopPostItem | null;
  top_posts: TopPostItem[];
}

export const statsApi = {
  // Log access when viewing a post
  logAccess: async (postId: number): Promise<void> => {
    await apiClient.post(`/stats/log/${postId}`);
  },

  // Get unique visitors for a post
  getUniqueVisitors: async (postId: number, days = 7): Promise<UniqueVisitors> => {
    const response = await apiClient.get(`/stats/post/${postId}/unique-visitors`, {
      params: { days },
    });
    return response.data;
  },

  // Get access trends
  getTrends: async (days = 30): Promise<Trends> => {
    const response = await apiClient.get('/stats/trends', {
      params: { days },
    });
    return response.data;
  },

  // Get popular posts
  getPopularPosts: async (days = 30, limit = 10): Promise<PopularPosts> => {
    const response = await apiClient.get('/stats/popular-posts', {
      params: { days, limit },
    });
    return response.data;
  },

  // Get summary (requires auth)
  getSummary: async (): Promise<Summary> => {
    const response = await apiClient.get('/stats/summary');
    return response.data;
  },

  // Public summary for frontend sidebar/footer widgets
  getPublicSummary: async (): Promise<PublicSummary> => {
    const response = await apiClient.get('/stats/public-summary');
    return response.data;
  },

  getAdminDashboard: async (): Promise<AdminDashboardStats> => {
    const response = await apiClient.get('/stats/admin-dashboard');
    return response.data;
  },
};
