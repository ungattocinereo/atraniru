// TypeScript types for Ghost Content API

export interface GhostAuthor {
  id: string;
  name: string;
  slug: string;
  profile_image: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  facebook: string | null;
  twitter: string | null;
}

export interface GhostTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  feature_image: string | null;
  visibility: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface GhostPost {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  comment_id: string;
  feature_image: string | null;
  featured: boolean;
  visibility: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  custom_excerpt: string | null;
  excerpt: string;
  reading_time: number;
  url: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  og_title: string | null;
  og_description: string | null;
  twitter_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  authors?: GhostAuthor[];
  tags?: GhostTag[];
  primary_tag?: GhostTag;
  primary_author?: GhostAuthor;
}

export interface GhostPostsResponse {
  posts: GhostPost[];
  meta: {
    pagination: {
      page: number;
      limit: number;
      pages: number;
      total: number;
      next: number | null;
      prev: number | null;
    };
  };
}

export interface GhostSettings {
  title: string;
  description: string;
  logo: string | null;
  icon: string | null;
  cover_image: string | null;
  facebook: string | null;
  twitter: string | null;
  lang: string;
  timezone: string;
  codeinjection_head: string | null;
  codeinjection_foot: string | null;
  navigation: Array<{
    label: string;
    url: string;
  }>;
}
