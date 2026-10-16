import { apiRequest } from '../../shared/api/client';

export interface Memory {
  id: string;
  photoUrl: string;
  caption: string | null;
  audioUrl: string | null;
  memoryDate: string;
  createdAt: string;
  groupId?: string | null;
  expiresAt?: string;
}

export interface MemoryGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface CreateMemoryInput {
  photoAssetId: string;
  caption?: string | null;
  audioAssetId?: string | null;
  memoryDate: string;
  groupId: string;
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

export function deleteMemoryGroup(token: string, id: string): Promise<void> {
  return apiRequest(`/api/memories/groups/${id}`, { method: 'DELETE', token });
}
