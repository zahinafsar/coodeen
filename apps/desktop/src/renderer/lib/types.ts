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

export interface FileReference {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

