import { apiRequest } from '../../shared/api/client';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  instructions: string;
  videoUrl: string | null;
}

export interface WorkoutDay {
  id: string;
  dayLabel: string;
  notes: string | null;
  exercises: Exercise[];
}

export interface WorkoutLog {
  id: string;
  workoutDayId: string;
  completedAt: string;
}

export function fetchPlan(token: string): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/api/gym/plan', { token });
}

export function fetchLogs(token: string): Promise<WorkoutLog[]> {
  return apiRequest<WorkoutLog[]>('/api/gym/log', { token });
}

export function logCompletion(token: string, workoutDayId: string): Promise<WorkoutLog> {
  return apiRequest<WorkoutLog>('/api/gym/log', {
    method: 'POST',
    token,
    body: { workoutDayId },
  });
}
