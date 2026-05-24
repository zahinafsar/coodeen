export interface Session {
  id: string;
  title: string;
  providerId?: string | null;
  modelId?: string | null;
  projectDir?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionModel {
  providerId: string;
  modelId: string;
}

export interface CoodeenPage {
  route: string;
  compact?: boolean;
}

export interface CoodeenConfig {
  design?: {
    host: string;
    pages: CoodeenPage[];
  };
}

export interface FileReference {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

export interface ConnectedModelsItem {
  providerId: string;
  label: string;
  models: string[];
}

export interface ProviderListItem {
  id: string;
  name: string;
  source: "env" | "config" | "custom" | "api" | null;
  hasKey: boolean;
  authType: string | null;
  models: Array<{ id: string; name: string }>;
}

export interface CustomProviderInput {
  id: string;
  name: string;
  baseURL: string;
  models: Array<{ id: string; name?: string; tools?: boolean }>;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface DirListResponse {
  current: string;
  parent: string | null;
  dirs: string[];
}

