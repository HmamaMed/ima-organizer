# Nos recettes

Home → `/recipes` opens a French shared recipe notebook. Both authenticated accounts can add/edit/delete recipes, switch between À essayer/Nos favoris and read the ingredient/step sheet. Search covers titles, ingredient names and tips. The UI uses the current gold/plum theme and shared controls, feedback and delete confirmation. Lists refresh on entry, foreground and every minute while visible.

## API

| Method | Endpoint | Request/behavior |
| --- | --- | --- |
| GET | `/api/recipes` | Newest-first recipes with ordered ingredients and steps |
| POST | `/api/recipes` | Create with fields below |
| PUT | `/api/recipes/{id}` | Replace recipe fields and ordered collections |
| PATCH | `/api/recipes/{id}/status` | `{ status }`, preserving recipe content |
| DELETE | `/api/recipes/{id}` | Delete recipe, ingredients and steps |

```json
{
  "title": "Nos pâtes au citron",
  "status": "TO_TRY",
  "servings": 2,
  "minutes": 25,
  "ingredients": [{ "name": "Pâtes", "amount": "200 g" }, { "name": "Citron", "amount": "1" }],
  "steps": ["Faire cuire les pâtes.", "Ajouter le citron."],
  "tips": "Garder un peu d’eau de cuisson."
}
```

Title: 1–150 characters. Status: `TO_TRY` or `FAVORITE`. Servings: integer 1–50. Optional minutes: integer 1–1440. Ingredients: 1–100 ordered entries with required name (120 chars) and optional amount (80 chars). Steps: 1–40 nonblank ordered instructions, each up to 2,000 characters. Tips: optional, 2,000 characters. Text is trimmed and rendered as text. Names and amounts stay separate so a future shopping list can reuse them; no shopping-list integration is active yet.

Recipes persist until deleted. The existing Hibernate update setting creates `recipes`, `recipe_ingredients`, and `recipe_steps`; no service key, R2 setup or scheduled cleanup is needed. Both accounts use the existing authenticated API. Deploy the backend and mobile build together.

[Checks, screenshots and reproduction](../../../../design-validation/shared-notebooks/README.md).
