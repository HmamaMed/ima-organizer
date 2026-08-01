import { apiRequest } from '../../shared/api/client';

export interface Memory {
  id: string;
  photoUrl: string;
  caption: string | null;
  audioUrl: string | null;
  memoryDate: string;
  createdAt: string;
}

export interface CreateMemoryInput {
  photoUrl: string;
  caption?: string | null;
  audioUrl?: string | null;
  memoryDate: string;
}

export function fetchMemories(token: string): Promise<Memory[]> {
  return apiRequest<Memory[]>('/api/memories', { token });
}

export function createMemory(token: string, input: CreateMemoryInput): Promise<Memory> {
  return apiRequest<Memory>('/api/memories', {
    method: 'POST',
    token,
    body: input,
  });
}
