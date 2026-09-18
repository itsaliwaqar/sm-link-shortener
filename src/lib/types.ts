export type UserRole = "admin" | "member";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: number;
}

export interface Domain {
  id: string;
  hostname: string;
  label: string | null;
  is_active: number;
  is_default: number;
  created_by: string;
  created_at: number;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: number;
}

export interface LinkItem {
  id: string;
  domain_id: string;
  domain_hostname: string;
  slug: string;
  destination_url: string;
  folder_id: string | null;
  title: string | null;
  slug_type: "random" | "custom";
  created_by: string;
  total_clicks: number;
  unique_clicks: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  short_url?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

export interface AnalyticsResponse {
  total_clicks: number;
  unique_clicks: number;
  range: string;
  timeseries: { day: string; total: number; unique_count: number }[];
  top_referrers: { key: string; count: number }[];
  top_countries: { key: string; count: number }[];
  top_devices: { key: string; count: number }[];
  top_browsers: { key: string; count: number }[];
}
