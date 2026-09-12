import { apiRequest } from '../../shared/api/client';

export type NoteStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED';

export interface Note {
  id: string;
  content: string;
  audioUrl: string | null;
  status: NoteStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CreateNoteInput {
  content: string;
  audioUrl?: string | null;
  scheduledFor?: string | null;
}

/**
 * The feed the server returns depends on the caller's role: the owner gets
 * their scheduled + sent notes, the recipient only ever gets delivered
 * (sent) notes — that filtering happens server-side, not here.
 */
export function fetchNotes(token: string, page = 0, size = 50): Promise<Note[]> {
  return apiRequest<Note[]>(`/api/notes?page=${page}&size=${size}`, { token });
}

export function createNote(token: string, input: CreateNoteInput): Promise<Note> {
  return apiRequest<Note>('/api/notes', {
    method: 'POST',
    token,
    body: input,
  });
}

/** Cancels a scheduled note before it's delivered. A sent note can never be cancelled. */
export function cancelNote(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/notes/${id}`, {
    method: 'DELETE',
    token,
  });
}
