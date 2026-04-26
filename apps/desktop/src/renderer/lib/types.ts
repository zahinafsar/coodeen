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

