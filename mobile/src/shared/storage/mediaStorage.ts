import { apiUpload } from '../api/client';

/** R2 credentials stay on the backend; it validates and tracks every uploaded file. */
export function uploadToStorage(groupId: string, blob: Blob, token: string): Promise<{ id: string }> {
  return apiUpload(`/api/memories/groups/${groupId}/media`, blob, token);
}
