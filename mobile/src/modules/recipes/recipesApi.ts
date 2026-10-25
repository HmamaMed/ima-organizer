import { apiRequest } from '../../shared/api/client';

export const RECIPE_STATUSES = [{ value: 'TO_TRY', label: 'À essayer' }, { value: 'FAVORITE', label: 'Nos favoris' }] as const;
export type RecipeStatus = typeof RECIPE_STATUSES[number]['value'];
export interface RecipeIngredient { name: string; amount: string | null }
export interface Recipe {
  id: string; title: string; status: RecipeStatus; servings: number; minutes: number | null;
  ingredients: RecipeIngredient[]; steps: string[]; tips: string | null; createdAt: string;
}
export type RecipeInput = Omit<Recipe, 'id' | 'createdAt'>;
export const fetchRecipes = (token: string, page = 0, search = '') => apiRequest<Recipe[]>(`/api/recipes?page=${page}&q=${encodeURIComponent(search)}`, { token });
export const saveRecipe = (token: string, body: RecipeInput, id?: string) =>
  apiRequest<Recipe>(id ? `/api/recipes/${id}` : '/api/recipes', { token, method: id ? 'PUT' : 'POST', body });
export const changeRecipeStatus = (token: string, id: string, status: RecipeStatus) =>
  apiRequest<Recipe>(`/api/recipes/${id}/status`, { token, method: 'PATCH', body: { status } });
