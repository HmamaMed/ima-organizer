import { apiRequest } from '../../shared/api/client';

export const WATCH_STATUSES = [
  { value: 'TO_WATCH', label: 'À voir' }, { value: 'IN_PROGRESS', label: 'En cours' }, { value: 'WATCHED', label: 'Vu' },
] as const;
export type WatchStatus = typeof WATCH_STATUSES[number]['value'];
export type WatchKind = 'FILM' | 'SERIES';
export interface WatchReview { userId: string; name: string; rating: number; comment: string | null; updatedAt: string }
export interface WatchItem {
  id: string; title: string; kind: WatchKind; status: WatchStatus; notes: string | null; createdAt: string; reviews: WatchReview[];
}
export type WatchInput = Pick<WatchItem, 'title' | 'kind' | 'status' | 'notes'>;
export const fetchWatchlist = (token: string, page = 0, filters?: { q: string; kind: WatchKind | 'ALL'; status: WatchStatus | 'ALL' }) => apiRequest<WatchItem[]>(`/api/watchlist?page=${page}&q=${encodeURIComponent(filters?.q ?? '')}${filters?.kind && filters.kind !== 'ALL' ? `&kind=${filters.kind}` : ''}${filters?.status && filters.status !== 'ALL' ? `&status=${filters.status}` : ''}`, { token });
export const saveWatchItem = (token: string, body: WatchInput, id?: string) =>
  apiRequest<WatchItem>(id ? `/api/watchlist/${id}` : '/api/watchlist', { token, method: id ? 'PUT' : 'POST', body });
export const changeWatchStatus = (token: string, id: string, status: WatchStatus) =>
  apiRequest<WatchItem>(`/api/watchlist/${id}/status`, { token, method: 'PATCH', body: { status } });
export const saveWatchReview = (token: string, id: string, rating: number, comment: string | null) =>
  apiRequest<WatchItem>(`/api/watchlist/${id}/review`, { token, method: 'PUT', body: { rating, comment } });
export const removeWatchReview = (token: string, id: string) =>
  apiRequest<WatchItem>(`/api/watchlist/${id}/review`, { token, method: 'DELETE' });
