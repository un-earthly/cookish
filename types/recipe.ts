export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type ApiProvider = 'openai' | 'gemini' | 'claude';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type SubscriptionTier = 'free' | 'premium';
export type CookingSkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ImageSource = 'unsplash' | 'pexels' | 'placeholder' | 'ai_generated';
export type RecipeCreationMethod = 'chat' | 'daily' | 'manual';
export type ChatRole = 'user' | 'assistant';

export interface Ingredient {
  name: string;
  quantity: string;
  checked?: boolean;
  notes?: string;
  substitutions?: string[];
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
    fiber?: string;
    sodium?: string;
    highlights?: string;
  };
  season: Season;
  is_favorite: boolean;
  created_at: string;
  // New AI-related fields
  image_url?: string;
  image_source?: ImageSource;
  image_attribution?: string;
  created_via?: RecipeCreationMethod;
  chat_session_id?: string;
  ai_model_used?: string;
  difficulty?: RecipeDifficulty;
  cuisine_type?: string;
  tags?: string[];
  variations?: string[];
  cooking_tips?: string[];
  // Dietary compliance fields
  dietary_compliance?: DietaryComplianceResult;
  allergen_warnings?: AllergenWarning[];
  nutritional_analysis?: EnhancedNutritionalInfo;
  substitution_suggestions?: SubstitutionSuggestion[];
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
  // New AI-related fields
  subscription_tier?: SubscriptionTier;
  preferred_ai_model?: string;
  voice_enabled?: boolean;
  image_preferences?: {
    enabled: boolean;
    sources: ImageSource[];
  };
  dietary_restrictions?: string[];
  cooking_skill_level?: CookingSkillLevel;
  preferred_cuisines?: string[];
  // Enhanced dietary restriction fields
  detailed_dietary_restrictions?: DetailedDietaryRestrictions;
  allergen_profile?: AllergenProfile;
  nutritional_goals?: NutritionalGoals;
  ingredient_blacklist?: string[];
  ingredient_preferences?: IngredientPreferences;
  dietary_restriction_presets?: string[];
  // Extended dietary fields
  dietary_goals?: DietaryGoals;
  meal_timing_preferences?: MealTimingPreferences;
  cooking_restrictions?: CookingRestrictions;
  cultural_dietary_preferences?: CulturalDietaryPreferences;
  seasonal_preferences?: SeasonalPreferences;
  budget_constraints?: BudgetConstraints;
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
// Chat-related interfaces
export interface ChatSession {
  id: string;
  user_id: string;
  title?: string;
  started_at: string;
  last_activity: string;
  message_count: number;
  is_active: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  voice_input: boolean;
  recipe_id?: string;
  processing_time?: number;
  created_at: string;
  recipe?: Recipe; // Populated when message contains a recipe
}

// AI Router and Processing interfaces
export interface AIRouterConfig {
  subscriptionTier: SubscriptionTier;
  isOnline: boolean;
  localModelReady: boolean;
  preferredModel?: string;
}

export interface RecipeRequest {
  prompt: string;
  dietaryRestrictions?: string[];
  preferredCuisine?: string;
  cookingTime?: string;
  difficulty?: RecipeDifficulty;
  servings?: number;
  sessionId?: string;
}

export interface ProcessingState {
  isListening: boolean;
  isTranscribing: boolean;
  isGenerating: boolean;
  currentStep: string;
  progress?: number;
  estimatedTime?: number;
}

// Image service interfaces
export interface ImageSearchParams {
  recipeName: string;
  cuisine?: string;
  mainIngredients: string[];
  cookingMethod?: string;
}

export interface ImageResult {
  url: string;
  source: ImageSource;
  attribution?: string;
  cached: boolean;
  width?: number;
  height?: number;
}

// Enhanced recipe generation interfaces
export interface EnhancedRecipe extends Recipe {
  description?: string;
  story?: string;
  pairingIdeas?: string[];
  nutritionDetails?: {
    fiber?: string;
    sodium?: string;
    sugar?: string;
    saturatedFat?: string;
  };
  allergens?: string[];
  equipmentNeeded?: string[];
  storageInstructions?: string;
  reheatingInstructions?: string;
}

// Voice input interfaces
export interface VoiceInputResult {
  transcript: string;
  confidence: number;
  language?: string;
  duration: number;
}

export interface VoiceCommand {
  action: 'generate_recipe' | 'modify_recipe' | 'save_recipe' | 'start_chat';
  parameters?: Record<string, any>;
  confidence: number;
}

// Local AI model interfaces
export interface LocalModelInfo {
  name: string;
  size: number; // in bytes
  version: string;
  downloaded: boolean;
  downloadProgress?: number;
  path?: string;
}

export interface ModelDownloadProgress {
  modelName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  status: 'downloading' | 'paused' | 'completed' | 'error';
  error?: string;
}

// Enhanced dietary restriction interfaces
export interface DetailedDietaryRestrictions {
  [restrictionName: string]: {
    reason: string;
    severity: 'mild' | 'moderate' | 'strict';
    exceptions?: string[];
    notes?: string;
  };
}

export interface AllergenProfile {
  [allergen: string]: {
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    symptoms?: string[];
    cross_reactivity?: string[];
    emergency_contact?: string;
  };
}

export interface NutritionalGoals {
  daily_calories?: number;
  protein_target?: number;
  carb_limit?: number;
  fat_target?: number;
  fiber_target?: number;
  sodium_limit?: number;
  sugar_limit?: number;
  special_requirements?: string[];
}

