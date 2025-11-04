export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type ApiProvider = 'openai' | 'gemini';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface Ingredient {
  name: string;
  quantity: string;
  checked?: boolean;
}

export interface Recipe {
  id: string;
  user_id: string;
  recipe_date: string;
  meal_type: MealType;
  recipe_name: string;
  ingredients: Ingredient[];
  instructions: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  estimated_cost: number;
  nutritional_info: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fats?: string;
    highlights?: string;
  };
  season: Season;
  is_favorite: boolean;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  api_provider: ApiProvider;
  api_key: string;
  location: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  ingredient: string;
  quantity: string;
  is_checked: boolean;
  recipe_id: string;
  created_at: string;
}
