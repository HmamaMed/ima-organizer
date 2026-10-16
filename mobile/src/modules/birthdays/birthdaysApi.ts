import { apiRequest } from '../../shared/api/client';

export interface Birthday {
  id: string;
  label: string;
  month: number;
  day: number;
  timeZone: string;
  nextBirthday: string;
  daysUntil: number;
}
export type BirthdayInput = Pick<Birthday, 'label' | 'month' | 'day' | 'timeZone'>;
export const fetchBirthdays = (token: string) => apiRequest<Birthday[]>('/api/birthdays', { token });
export const saveBirthday = (token: string, body: BirthdayInput, id?: string) =>
  apiRequest<Birthday>(id ? `/api/birthdays/${id}` : '/api/birthdays', { token, method: id ? 'PUT' : 'POST', body });
export const deleteBirthday = (token: string, id: string) =>
  apiRequest<void>(`/api/birthdays/${id}`, { token, method: 'DELETE' });
