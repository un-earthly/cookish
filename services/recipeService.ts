import { supabase } from '@/lib/supabase';
import { Recipe, MealType, UserPreferences, ImageSearchParams, RecipeRequest, RecipeDifficulty, Ingredient } from '@/types/recipe';
import {
  generateRecipe,
  getCurrentSeason,
} from '@/services/recipeGenerator';
import { imageService } from '@/services/imageService';
import { dietaryService } from '@/services/dietaryService';

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

    // Fetch image for the recipe
    const imageResult = await fetchRecipeImage(recipeData);

    const { data, error } = await supabase
      .from('daily_recipes')
      .insert({
        user_id: user.id,
        recipe_date: today,
        ...recipeData,
        image_url: imageResult?.url,
        image_source: imageResult?.source,
        image_attribution: imageResult?.attribution,
        created_via: 'daily'
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
/**
 * Fetch image for a recipe using the image service
 */
async function fetchRecipeImage(recipeData: Partial<Recipe>) {
  try {
    // Check user preferences for image settings
    const preferences = await getUserPreferences();
    const imagePrefs = preferences?.image_preferences;

    if (!imagePrefs?.enabled) {
      return null; // User has disabled images
    }

    // Build search parameters from recipe data
    const searchParams: ImageSearchParams = {
      recipeName: recipeData.recipe_name || '',
      cuisine: recipeData.cuisine_type,
      mainIngredients: extractMainIngredients(recipeData.ingredients || []),
      cookingMethod: extractCookingMethod(recipeData.instructions || '')
    };

    // Fetch image using the image service
    const imageResult = await imageService.getRecipeImage(searchParams);
    return imageResult;

  } catch (error) {
    console.error('Failed to fetch recipe image:', error);
    return null;
  }
}

/**
 * Extract main ingredients from recipe ingredients array
 */
function extractMainIngredients(ingredients: any[]): string[] {
  if (!Array.isArray(ingredients)) return [];

  return ingredients
    .slice(0, 3) // Take first 3 ingredients
    .map(ingredient => {
      if (typeof ingredient === 'string') return ingredient;
      if (ingredient.name) return ingredient.name;
      if (ingredient.item) return ingredient.item;
      return '';
    })
    .filter(Boolean);
}

/**
 * Extract cooking method from instructions
 */
function extractCookingMethod(instructions: string): string | undefined {
  if (!instructions) return undefined;

  const cookingMethods = [
    'bake', 'baking', 'roast', 'roasting',
    'fry', 'frying', 'sauté', 'sautéing',
    'grill', 'grilling', 'steam', 'steaming',
    'boil', 'boiling', 'simmer', 'simmering',
    'stir-fry', 'braise', 'braising'
  ];

  const lowerInstructions = instructions.toLowerCase();

  for (const method of cookingMethods) {
    if (lowerInstructions.includes(method)) {
      return method;
    }
  }

  return undefined;
}

/**
 * Generate recipe with chat context (for AI chat integration)
 */
export async function generateChatRecipe(
  prompt: string,
  sessionId?: string,
  preferences?: Partial<UserPreferences>
): Promise<Recipe> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user preferences if not provided
  const userPrefs = preferences || await getUserPreferences();
  if (!userPrefs || !userPrefs.api_key) {
    throw new Error('Please configure your API key in Settings');
  }

  // Use the conversational recipe generation pipeline
  const recipeData = await generateConversationalRecipe(prompt, userPrefs as UserPreferences, sessionId);

  // Validate and enhance the recipe
  const validatedRecipe = await validateAndEnhanceRecipe(recipeData, userPrefs as UserPreferences);

  // Fetch image for the recipe
  const imageResult = await fetchRecipeImage(validatedRecipe);

  // Save to database
  const { data, error } = await supabase
    .from('daily_recipes')
    .insert({
      user_id: user.id,
      recipe_date: new Date().toISOString().split('T')[0],
      meal_type: determineMealType(prompt) || 'dinner',
      ...validatedRecipe,
      image_url: imageResult?.url,
      image_source: imageResult?.source,
      image_attribution: imageResult?.attribution,
      created_via: 'chat',
      chat_session_id: sessionId,
      ai_model_used: validatedRecipe.ai_model_used || userPrefs.api_provider
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update recipe with image (for existing recipes without images)
 */
export async function updateRecipeImage(recipeId: string): Promise<void> {
  const { data: recipe, error: fetchError } = await supabase
    .from('daily_recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (fetchError || !recipe) {
    throw new Error('Recipe not found');
  }

  // Skip if recipe already has an image
  if (recipe.image_url) {
    return;
  }

  // Fetch image for the recipe
  const imageResult = await fetchRecipeImage(recipe);

  if (imageResult) {
    const { error } = await supabase
      .from('daily_recipes')
      .update({
        image_url: imageResult.url,
        image_source: imageResult.source,
        image_attribution: imageResult.attribution
      })
      .eq('id', recipeId);

    if (error) throw error;
  }
}

/**
 * Batch update images for recipes without them
 */
export async function updateMissingImages(limit: number = 10): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get recipes without images
  const { data: recipes, error } = await supabase
    .from('daily_recipes')
    .select('id, recipe_name, ingredients, instructions, cuisine_type')
    .eq('user_id', user.id)
    .is('image_url', null)
    .limit(limit);

  if (error) throw error;
  if (!recipes || recipes.length === 0) return 0;

  let updatedCount = 0;

  for (const recipe of recipes) {
    try {
      await updateRecipeImage(recipe.id);
      updatedCount++;

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to update image for recipe ${recipe.id}:`, error);
    }
  }

  return updatedCount;
}

/**
 * Get image service statistics
 */
export async function getImageServiceStats() {
  const cacheStats = await imageService.getCacheStats();
  const rateLimitStatus = await imageService.getUnsplashRateLimit();

  return {
    cache: cacheStats,
    unsplashRateLimit: rateLimitStatus
  };
}

/**
 * Conversational recipe generation pipeline
 * Routes between local and cloud AI based on user preferences and connectivity
 */
export async function generateConversationalRecipe(
  prompt: string,
  userPreferences: UserPreferences,
  sessionId?: string
): Promise<Partial<Recipe>> {
  const { AIRouterService } = await import('@/services/aiRouterService');
  const aiRouter = AIRouterService.getInstance();

  // Initialize AI router
  await aiRouter.initialize();

  // Build recipe request from natural language prompt
  const request = await buildRecipeRequestFromPrompt(prompt, userPreferences, sessionId);

  // Route to appropriate AI service
  const recipeData = await aiRouter.generateRecipe(request);

  return recipeData;
}

/**
 * Build RecipeRequest from natural language prompt
 */
async function buildRecipeRequestFromPrompt(
  prompt: string,
  userPreferences: UserPreferences,
  sessionId?: string
): Promise<RecipeRequest> {
  const lowerPrompt = prompt.toLowerCase();

  // Extract dietary restrictions from prompt
  const extractedRestrictions = extractDietaryRestrictions(lowerPrompt);
  const allRestrictions = [
    ...(userPreferences.dietary_restrictions || []),
    ...extractedRestrictions
  ];

  // Extract cuisine preference
  const extractedCuisine = extractCuisineType(lowerPrompt);
  const preferredCuisine = extractedCuisine ||
    (userPreferences.preferred_cuisines && userPreferences.preferred_cuisines[0]);

  // Extract cooking time preference
  const cookingTime = extractCookingTime(lowerPrompt);

  // Extract difficulty preference
  const difficulty = extractDifficulty(lowerPrompt);

  // Extract servings
  const servings = extractServings(lowerPrompt);

  // Add dietary prompt modifications (use enhanced version if user ID available)
  let dietaryModifications = '';
  if (userPreferences.user_id) {
    dietaryModifications = await dietaryService.generateEnhancedDietaryPrompt(userPreferences.user_id);
  } else {
    dietaryModifications = dietaryService.generateDietaryPromptModifications(userPreferences);
  }
  const enhancedPrompt = prompt + dietaryModifications;

  return {
    prompt: enhancedPrompt,
    dietaryRestrictions: allRestrictions,
    preferredCuisine,
    cookingTime,
    difficulty,
    servings,
    sessionId
  };
}

/**
 * Validate generated recipe against user's dietary restrictions
 */
export async function validateGeneratedRecipe(
  recipe: Partial<Recipe>,
  userId: string
): Promise<{
  isValid: boolean;
  complianceScore: number;
  issues: string[];
  suggestions: string[];
}> {
  try {
    const complianceReport = await dietaryService.generateComplianceReport(recipe as Recipe, userId);

    return {
      isValid: complianceReport.status === 'compliant',
      complianceScore: complianceReport.score,
      issues: [
        ...(complianceReport.details.violations?.map(v => v.reason) || []),
        ...(complianceReport.details.warnings?.map(w => w.concern) || [])
      ],
      suggestions: complianceReport.recommendations
    };
  } catch (error) {
    console.error('Error validating generated recipe:', error);
    return {
      isValid: true, // Default to valid if validation fails
      complianceScore: 1.0,
      issues: [],
      suggestions: []
    };
  }
}

/**
 * Enhanced recipe generation with dietary validation
 */
export async function generateValidatedRecipe(
  request: RecipeRequest,
  userPreferences: UserPreferences,
  maxRetries: number = 2
): Promise<Partial<Recipe>> {
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      // Generate recipe using existing method
      const recipe = await generateConversationalRecipe(
        request.prompt,
        userPreferences,
        request.sessionId
      );

      // Validate the generated recipe if user ID is available
      if (userPreferences.user_id) {
        const validation = await validateGeneratedRecipe(recipe, userPreferences.user_id);

        // If recipe has major violations, try to regenerate with more specific constraints
        if (!validation.isValid && validation.complianceScore < 0.5 && attempts < maxRetries - 1) {
          console.log(`Recipe validation failed (score: ${validation.complianceScore}), retrying with enhanced constraints...`);

          // Add specific constraints based on violations
          const enhancedRequest = {
            ...request,
            prompt: request.prompt + '\n\nIMPORTANT: ' + validation.suggestions.join('. ')
          };

          attempts++;
          continue;
        }

        // Add validation metadata to recipe
        (recipe as any).dietary_validation = {
          compliance_score: validation.complianceScore,
          validation_status: validation.isValid ? 'compliant' : 'non_compliant',
          validation_issues: validation.issues,
          validation_suggestions: validation.suggestions
        };
      }

      return recipe;
    } catch (error) {
      lastError = error as Error;
      attempts++;

      if (attempts >= maxRetries) {
        throw lastError;
      }

      console.log(`Recipe generation attempt ${attempts} failed, retrying...`);
    }
  }

  throw lastError || new Error('Failed to generate validated recipe');
}

/**
 * Extract dietary restrictions from natural language
 */
function extractDietaryRestrictions(prompt: string): string[] {
  const restrictions: string[] = [];

  const patterns = [
    { pattern: /\b(vegan|plant.based)\b/i, restriction: 'vegan' },
    { pattern: /\bvegetarian\b/i, restriction: 'vegetarian' },
    { pattern: /\bgluten.free\b/i, restriction: 'gluten-free' },
    { pattern: /\bdairy.free\b/i, restriction: 'dairy-free' },
    { pattern: /\bnut.free\b/i, restriction: 'nut-free' },
    { pattern: /\bketo\b/i, restriction: 'keto' },
    { pattern: /\bpaleo\b/i, restriction: 'paleo' },
    { pattern: /\blow.carb\b/i, restriction: 'low-carb' },
    { pattern: /\blow.sodium\b/i, restriction: 'low-sodium' },
    { pattern: /\bno (.*?)\b/i, restriction: 'no $1' }
  ];

  patterns.forEach(({ pattern, restriction }) => {
    const match = prompt.match(pattern);
    if (match) {
      if (restriction.includes('$1') && match[1]) {
        restrictions.push(restriction.replace('$1', match[1].trim()));
      } else {
        restrictions.push(restriction);
      }
    }
  });

  return restrictions;
}

/**
 * Extract cuisine type from natural language
 */
function extractCuisineType(prompt: string): string | undefined {
  const cuisines = [
    'italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian', 'french',
    'mediterranean', 'american', 'korean', 'vietnamese', 'greek', 'spanish',
    'middle eastern', 'moroccan', 'brazilian', 'german', 'british'
  ];

  for (const cuisine of cuisines) {
    if (prompt.includes(cuisine)) {
      return cuisine;
    }
  }

  return undefined;
}

/**
 * Extract cooking time preference from natural language
 */
function extractCookingTime(prompt: string): string | undefined {
  const timePatterns = [
    { pattern: /\bquick\b|\bfast\b|\b15.min\b|\b20.min\b/i, time: 'quick' },
    { pattern: /\b30.min\b|\bhalf.hour\b/i, time: '30 minutes' },
    { pattern: /\b1.hour\b|\bone.hour\b/i, time: '1 hour' },
    { pattern: /\bslow\b|\ball.day\b/i, time: 'slow cooking' }
  ];

  for (const { pattern, time } of timePatterns) {
    if (pattern.test(prompt)) {
      return time;
    }
  }

  return undefined;
}

/**
 * Extract difficulty preference from natural language
 */
function extractDifficulty(prompt: string): RecipeDifficulty | undefined {
  if (/\beasy\b|\bsimple\b|\bbeginner\b/i.test(prompt)) {
    return 'Easy';
  }
  if (/\bmedium\b|\bintermediate\b/i.test(prompt)) {
    return 'Medium';
  }
  if (/\bhard\b|\bdifficult\b|\badvanced\b|\bcomplex\b/i.test(prompt)) {
    return 'Hard';
  }
  return undefined;
}

/**
 * Extract number of servings from natural language
 */
function extractServings(prompt: string): number | undefined {
  const servingPatterns = [
    /\bfor (\d+)\b/i,
    /\bserves? (\d+)\b/i,
    /\b(\d+) people\b/i,
    /\b(\d+) person\b/i
  ];

  for (const pattern of servingPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const servings = parseInt(match[1], 10);
      if (servings > 0 && servings <= 20) {
        return servings;
      }
    }
  }

  return undefined;
}

/**
 * Determine meal type from prompt
 */
function determineMealType(prompt: string): MealType | undefined {
  const lowerPrompt = prompt.toLowerCase();

  if (/\bbreakfast\b|\bmorning\b|\bbrunch\b/i.test(lowerPrompt)) {
    return 'breakfast';
  }
  if (/\blunch\b|\bmidday\b|\bnoon\b/i.test(lowerPrompt)) {
    return 'lunch';
  }
  if (/\bdinner\b|\bevening\b|\bsupper\b/i.test(lowerPrompt)) {
    return 'dinner';
  }

  return undefined;
}

/**
 * Validate and enhance recipe data
 */
export async function validateAndEnhanceRecipe(
  recipeData: Partial<Recipe>,
  userPreferences?: UserPreferences
): Promise<Partial<Recipe>> {
  // Validate required fields
  if (!recipeData.recipe_name) {
    throw new Error('Recipe name is required');
  }

  if (!recipeData.ingredients || !Array.isArray(recipeData.ingredients) || recipeData.ingredients.length === 0) {
    throw new Error('Recipe must have ingredients');
  }

  if (!recipeData.instructions) {
    throw new Error('Recipe must have instructions');
  }

  // Enhance with defaults
  let enhanced = {
    ...recipeData,
    prep_time: recipeData.prep_time || 15,
    cook_time: recipeData.cook_time || 30,
    servings: recipeData.servings || 4,
    estimated_cost: recipeData.estimated_cost || 12.00,
    difficulty: recipeData.difficulty || 'Easy',
    season: recipeData.season || getCurrentSeason(),
    tags: recipeData.tags || [],
    variations: recipeData.variations || [],
    cooking_tips: recipeData.cooking_tips || []
  };

  // Standardize ingredient measurements
  if (enhanced.ingredients) {
    enhanced.ingredients = standardizeIngredientMeasurements(enhanced.ingredients);
  }

  // Enhance nutritional information
  if (enhanced.nutritional_info) {
    enhanced.nutritional_info = enhanceNutritionalInfo(enhanced.nutritional_info);
  }

  // Apply advanced metadata enhancement
  enhanced = await enhanceRecipeMetadata(enhanced);

  // Apply dietary analysis if user preferences are provided
  if (userPreferences && enhanced.ingredients) {
    const recipe = enhanced as Recipe;

    // Validate dietary compliance
    enhanced.dietary_compliance = await dietaryService.validateRecipeDietaryCompliance(
      recipe,
      userPreferences
    );

    // Detect allergens
    const allergenWarnings = await dietaryService.detectAllergens(recipe);
    enhanced.allergen_warnings = await dietaryService.checkAllergenSensitivities(
      allergenWarnings,
      userPreferences
    );

    // Generate enhanced substitution suggestions
    enhanced.substitution_suggestions = await dietaryService.getEnhancedSubstitutionSuggestions(
      recipe,
      userPreferences
    );
  }

  return enhanced;
}

/**
 * Standardize ingredient measurements
 */
function standardizeIngredientMeasurements(ingredients: any[]): Ingredient[] {
  return ingredients.map(ingredient => {
    if (typeof ingredient === 'string') {
      // Parse string format "quantity ingredient"
      const parts = ingredient.split(' ');
      const quantity = parts[0];
      const name = parts.slice(1).join(' ');

      return {
        name: name || ingredient,
        quantity: quantity || '1',
        checked: false
      };
    }

    if (ingredient.item) {
      // Convert old format to new format
      return {
        name: ingredient.item,
        quantity: ingredient.amount || ingredient.quantity || '1',
        checked: false,
        notes: ingredient.notes,
        substitutions: ingredient.substitutions
      };
    }

    // Already in correct format
    return {
      name: ingredient.name || 'Unknown ingredient',
      quantity: ingredient.quantity || '1',
      checked: ingredient.checked || false,
      notes: ingredient.notes,
      substitutions: ingredient.substitutions
    };
  });
}

/**
 * Enhance nutritional information
 */
function enhanceNutritionalInfo(nutritionalInfo: any): any {
  return {
    calories: nutritionalInfo.calories || 0,
    protein: nutritionalInfo.protein || '0g',
    carbs: nutritionalInfo.carbs || '0g',
    fats: nutritionalInfo.fats || '0g',
    highlights: nutritionalInfo.highlights || 'Nutritional information estimated',
    // Add additional fields if available
    fiber: nutritionalInfo.fiber,
    sodium: nutritionalInfo.sodium
  };
}

/**
 * Process recipe modification request with variation tracking
 */
export async function modifyExistingRecipe(
  recipeId: string,
  modificationRequest: string,
  sessionId?: string
): Promise<{
  modifiedRecipe: Recipe;
  variation: any;
  explanation: any;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get original recipe
  const { data: originalRecipe, error: fetchError } = await supabase
    .from('daily_recipes')
    .select('*')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !originalRecipe) {
    throw new Error('Recipe not found');
  }

  // Use variation service for comprehensive modification
  const { variationService } = await import('@/services/variationService');

  const { variation, explanation } = await variationService.createRecipeVariation(
    recipeId,
    modificationRequest,
    sessionId
  );

  // Save the variation as a new recipe for easy access
  const modifiedRecipe = await variationService.saveVariationAsNewRecipe(
    variation.id,
    variation.variation_name
  );

  return {
    modifiedRecipe,
    variation,
    explanation
  };
}

/**
 * Get recipe modification history
 */
export async function getRecipeModificationHistory(recipeId: string): Promise<{
  original: Recipe;
  variations: any[];
  comparison: any;
}> {
  const { variationService } = await import('@/services/variationService');

  const comparison = await variationService.compareRecipeVersions(recipeId);

  return {
    original: comparison.original,
    variations: comparison.variations,
    comparison: comparison.differences
  };
}

/**
 * Rollback to a previous recipe version
 */
export async function rollbackToRecipeVersion(
  originalRecipeId: string,
  variationId?: string
): Promise<Recipe> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (variationId) {
    // Rollback to a specific variation
    const { variationService } = await import('@/services/variationService');
    return await variationService.saveVariationAsNewRecipe(variationId, undefined);
  } else {
    // Rollback to original recipe
    const { data: originalRecipe, error } = await supabase
      .from('daily_recipes')
      .select('*')
      .eq('id', originalRecipeId)
      .eq('user_id', user.id)
      .single();

    if (error || !originalRecipe) {
      throw new Error('Original recipe not found');
    }

    // Create a new copy of the original recipe
    const { data: rolledBackRecipe, error: insertError } = await supabase
      .from('daily_recipes')
      .insert({
        user_id: user.id,
        recipe_date: new Date().toISOString().split('T')[0],
        meal_type: originalRecipe.meal_type,
        recipe_name: `${originalRecipe.recipe_name} (Restored)`,
        ingredients: originalRecipe.ingredients,
        instructions: originalRecipe.instructions,
        prep_time: originalRecipe.prep_time,
        cook_time: originalRecipe.cook_time,
        servings: originalRecipe.servings,
        estimated_cost: originalRecipe.estimated_cost,
        nutritional_info: originalRecipe.nutritional_info,
        season: originalRecipe.season,
        difficulty: originalRecipe.difficulty,
        cuisine_type: originalRecipe.cuisine_type,
        tags: originalRecipe.tags,
        variations: originalRecipe.variations,
        cooking_tips: originalRecipe.cooking_tips,
        image_url: originalRecipe.image_url,
        image_source: originalRecipe.image_source,
        image_attribution: originalRecipe.image_attribution,
        created_via: 'chat',
        ai_model_used: originalRecipe.ai_model_used
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return rolledBackRecipe;
  }
}

/**
 * Check if recipe has significant changes that warrant a new image
 */
function hasSignificantChanges(original: Recipe, modified: Partial<Recipe>): boolean {
  // Check if recipe name changed significantly
  if (modified.recipe_name &&
    original.recipe_name.toLowerCase() !== modified.recipe_name.toLowerCase()) {
    return true;
  }

  // Check if cuisine type changed
  if (modified.cuisine_type &&
    original.cuisine_type !== modified.cuisine_type) {
    return true;
  }

  // Check if main ingredients changed (first 3 ingredients)
  if (modified.ingredients && original.ingredients) {
    const originalMain = original.ingredients.slice(0, 3).map(i => i.name.toLowerCase());
    const modifiedMain = modified.ingredients.slice(0, 3).map(i => i.name.toLowerCase());

    const hasNewIngredients = modifiedMain.some(ingredient =>
      !originalMain.includes(ingredient)
    );

    if (hasNewIngredients) {
      return true;
    }
  }

  return false;
}
/**
 * 
Enhanced recipe metadata calculation and enhancement
 */
export async function enhanceRecipeMetadata(recipeData: any): Promise<any> {
  const enhanced = { ...recipeData };

  // Calculate and enhance timing information
  enhanced.prep_time = calculateOptimalPrepTime(enhanced);
  enhanced.cook_time = calculateOptimalCookTime(enhanced);

  // Determine difficulty based on ingredients and instructions
  if (!enhanced.difficulty) {
    enhanced.difficulty = calculateRecipeDifficulty(enhanced);
  }

  // Generate tags based on recipe content
  enhanced.tags = generateRecipeTags(enhanced);

  // Enhance nutritional information with calculations
  if (enhanced.nutritional_info) {
    enhanced.nutritional_info = calculateEnhancedNutrition(enhanced);
  }

  // Add cooking tips based on ingredients and techniques
  enhanced.cooking_tips = generateCookingTips(enhanced);

  // Generate recipe variations
  enhanced.variations = generateRecipeVariations(enhanced);

  // Estimate cost more accurately
  enhanced.estimated_cost = calculateAccurateCost(enhanced);

  return enhanced;
}

/**
 * Calculate optimal prep time based on ingredients and complexity
 */
function calculateOptimalPrepTime(recipe: Partial<Recipe>): number {
  let baseTime = 10; // Base prep time

  if (recipe.ingredients) {
    // Add time based on ingredient complexity
    recipe.ingredients.forEach(ingredient => {
      const name = getIngredientName(ingredient);
      const lowerName = name.toLowerCase();

      // Vegetables that need chopping
      if (lowerName.includes('onion') || lowerName.includes('garlic') ||
        lowerName.includes('carrot') || lowerName.includes('celery')) {
        baseTime += 3;
      }

      // Proteins that need preparation
      if (lowerName.includes('chicken') || lowerName.includes('beef') ||
        lowerName.includes('fish')) {
        baseTime += 5;
      }

      // Complex preparations
      if (lowerName.includes('marinate') || lowerName.includes('dice') ||
        lowerName.includes('mince')) {
        baseTime += 2;
      }
    });
  }

  // Adjust based on difficulty
  if (recipe.difficulty === 'Medium') {
    baseTime *= 1.3;
  } else if (recipe.difficulty === 'Hard') {
    baseTime *= 1.6;
  }

  return Math.round(Math.max(baseTime, recipe.prep_time || 10));
}

/**
 * Calculate optimal cook time based on cooking methods
 */
function calculateOptimalCookTime(recipe: Partial<Recipe>): number {
  let baseTime = 20; // Base cook time

  if (recipe.instructions) {
    const instructions = recipe.instructions.toLowerCase();

    // Cooking method time adjustments
    if (instructions.includes('bake') || instructions.includes('roast')) {
      baseTime = Math.max(baseTime, 25);
    }
    if (instructions.includes('simmer') || instructions.includes('braise')) {
      baseTime = Math.max(baseTime, 30);
    }
    if (instructions.includes('slow cook') || instructions.includes('stew')) {
      baseTime = Math.max(baseTime, 45);
    }
    if (instructions.includes('quick') || instructions.includes('sauté')) {
      baseTime = Math.min(baseTime, 15);
    }

    // Time indicators in instructions
    const timeMatches = instructions.match(/(\d+)\s*(?:minutes?|mins?)/gi);
    if (timeMatches) {
      const extractedTimes = timeMatches.map(match => {
        const num = parseInt(match.match(/\d+/)?.[0] || '0');
        return num;
      });
      const maxTime = Math.max(...extractedTimes);
      if (maxTime > 0) {
        baseTime = Math.max(baseTime, maxTime);
      }
    }
  }

  return Math.round(Math.max(baseTime, recipe.cook_time || 20));
}

/**
 * Calculate recipe difficulty based on ingredients and techniques
 */
function calculateRecipeDifficulty(recipe: Partial<Recipe>): RecipeDifficulty {
  let complexityScore = 0;

  // Ingredient complexity
  if (recipe.ingredients) {
    complexityScore += recipe.ingredients.length * 0.5;

    recipe.ingredients.forEach(ingredient => {
      const name = getIngredientName(ingredient);
      const lowerName = name.toLowerCase();

      // Complex ingredients
      if (lowerName.includes('wine') || lowerName.includes('stock') ||
        lowerName.includes('cream') || lowerName.includes('specialty')) {
        complexityScore += 1;
      }
    });
  }

  // Instruction complexity
  if (recipe.instructions) {
    const instructions = recipe.instructions.toLowerCase();

    // Complex techniques
    const complexTechniques = [
      'fold', 'whisk', 'emulsify', 'reduce', 'deglaze', 'braise',
      'confit', 'sous vide', 'flambé', 'tempering'
    ];

    complexTechniques.forEach(technique => {
      if (instructions.includes(technique)) {
        complexityScore += 2;
      }
    });

    // Multiple cooking methods
    const cookingMethods = ['bake', 'fry', 'sauté', 'boil', 'grill', 'roast'];
    const methodCount = cookingMethods.filter(method =>
      instructions.includes(method)
    ).length;

    if (methodCount > 2) {
      complexityScore += methodCount;
    }
  }

  // Time complexity
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  if (totalTime > 60) {
    complexityScore += 2;
  } else if (totalTime > 30) {
    complexityScore += 1;
  }

  // Determine difficulty
  if (complexityScore <= 5) {
    return 'Easy';
  } else if (complexityScore <= 12) {
    return 'Medium';
  } else {
    return 'Hard';
  }
}

/**
 * Generate relevant tags for the recipe
 */
function generateRecipeTags(recipe: Partial<Recipe>): string[] {
  const tags: string[] = [];

  // Time-based tags
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  if (totalTime <= 20) {
    tags.push('quick');
  } else if (totalTime <= 30) {
    tags.push('30-minute');
  } else if (totalTime >= 60) {
    tags.push('slow-cooked');
  }

  // Difficulty tags
  if (recipe.difficulty === 'Easy') {
    tags.push('beginner-friendly');
  } else if (recipe.difficulty === 'Hard') {
    tags.push('advanced');
  }

  // Ingredient-based tags
  if (recipe.ingredients) {
    const ingredientText = recipe.ingredients
      .map(ing => getIngredientName(ing))
      .join(' ')
      .toLowerCase();

    if (ingredientText.includes('vegetable') || ingredientText.includes('veggie')) {
      tags.push('vegetable-rich');
    }
    if (ingredientText.includes('protein') || ingredientText.includes('chicken') ||
      ingredientText.includes('fish') || ingredientText.includes('beef')) {
      tags.push('protein-rich');
    }
    if (ingredientText.includes('cheese') || ingredientText.includes('cream')) {
      tags.push('creamy');
    }
    if (ingredientText.includes('spice') || ingredientText.includes('pepper') ||
      ingredientText.includes('chili')) {
      tags.push('spicy');
    }
  }

  // Cooking method tags
  if (recipe.instructions) {
    const instructions = recipe.instructions.toLowerCase();

    if (instructions.includes('bake') || instructions.includes('oven')) {
      tags.push('baked');
    }
    if (instructions.includes('grill')) {
      tags.push('grilled');
    }
    if (instructions.includes('one pot') || instructions.includes('one-pot')) {
      tags.push('one-pot');
    }
    if (instructions.includes('no cook') || instructions.includes('raw')) {
      tags.push('no-cook');
    }
  }

  // Nutritional tags
  if (recipe.nutritional_info) {
    const calories = recipe.nutritional_info.calories || 0;
    if (calories < 300) {
      tags.push('low-calorie');
    } else if (calories > 600) {
      tags.push('hearty');
    }
  }

  // Cost tags
  if (recipe.estimated_cost) {
    if (recipe.estimated_cost < 8) {
      tags.push('budget-friendly');
    } else if (recipe.estimated_cost > 20) {
      tags.push('premium');
    }
  }

  // Season tags
  if (recipe.season) {
    tags.push(`${recipe.season}-seasonal`);
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Calculate enhanced nutritional information
 */
function calculateEnhancedNutrition(recipe: Partial<Recipe>): any {
  const nutrition = recipe.nutritional_info || {};

  // Estimate missing nutritional values based on ingredients
  if (recipe.ingredients && !nutrition.calories) {
    nutrition.calories = estimateCalories(recipe.ingredients, recipe.servings);
  }

  // Add nutritional highlights
  const highlights: string[] = [];

  if (nutrition.protein && parseInt(nutrition.protein) > 20) {
    highlights.push('High in protein');
  }
  if (nutrition.fiber && parseInt(nutrition.fiber) > 5) {
    highlights.push('Good source of fiber');
  }
  if (nutrition.calories && nutrition.calories < 300) {
    highlights.push('Low calorie');
  }

  // Analyze ingredients for nutritional benefits
  if (recipe.ingredients) {
    const ingredientText = recipe.ingredients
      .map(ing => getIngredientName(ing))
      .join(' ')
      .toLowerCase();

    if (ingredientText.includes('spinach') || ingredientText.includes('kale')) {
      highlights.push('Rich in iron');
    }
    if (ingredientText.includes('salmon') || ingredientText.includes('fish')) {
      highlights.push('Omega-3 fatty acids');
    }
    if (ingredientText.includes('avocado')) {
      highlights.push('Healthy fats');
    }
  }

  nutrition.highlights = highlights.length > 0 ? highlights.join(', ') : nutrition.highlights;

  return nutrition;
}

/**
 * Estimate calories based on ingredients
 */
function estimateCalories(ingredients: any[], servings?: number): number {
  let totalCalories = 0;

  ingredients.forEach(ingredient => {
    const name = getIngredientName(ingredient);
    const lowerName = name.toLowerCase();

    // Basic calorie estimates per common ingredient
    if (lowerName.includes('oil') || lowerName.includes('butter')) {
      totalCalories += 120;
    } else if (lowerName.includes('cheese')) {
      totalCalories += 100;
    } else if (lowerName.includes('chicken') || lowerName.includes('beef')) {
      totalCalories += 150;
    } else if (lowerName.includes('fish')) {
      totalCalories += 120;
    } else if (lowerName.includes('rice') || lowerName.includes('pasta')) {
      totalCalories += 200;
    } else if (lowerName.includes('vegetable')) {
      totalCalories += 25;
    } else {
      totalCalories += 50; // Default for other ingredients
    }
  });

  return Math.round(totalCalories / (servings || 4));
}

/**
 * Generate cooking tips based on recipe content
 */
function generateCookingTips(recipe: Partial<Recipe>): string[] {
  const tips: string[] = [];

  if (recipe.ingredients) {
    const ingredientText = recipe.ingredients
      .map(ing => getIngredientName(ing))
      .join(' ')
      .toLowerCase();

    // Ingredient-specific tips
    if (ingredientText.includes('garlic')) {
      tips.push('Crush garlic with the flat side of your knife to release more flavor');
    }
    if (ingredientText.includes('onion')) {
      tips.push('Chill onions in the refrigerator before cutting to reduce tears');
    }
    if (ingredientText.includes('meat') || ingredientText.includes('chicken')) {
      tips.push('Let meat rest at room temperature for 15 minutes before cooking for even cooking');
    }
    if (ingredientText.includes('pasta')) {
      tips.push('Save some pasta water to help bind your sauce');
    }
  }

  if (recipe.instructions) {
    const instructions = recipe.instructions.toLowerCase();

    // Technique-specific tips
    if (instructions.includes('sauté')) {
      tips.push('Heat your pan before adding oil for better sautéing');
    }
    if (instructions.includes('bake')) {
      tips.push('Preheat your oven for at least 15 minutes for consistent results');
    }
    if (instructions.includes('season')) {
      tips.push('Taste and adjust seasoning throughout cooking, not just at the end');
    }
  }

  // General tips based on difficulty
  if (recipe.difficulty === 'Easy') {
    tips.push('This recipe is perfect for beginners - take your time and enjoy the process');
  } else if (recipe.difficulty === 'Hard') {
    tips.push('Read through the entire recipe before starting to ensure you have all equipment ready');
  }

  return tips.slice(0, 3); // Limit to 3 tips
}

/**
 * Generate recipe variations
 */
function generateRecipeVariations(recipe: Partial<Recipe>): string[] {
  const variations: string[] = [];

  if (recipe.ingredients) {
    const ingredientText = recipe.ingredients
      .map(ing => getIngredientName(ing))
      .join(' ')
      .toLowerCase();

    // Protein variations
    if (ingredientText.includes('chicken')) {
      variations.push('Substitute chicken with turkey or tofu for variety');
    }
    if (ingredientText.includes('beef')) {
      variations.push('Try with lamb or portobello mushrooms for different flavors');
    }

    // Vegetable variations
    if (ingredientText.includes('broccoli')) {
      variations.push('Replace broccoli with cauliflower or green beans');
    }

    // Grain variations
    if (ingredientText.includes('rice')) {
      variations.push('Use quinoa or cauliflower rice for a healthier option');
    }
  }

  // Cuisine variations
  if (recipe.cuisine_type) {
    const cuisine = recipe.cuisine_type.toLowerCase();
    if (cuisine.includes('italian')) {
      variations.push('Add Mediterranean herbs like oregano and basil for authentic flavor');
    }
    if (cuisine.includes('asian')) {
      variations.push('Include ginger and soy sauce for enhanced Asian flavors');
    }
  }

  // Spice level variations
  variations.push('Adjust spice level by adding more or less pepper to taste');

  return variations.slice(0, 3); // Limit to 3 variations
}

/**
 * Calculate more accurate cost estimation
 */
function calculateAccurateCost(recipe: Partial<Recipe>): number {
  if (!recipe.ingredients) {
    return recipe.estimated_cost || 12.00;
  }

  let totalCost = 0;

  recipe.ingredients.forEach(ingredient => {
    const name = getIngredientName(ingredient);
    const lowerName = name.toLowerCase();

    // Cost estimates per ingredient category
    if (lowerName.includes('meat') || lowerName.includes('chicken') || lowerName.includes('beef')) {
      totalCost += 4.00;
    } else if (lowerName.includes('fish') || lowerName.includes('seafood')) {
      totalCost += 5.00;
    } else if (lowerName.includes('cheese')) {
      totalCost += 2.50;
    } else if (lowerName.includes('vegetable') || lowerName.includes('fruit')) {
      totalCost += 1.00;
    } else if (lowerName.includes('spice') || lowerName.includes('herb')) {
      totalCost += 0.50;
    } else if (lowerName.includes('oil') || lowerName.includes('vinegar')) {
      totalCost += 0.75;
    } else {
      totalCost += 1.50; // Default cost
    }
  });

  // Adjust for servings
  const servings = recipe.servings || 4;
  const costPerServing = totalCost / servings;

  return Math.round((totalCost + (costPerServing * 0.2)) * 100) / 100; // Add 20% for misc costs
}

/**
 * Batch enhance multiple recipes with images and metadata
 */
export async function batchEnhanceRecipes(recipeIds: string[]): Promise<{
  enhanced: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    enhanced: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const recipeId of recipeIds) {
    try {
      // Get recipe
      const { data: recipe, error } = await supabase
        .from('daily_recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (error || !recipe) {
        results.failed++;
        results.errors.push(`Recipe ${recipeId} not found`);
        continue;
      }

      // Enhance metadata
      const enhancedData = await enhanceRecipeMetadata(recipe);

      // Fetch image if missing
      let imageResult = null;
      if (!recipe.image_url) {
        imageResult = await fetchRecipeImage(enhancedData);
      }

      // Update recipe
      const updateData: any = {
        ...enhancedData,
        updated_at: new Date().toISOString()
      };

      if (imageResult) {
        updateData.image_url = imageResult.url;
        updateData.image_source = imageResult.source;
        updateData.image_attribution = imageResult.attribution;
      }

      const { error: updateError } = await supabase
        .from('daily_recipes')
        .update(updateData)
        .eq('id', recipeId);

      if (updateError) {
        results.failed++;
        results.errors.push(`Failed to update recipe ${recipeId}: ${updateError.message}`);
      } else {
        results.enhanced++;
      }

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.failed++;
      results.errors.push(`Error enhancing recipe ${recipeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
}

/**
 * Helper function to extract ingredient name from various formats
 */
function getIngredientName(ingredient: any): string {
  if (typeof ingredient === 'string') {
    return ingredient;
  }
  return ingredient.name || (ingredient as any).item || '';
}