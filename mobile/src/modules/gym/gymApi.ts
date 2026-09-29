import { apiRequest } from '../../shared/api/client';

export type MuscleGroup =
  | 'LEGS'
  | 'GLUTES'
  | 'CORE'
  | 'UPPER_BODY'
  | 'CARDIO'
  | 'FULL_BODY'
  | 'MOBILITY';

export const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'LEGS', label: 'Legs' },
  { value: 'GLUTES', label: 'Glutes' },
  { value: 'CORE', label: 'Core' },
  { value: 'UPPER_BODY', label: 'Upper body' },
  { value: 'CARDIO', label: 'Cardio' },
  { value: 'FULL_BODY', label: 'Full body' },
  { value: 'MOBILITY', label: 'Mobility' },
];

export function muscleGroupLabel(group: MuscleGroup): string {
  return MUSCLE_GROUPS.find((g) => g.value === group)?.label ?? group;
}

/** The reusable "what" — how the movement is performed. No sets/reps here. */
export interface LibraryExercise {
  id: string;
  name: string;
  imageUrl: string | null;
  videoUrl: string | null;
  instructions: string;
  muscleGroup: MuscleGroup;
}

/** The "how much", for one exercise on one day. */
export interface DayExercise {
  id: string;
  sets: number;
  reps: string;
  restSeconds: number | null;
  note: string | null;
  exercise: LibraryExercise;
}

export interface ProgrammeDay {
  id: string;
  label: string;
  coachNote: string | null;
  exercises: DayExercise[];
}

export interface Programme {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  days: ProgrammeDay[];
}

export interface ExerciseTick {
  id: string;
  dayExerciseId: string;
  userId: string;
  tickDate: string;
  completedAt: string;
}

export interface WorkoutLog {
  id: string;
  programmeDayId: string;
  userId: string | null;
  completedAt: string;
}

export interface LibraryExerciseInput {
  name: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  instructions: string;
  muscleGroup: MuscleGroup;
}

export interface DayExerciseInput {
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds?: number | null;
  note?: string | null;
}

// ------------------------------------------------------------------- library

export function fetchExercises(token: string): Promise<LibraryExercise[]> {
  return apiRequest<LibraryExercise[]>('/api/gym/exercises', { token });
}

export function createExercise(token: string, input: LibraryExerciseInput): Promise<LibraryExercise> {
  return apiRequest<LibraryExercise>('/api/gym/exercises', { method: 'POST', token, body: input });
}

export function updateExercise(
  token: string,
  id: string,
  input: LibraryExerciseInput,
): Promise<LibraryExercise> {
  return apiRequest<LibraryExercise>(`/api/gym/exercises/${id}`, { method: 'PUT', token, body: input });
}

export function deleteExercise(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/gym/exercises/${id}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------- programmes

/** Null while the owner hasn't built anything yet — the endpoint 204s. */
export async function fetchActiveProgramme(token: string): Promise<Programme | null> {
  return (await apiRequest<Programme | undefined>('/api/gym/programmes/active', { token })) ?? null;
}

export function fetchProgrammes(token: string): Promise<Programme[]> {
  return apiRequest<Programme[]>('/api/gym/programmes', { token });
}

export function createProgramme(
  token: string,
  input: { name: string; description?: string | null; active?: boolean },
): Promise<Programme> {
  return apiRequest<Programme>('/api/gym/programmes', { method: 'POST', token, body: input });
}

export function updateProgramme(
  token: string,
  id: string,
  input: { name: string; description?: string | null; active?: boolean },
): Promise<Programme> {
  return apiRequest<Programme>(`/api/gym/programmes/${id}`, { method: 'PUT', token, body: input });
}

export function deleteProgramme(token: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/gym/programmes/${id}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------- days

export function addDay(
  token: string,
  programmeId: string,
  input: { label: string; coachNote?: string | null },
): Promise<ProgrammeDay> {
  return apiRequest<ProgrammeDay>(`/api/gym/programmes/${programmeId}/days`, {
    method: 'POST',
    token,
    body: input,
  });
}

export function updateDay(
  token: string,
  dayId: string,
  input: { label: string; coachNote?: string | null },
): Promise<ProgrammeDay> {
  return apiRequest<ProgrammeDay>(`/api/gym/days/${dayId}`, { method: 'PUT', token, body: input });
}

export function deleteDay(token: string, dayId: string): Promise<void> {
  return apiRequest<void>(`/api/gym/days/${dayId}`, { method: 'DELETE', token });
}

/** Replaces the day's whole ordered list in one call. */
export function setDayExercises(
  token: string,
  dayId: string,
  exercises: DayExerciseInput[],
): Promise<ProgrammeDay> {
  return apiRequest<ProgrammeDay>(`/api/gym/days/${dayId}/exercises`, {
    method: 'PUT',
    token,
    body: { exercises },
  });
}

// ------------------------------------------------------------------ progress

/** Returns undefined when unticking — the endpoint 204s, there's nothing to return. */
export function setTick(
  token: string,
  dayExerciseId: string,
  tickDate: string,
  done: boolean,
): Promise<ExerciseTick | undefined> {
  return apiRequest<ExerciseTick | undefined>('/api/gym/ticks', {
    method: 'POST',
    token,
    body: { dayExerciseId, tickDate, done },
  });
}

export function fetchTicks(token: string, days = 60): Promise<ExerciseTick[]> {
  return apiRequest<ExerciseTick[]>(`/api/gym/ticks?days=${days}`, { token });
}

export function fetchLogs(token: string): Promise<WorkoutLog[]> {
  return apiRequest<WorkoutLog[]>('/api/gym/log', { token });
}

export function logCompletion(token: string, programmeDayId: string): Promise<WorkoutLog> {
  return apiRequest<WorkoutLog>('/api/gym/log', {
    method: 'POST',
    token,
    body: { programmeDayId },
  });
}
