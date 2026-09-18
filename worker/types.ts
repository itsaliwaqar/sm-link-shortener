export interface Env {
  DB: D1Database;
  LINKS_KV: KVNamespace;
  ASSETS: Fetcher;
  APP_URL: string;
  AUTH_SECRET: string;
  VISITOR_HASH_SALT: string;
}

export type UserRole = "admin" | "member";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: number;
}

export interface DomainRow {
  id: string;
  hostname: string;
  label: string | null;
  is_active: number;
  is_default: number;
  created_by: string;
  created_at: number;
}

export interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: number;
}

export interface LinkRow {
  id: string;
  domain_id: string;
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
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

export interface CachedLink {
  linkId: string;
  destinationUrl: string;
  isActive: boolean;
}

export interface AuthContext {
  userId: string;
  role: UserRole;
  authMethod: "session" | "apikey";
}
