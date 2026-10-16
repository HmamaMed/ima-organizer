import { apiRequest } from '../../shared/api/client';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export const fetchNotifications = (token: string) =>
  apiRequest<InboxNotification[]>('/api/notifications', { token });
export const deleteNotification = (token: string, id: string) =>
  apiRequest<void>(`/api/notifications/${id}`, { token, method: 'DELETE' });
