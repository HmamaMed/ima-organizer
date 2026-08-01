import { apiRequest } from '../../shared/api/client';

export type NoteStatus = 'DRAFT' | 'SCHEDULED' | 'SENT';

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

export function updateNote(token: string, id: string, input: CreateNoteInput): Promise<Note> {
  return apiRequest<Note>(`/api/notes/${id}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteNote(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/notes/${id}`, {
    method: 'DELETE',
    token,
  });
}
