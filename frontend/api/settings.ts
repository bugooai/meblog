import api from './client';

export interface SiteSettings {
  id: string;
  site_name: string;
  site_logo_url: string | null;
  site_favicon_url: string | null;
  wechat_qr_url: string | null;
  wechat_guide_text: string;
  wechat_show_on_article: boolean;
  wechat_show_in_sidebar: boolean;
  footer_github_url: string | null;
  beian_icp: string | null;
}

export const siteSettingsApi = {
  getSiteSettings: async (): Promise<SiteSettings> => {
    const response = await api.get<SiteSettings>('/settings/site');
    return response.data;
  },

  updateSiteSettings: async (data: Partial<SiteSettings>): Promise<SiteSettings> => {
    const response = await api.put<SiteSettings>('/settings/site', data);
    return response.data;
  },
};

export interface SeoSettings {
  id: string;
  site_name: string;
  site_description: string;
  site_keywords: string | null;
  default_og_image_url: string | null;
}

export const seoSettingsApi = {
  getSeoSettings: async (): Promise<SeoSettings> => {
    const response = await api.get<SeoSettings>('/settings/seo');
    return response.data;
  },

  updateSeoSettings: async (data: Partial<SeoSettings>): Promise<SeoSettings> => {
    const response = await api.put<SeoSettings>('/settings/seo', data);
    return response.data;
  },
};
