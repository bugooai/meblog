import api from './client';

export interface TechStackItem {
  name: string;
  summary: string | null;
  sort_order: number | null;
  background_image_url: string | null;
}

export interface CareerTimelineItem {
  period: string;
  title: string;
  description: string;
  tag: string | null;
  short_tag: string | null;
}

export interface AboutData {
  username: string;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
  bio: string | null;
  tech_stack: string[];
  tech_stack_items: TechStackItem[];
  career_timeline: CareerTimelineItem[];
  github_url: string | null;
  zhihu_url: string | null;
  twitter_url: string | null;
  wechat_id: string | null;
  wechat_qr_url: string | null;
  wechat_guide_text: string;
}

export const aboutApi = {
  getAbout: async (): Promise<AboutData> => {
    const response = await api.get<AboutData>('/about');
    return response.data;
  },

  updateAbout: async (data: Partial<AboutData>): Promise<AboutData> => {
    const response = await api.put<AboutData>('/about', data);
    return response.data;
  },
};
