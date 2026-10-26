import { apiRequest, apiUpload } from '../../shared/api/client';

export const WISH_CATEGORIES = [
  { value: 'OBJECT', label: 'Objets' },
  { value: 'BOOK', label: 'Livres' },
  { value: 'EXPERIENCE', label: 'Expériences' },
] as const;
export type WishCategory = typeof WISH_CATEGORIES[number]['value'];
export interface Wish {
  ownerId?: string;
  ownerName?: string;
  id: string;
  title: string;
  category: WishCategory;
  details: string | null;
  link: string | null;
  photoId: string | null;
  photoUrl: string | null;
  createdAt: string;
  completedAt?: string | null;
}
export type WishInput = Pick<Wish, 'title' | 'category' | 'details' | 'link' | 'photoId'>;
export type WishOwner = 'mine' | 'partner' | 'all';
export const fetchWishes = (token: string, page = 0, owner: WishOwner = 'all') => apiRequest<Wish[]>(`/api/wishes?page=${page}&owner=${owner}`, { token });
export const completeWish = (token: string, id: string, completed: boolean) => apiRequest<Wish>(`/api/wishes/${id}/completion`, { token, method: 'PATCH', body: { completed } });
export const saveWish = (token: string, body: WishInput, id?: string) =>
  apiRequest<Wish>(id ? `/api/wishes/${id}` : '/api/wishes', { token, method: id ? 'PUT' : 'POST', body });
export const uploadWishPhoto = (token: string, file: File) => apiUpload<{ id: string }>('/api/wishes/photos', file, token);
export const deleteWish = (token: string, id: string) => apiRequest<void>(`/api/wishes/${id}`, { token, method: 'DELETE' });