export interface IngredientPreferences {
  preferred_substitutions: {
    [ingredient: string]: string[];
  };
  favorite_ingredients: string[];
  disliked_ingredients: string[];
  texture_preferences?: string[];
  flavor_preferences?: string[];
}

export interface DietaryRestrictionPreset {
  id: string;
  name: string;
  description: string;
  restricted_ingredients: string[];
  allowed_substitutions: {
    [ingredient: string]: string[];
  };
  nutritional_focus: {
    [nutrient: string]: string;
  };
  is_active: boolean;
}

export interface AllergenInfo {
  id: string;
  ingredient_name: string;
  common_allergens: string[];
  cross_contamination_risk: string[];
  alternative_names: string[];
  severity_level: 'low' | 'medium' | 'high' | 'severe';
}

export interface DietaryComplianceResult {
  compliant: boolean;
  violations: {
    ingredient: string;
    restriction: string;
    reason: string;
  }[];
  warnings: {
    ingredient: string;
    concern: string;
    suggestion?: string;
  }[];
}

export interface AllergenWarning {
  ingredient: string;
  allergens: string[];
  severity: 'low' | 'medium' | 'high' | 'severe';
  cross_contamination_risk: string[];
}

export interface SubstitutionSuggestion {
  original_ingredient: string;
  dietary_restriction: string;
  substitutions: string[];
  reason: string;
  nutritional_impact?: string;
}

export interface EnhancedNutritionalInfo {
  calories?: number;
  protein?: string;
  carbs?: string;
  fats?: string;
  fiber?: string;
  sodium?: string;
  sugar?: string;
  saturated_fat?: string;
  cholesterol?: string;
  potassium?: string;
  vitamin_c?: string;
  calcium?: string;
  iron?: string;
  highlights?: string;
  per_serving?: boolean;
  confidence_score?: number;
}

// Extended dietary preference types
export interface DietaryGoals {
  weight_management?: 'weight_loss' | 'weight_gain' | 'maintenance';
  health_condition?: string;
  fitness_goals?: string[];
  energy_level_goals?: 'increase' | 'maintain' | 'balance';
  muscle_building?: boolean;
  heart_health?: boolean;
  digestive_health?: boolean;
  mental_clarity?: boolean;
}

export interface MealTimingPreferences {
  intermittent_fasting?: {
    enabled: boolean;
    eating_window_hours: number;
    fasting_start_time: string;
  };
  meal_frequency?: 'three_meals' | 'five_small_meals' | 'two_meals' | 'flexible';
  preferred_meal_times?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snacks?: string[];
  };
  late_night_eating?: boolean;
}

export interface CookingRestrictions {
  max_cook_time?: number;
  max_prep_time?: number;
  equipment_limitations?: string[];
  skill_level?: 'beginner' | 'intermediate' | 'advanced';
  physical_limitations?: string[];
  kitchen_size?: 'small' | 'medium' | 'large';
  available_appliances?: string[];
  preferred_cooking_methods?: string[];
}

export interface CulturalDietaryPreferences {
  [cultureName: string]: {
    description: string;
    restrictions: string[];
    preferred_ingredients: string[];
    cooking_methods: string[];
    religious_requirements?: string[];
    traditional_dishes?: string[];
    avoid_combinations?: string[];
  };
}

export interface SeasonalPreferences {
  prefer_seasonal_ingredients?: boolean;
  seasonal_restrictions?: {
    [season: string]: {
      preferred_ingredients: string[];
      avoided_ingredients: string[];
    };
  };
  local_sourcing_preference?: 'required' | 'preferred' | 'flexible';
  preservation_methods?: string[];
}

export interface BudgetConstraints {
  max_cost_per_serving?: number;
  max_weekly_budget?: number;
  preferred_cost_range?: 'budget' | 'moderate' | 'premium';
  cost_priority?: 'lowest' | 'balanced' | 'quality_focused';
  bulk_buying_preference?: boolean;
  seasonal_pricing_awareness?: boolean;
  store_preferences?: string[];
}

// Enhanced dietary compliance types
export interface EnhancedDietaryComplianceResult extends DietaryComplianceResult {
  compliance_score?: number;
  validation_status?: 'compliant' | 'warnings' | 'violations';
  applied_restrictions?: string[];
  dietary_profile_applied?: boolean;
  suggestions?: {
    original_ingredient: string;
    alternatives: string[];
    reason: string;
  }[];
}

export interface DietaryValidationMetadata {
  compliance_score: number;
  validation_status: 'compliant' | 'non_compliant';
  validation_issues: string[];
  validation_suggestions: string[];
  validation_timestamp: string;
  validation_version: string;
}

// Recipe variation and modification interfaces
export interface RecipeVariation {
  id: string;
  user_id: string;
  original_recipe_id: string;
  variation_name: string;
  variation_description: string;
  recipe_data: Partial<Recipe>;
  created_via: 'chat' | 'manual';
  chat_session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ModificationExplanation {
  changes_made: string[];
  reasoning: string[];
  impact_on_nutrition: string;
  impact_on_cooking_time: string;
  impact_on_difficulty: string;
  suggestions: string[];
}

export interface RecipeComparison {
  original: Recipe;
  variations: RecipeVariation[];
  differences: {
    ingredients: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    instructions: string[];
    nutritional: {
      calories_diff: number;
      protein_diff: string;
      carbs_diff: string;
      fats_diff: string;
    };
    timing: {
      prep_time_diff: number;
      cook_time_diff: number;
    };
    cost_diff: number;
  };
}

export interface ConversationalModificationRequest {
  original_recipe_id: string;
  modification_request: string;
  context_from_conversation: string[];
  dietary_preferences_mentioned: string[];
  previous_modifications: string[];
  session_id?: string;
}