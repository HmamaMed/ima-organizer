import { apiRequest } from '../../shared/api/client';
import type { Role } from '../../shared/auth/AuthContext';

export interface AgiosParticipant {
  userId: string;
  name: string;
  role: Role;
}

export interface Agio {
  id: string;
  userId: string;
  /** Decimal string keeps monetary precision across the API boundary. */
  amount: string;
  date: string;
  createdAt: string;
}

export interface AgiosTracker {
  participants: AgiosParticipant[];
  entries: Agio[];
}

export interface AgioInput {
  userId: string;
  amount: string;
  date: string;
}

export function fetchAgios(token: string): Promise<AgiosTracker> {
  return apiRequest<AgiosTracker>('/api/agios', { token });
}

export function saveAgio(token: string, input: AgioInput, id?: string): Promise<Agio> {
  return apiRequest<Agio>(id ? `/api/agios/${id}` : '/api/agios', {
    token, method: id ? 'PUT' : 'POST', body: input,
  });
}

export function deleteAgio(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/agios/${id}`, { token, method: 'DELETE' });
}
