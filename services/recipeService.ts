import { supabase } from '@/lib/supabase';
import { Recipe, MealType, UserPreferences } from '@/types/recipe';
import {
  generateRecipe,
  getCurrentSeason,
} from '@/services/recipeGenerator';

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_preferences')
      .update({ ...preferences, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_preferences')
      .insert({ ...preferences, user_id: user.id });

    if (error) throw error;
  }
}

export async function getRecipesForDate(date: string): Promise<Recipe[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('daily_recipes')
    .select('*')
    .eq('user_id', user.id)
    .eq('recipe_date', date)
    .order('meal_type');

  if (error) throw error;
  return data || [];
}

export async function getRecentRecipes(days: number = 7): Promise<Recipe[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('daily_recipes')
    .select('*')
    .eq('user_id', user.id)
    .gte('recipe_date', startDate.toISOString().split('T')[0])
    .order('recipe_date', { ascending: false })
    .order('meal_type');

  if (error) throw error;
  return data || [];
}

export async function generateDailyRecipes(
  forceRegenerate: boolean = false
): Promise<Recipe[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  if (!forceRegenerate) {
    const existing = await getRecipesForDate(today);
    if (existing.length === 3) {
      return existing;
    }
  }

  const preferences = await getUserPreferences();
  if (!preferences || !preferences.api_key) {
    throw new Error('Please configure your API key in Settings');
  }

  const season = getCurrentSeason();
  const location = preferences.location || 'United States';
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];

  const recipes: Recipe[] = [];

  for (const mealType of mealTypes) {
    if (forceRegenerate) {
      await supabase
        .from('daily_recipes')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_date', today)
        .eq('meal_type', mealType);
    }

    const recipeData = await generateRecipe(
      preferences.api_provider,
      preferences.api_key,
      mealType,
      season,
      location
    );

    const { data, error } = await supabase
      .from('daily_recipes')
      .insert({
        user_id: user.id,
        recipe_date: today,
        ...recipeData,
      })
      .select()
      .single();

    if (error) throw error;
    recipes.push(data);
  }

  return recipes;
}

export async function toggleFavorite(recipeId: string): Promise<void> {
  const { data: recipe } = await supabase
    .from('daily_recipes')
    .select('is_favorite')
    .eq('id', recipeId)
    .single();

  if (!recipe) return;

  const { error } = await supabase
    .from('daily_recipes')
    .update({ is_favorite: !recipe.is_favorite })
    .eq('id', recipeId);

  if (error) throw error;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('daily_recipes')
    .delete()
    .eq('id', recipeId);

  if (error) throw error;
}
