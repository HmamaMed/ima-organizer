import { apiRequest } from '../../shared/api/client';

export interface Memory {
  id: string;
  photoUrl: string;
  caption: string | null;
  audioUrl: string | null;
  memoryDate: string;
  createdAt: string;
  groupId?: string | null;
}

export interface MemoryGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface CreateMemoryInput {
  photoUrl: string;
  caption?: string | null;
  audioUrl?: string | null;
  memoryDate: string;
  groupId?: string | null;
}

export function fetchMemoryGroups(token: string): Promise<MemoryGroup[]> {
  return apiRequest<MemoryGroup[]>('/api/memories/groups', { token });
}

export function createMemoryGroup(
  token: string,
  input: { name: string; description?: string | null },
): Promise<MemoryGroup> {
  return apiRequest<MemoryGroup>('/api/memories/groups', {
    method: 'POST',
    token,
    body: input,
  });
}

export function fetchMemories(token: string): Promise<Memory[]> {
  return apiRequest<Memory[]>('/api/memories', { token });
}

export function createMemory(
  token: string,
  input: CreateMemoryInput,
): Promise<Memory> {
  return apiRequest<Memory>('/api/memories', {
    method: 'POST',
    token,
    body: input,
  });
}
