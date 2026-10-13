// User types
export interface User {
  id: string;
  username: string;
  email: string;
  is_admin?: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user?: User;
}

// Project types
export interface Project {
  id: string;
  name: string;
  slug: string;
  cover?: string | null;
  description?: string;
  created_at: string;
  post_count?: number;
  is_hidden?: boolean;
}

// Alias for backwards compatibility
export type Category = Project;

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  post_count?: number;
}

// Post types
export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  cover?: string | null;
  summary: string | null;
  view_count: number;
  like_count: number;
  status: string;
  is_hidden?: boolean;
  created_at: string;
  project: Project | null;
  tags: Tag[];
}

export interface PostDetail extends PostListItem {
  content: string;
  updated_at: string;
  author: {
    id: string;
    username: string;
  };
}

export interface PostListResponse {
  items: PostListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreatePostData {
  title: string;
  cover?: string | null;
  content: string;
  summary?: string;
  project_id?: string;
  tag_ids?: string[];
  status: 'draft' | 'published';
  is_hidden?: boolean;
}

export interface UpdatePostData {
  title?: string;
  cover?: string | null;
  content?: string;
  summary?: string;
  project_id?: string;
  tag_ids?: string[];
  status?: 'draft' | 'published';
  is_hidden?: boolean;
}

// API Error
export interface ApiError {
  detail: string;
}
