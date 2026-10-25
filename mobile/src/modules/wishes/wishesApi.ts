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
}
export type WishInput = Pick<Wish, 'title' | 'category' | 'details' | 'link' | 'photoId'>;
export const fetchWishes = (token: string, page = 0) => apiRequest<Wish[]>(`/api/wishes?page=${page}`, { token });
export const saveWish = (token: string, body: WishInput, id?: string) =>
  apiRequest<Wish>(id ? `/api/wishes/${id}` : '/api/wishes', { token, method: id ? 'PUT' : 'POST', body });
export const uploadWishPhoto = (token: string, file: File) => apiUpload<{ id: string }>('/api/wishes/photos', file, token);
export const deleteWish = (token: string, id: string) => apiRequest<void>(`/api/wishes/${id}`, { token, method: 'DELETE' });
