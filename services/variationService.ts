import { supabase } from '@/lib/supabase';
import {
    Recipe,
    UserPreferences,
    ApiProvider
} from '@/types/recipe';
import { AIRouterService } from '@/services/aiRouterService';

export interface RecipeVariation {
    id: string;
    original_recipe_id: string;
    variation_name: string;
    variation_description: string;
    recipe_data: Partial<Recipe>;
    created_at: string;
    created_via: 'chat' | 'manual';
    chat_session_id?: string;
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

export interface ModificationExplanation {
    changes_made: string[];
    reasoning: string[];
    impact_on_nutrition: string;
    impact_on_cooking_time: string;
    impact_on_difficulty: string;
    suggestions: string[];
}

export class VariationService {
    private static instance: VariationService;
    private aiRouter: AIRouterService;

    private constructor() {
        this.aiRouter = AIRouterService.getInstance();
    }

    static getInstance(): VariationService {
        if (!VariationService.instance) {
            VariationService.instance = new VariationService();
        }
        return VariationService.instance;
    }

    /**
     * Create a recipe variation based on modification request
     */
    async createRecipeVariation(
        originalRecipeId: string,
        modificationRequest: string,
        sessionId?: string
    ): Promise<{
        variation: RecipeVariation;
        explanation: ModificationExplanation;
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get original recipe
        const { data: originalRecipe, error: fetchError } = await supabase
            .from('daily_recipes')
            .select('*')
            .eq('id', originalRecipeId)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !originalRecipe) {
            throw new Error('Original recipe not found');
        }

        // Initialize AI router
        await this.aiRouter.initialize();

        // Generate modified recipe with explanation
        const { modifiedRecipe, explanation } = await this.generateModificationWithExplanation(
            originalRecipe,
            modificationRequest,
            sessionId
        );

        // Create variation name based on modification
        const variationName = this.generateVariationName(originalRecipe.recipe_name, modificationRequest);

        // Save variation to database
        const { data: variation, error: saveError } = await supabase
            .from('recipe_variations')
            .insert({
                original_recipe_id: originalRecipeId,
                variation_name: variationName,
                variation_description: modificationRequest,
                recipe_data: modifiedRecipe,
                created_via: sessionId ? 'chat' : 'manual',
                chat_session_id: sessionId,
                user_id: user.id
            })
            .select()
            .single();

        if (saveError) throw saveError;

        return {
            variation,
            explanation
        };
    }

    /**
     * Generate recipe modification with detailed explanation
     */
    private async generateModificationWithExplanation(
        originalRecipe: Recipe,
        modificationRequest: string,
        _sessionId?: string
    ): Promise<{
        modifiedRecipe: Partial<Recipe>;
        explanation: ModificationExplanation;
    }> {
        // Get user preferences for context
        const { data: userPrefs } = await supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user) return { data: null };
            return await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
        });

        if (!userPrefs?.api_key) {
            throw new Error('API key not configured');
        }

        // Build enhanced modification prompt with explanation request
        const modificationPrompt = this.buildModificationPromptWithExplanation(
            originalRecipe,
            modificationRequest,
            userPrefs
        );

        // Use AI router to generate modification
        const provider = this.aiRouter.hasPremiumFeatures() ? 'claude' : userPrefs.api_provider || 'openai';

        const response = await this.callAIForModification(
            provider,
            userPrefs.api_key,
            modificationPrompt
        );

        return this.parseModificationResponse(response, originalRecipe);
    }

    /**
     * Build enhanced modification prompt that includes explanation request
     */
    private buildModificationPromptWithExplanation(
        originalRecipe: Recipe,
        modificationRequest: string,
        userPrefs: UserPreferences
    ): string {
        return `You are a professional chef helping modify a recipe. Provide both the modified recipe and a detailed explanation.

ORIGINAL RECIPE:
Name: ${originalRecipe.recipe_name}
Ingredients: ${JSON.stringify(originalRecipe.ingredients, null, 2)}
Instructions: ${originalRecipe.instructions}
Prep Time: ${originalRecipe.prep_time} minutes
Cook Time: ${originalRecipe.cook_time} minutes
Servings: ${originalRecipe.servings}
Difficulty: ${originalRecipe.difficulty}
Cuisine: ${originalRecipe.cuisine_type || 'Not specified'}
Nutritional Info: ${JSON.stringify(originalRecipe.nutritional_info, null, 2)}

USER MODIFICATION REQUEST: "${modificationRequest}"

USER CONTEXT:
- Dietary Restrictions: ${userPrefs.dietary_restrictions?.join(', ') || 'None'}
- Cooking Skill: ${userPrefs.cooking_skill_level || 'beginner'}
- Preferred Cuisines: ${userPrefs.preferred_cuisines?.join(', ') || 'Any'}

REQUIREMENTS:
1. Apply the requested modification while maintaining recipe quality
2. Ensure dietary restrictions are still met
3. Adjust cooking times, temperatures, and techniques as needed
4. Update nutritional information based on ingredient changes
5. Maintain or improve the recipe's difficulty level appropriately

RESPONSE FORMAT (must be valid JSON):
{
  "modified_recipe": {
    // Complete recipe object with all modifications applied
    "recipe_name": "Updated recipe name",
    "ingredients": [...],
    "instructions": "Updated step-by-step instructions",
    "prep_time": number,
    "cook_time": number,
    "servings": number,
    "difficulty": "Easy|Medium|Hard",
    "cuisine_type": "cuisine type",
    "nutritional_info": {...},
    "tags": [...],
    "cooking_tips": [...]
  },
  "explanation": {
    "changes_made": ["List of specific changes made"],
    "reasoning": ["Explanation for each major change"],
    "impact_on_nutrition": "How nutrition changed",
    "impact_on_cooking_time": "How timing changed",
    "impact_on_difficulty": "How difficulty changed",
    "suggestions": ["Additional suggestions for the user"]
  }
}

Return ONLY the JSON object, no additional text.`;
    }

    /**
     * Call AI service for recipe modification
     */
    private async callAIForModification(
        provider: ApiProvider,
        apiKey: string,
        prompt: string
    ): Promise<string> {
        if (provider === 'claude') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 3000,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to modify recipe with Claude');
            }

            const data = await response.json();
            return data.content[0].text.trim();

        } else if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 3000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to modify recipe with OpenAI');
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();

        } else {
            throw new Error(`Recipe modification not supported with ${provider}`);
        }
    }

    /**
     * Parse AI response into structured modification result
     */
    private parseModificationResponse(
        response: string,
        originalRecipe: Recipe
    ): {
        modifiedRecipe: Partial<Recipe>;
        explanation: ModificationExplanation;
    } {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid response format from AI');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.modified_recipe || !parsed.explanation) {
                throw new Error('Missing required fields in AI response');
            }

            // Ensure modified recipe has required fields
            const modifiedRecipe = {
                ...originalRecipe,
                ...parsed.modified_recipe,
                // Preserve original metadata
                id: originalRecipe.id,
                user_id: originalRecipe.user_id,
                recipe_date: originalRecipe.recipe_date,
                created_at: originalRecipe.created_at,
                // Mark as modified
                created_via: 'chat',
                ai_model_used: this.aiRouter.hasPremiumFeatures() ? 'claude-sonnet-4' : 'openai'
            };

            return {
                modifiedRecipe,
                explanation: parsed.explanation
            };

        } catch (error) {
            console.error('Failed to parse modification response:', error);
            throw new Error('Failed to parse AI response for recipe modification');
        }
    }

    /**
     * Generate a descriptive name for the recipe variation
     */
    private generateVariationName(originalName: string, modificationRequest: string): string {
        const request = modificationRequest.toLowerCase();

        // Extract key modification types
        if (request.includes('vegan') || request.includes('plant-based')) {
            return `${originalName} (Vegan Version)`;
        }
        if (request.includes('gluten-free') || request.includes('gluten free')) {
            return `${originalName} (Gluten-Free)`;
        }
        if (request.includes('spicy') || request.includes('spicier')) {
            return `${originalName} (Spicy Version)`;
        }
        if (request.includes('healthy') || request.includes('lighter')) {
            return `${originalName} (Healthy Version)`;
        }
        if (request.includes('quick') || request.includes('faster')) {
            return `${originalName} (Quick Version)`;
        }
        if (request.includes('substitute') || request.includes('replace')) {
            return `${originalName} (Modified)`;
        }

        // Default variation name
        return `${originalName} (Variation)`;
    }

    /**
     * Get all variations for a recipe
     */
    async getRecipeVariations(recipeId: string): Promise<RecipeVariation[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('recipe_variations')
            .select('*')
            .eq('original_recipe_id', recipeId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Compare original recipe with its variations
     */
    async compareRecipeVersions(recipeId: string): Promise<RecipeComparison> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get original recipe
        const { data: originalRecipe, error: originalError } = await supabase
            .from('daily_recipes')
            .select('*')
            .eq('id', recipeId)
            .eq('user_id', user.id)
            .single();

        if (originalError || !originalRecipe) {
            throw new Error('Original recipe not found');
        }

        // Get all variations
        const variations = await this.getRecipeVariations(recipeId);

        // Calculate differences
        const differences = this.calculateRecipeDifferences(originalRecipe, variations);

        return {
            original: originalRecipe,
            variations,
            differences
        };
    }

    /**
     * Calculate differences between original recipe and variations
     */
    private calculateRecipeDifferences(
        original: Recipe,
        variations: RecipeVariation[]
    ): RecipeComparison['differences'] {
        if (variations.length === 0) {
            return {
                ingredients: { added: [], removed: [], modified: [] },
                instructions: [],
                nutritional: {
                    calories_diff: 0,
                    protein_diff: '0g',
                    carbs_diff: '0g',
                    fats_diff: '0g'
                },
                timing: { prep_time_diff: 0, cook_time_diff: 0 },
                cost_diff: 0
            };
        }

        // For simplicity, compare with the most recent variation
        const latestVariation = variations[0];
        const varRecipe = latestVariation.recipe_data as Recipe;

        // Compare ingredients
        const originalIngredients = original.ingredients.map(ing => ing.name.toLowerCase());
        const varIngredients = (varRecipe.ingredients || []).map(ing => ing.name.toLowerCase());

        const added = varIngredients.filter(ing => !originalIngredients.includes(ing));
        const removed = originalIngredients.filter(ing => !varIngredients.includes(ing));
        const modified = originalIngredients.filter(ing =>
            varIngredients.includes(ing) &&
            this.hasIngredientQuantityChanged(original.ingredients, varRecipe.ingredients || [], ing)
        );

        // Compare nutritional info
        const originalNutrition = original.nutritional_info || {};
        const varNutrition = varRecipe.nutritional_info || {};

        const nutritional = {
            calories_diff: (varNutrition.calories || 0) - (originalNutrition.calories || 0),
            protein_diff: this.calculateNutrientDiff(originalNutrition.protein, varNutrition.protein),
            carbs_diff: this.calculateNutrientDiff(originalNutrition.carbs, varNutrition.carbs),
            fats_diff: this.calculateNutrientDiff(originalNutrition.fats, varNutrition.fats)
        };

        // Compare timing
        const timing = {
            prep_time_diff: (varRecipe.prep_time || 0) - original.prep_time,
            cook_time_diff: (varRecipe.cook_time || 0) - original.cook_time
        };

        // Compare cost
        const cost_diff = (varRecipe.estimated_cost || 0) - original.estimated_cost;

        return {
            ingredients: { added, removed, modified },
            instructions: this.compareInstructions(original.instructions, varRecipe.instructions || ''),
            nutritional,
            timing,
            cost_diff
        };
    }

    /**
     * Check if ingredient quantity changed between versions
     */
    private hasIngredientQuantityChanged(
        originalIngredients: any[],
        varIngredients: any[],
        ingredientName: string
    ): boolean {
        const original = originalIngredients.find(ing => ing.name.toLowerCase() === ingredientName);
        const variation = varIngredients.find(ing => ing.name.toLowerCase() === ingredientName);

        if (!original || !variation) return false;

        return original.quantity !== variation.quantity;
    }

    /**
     * Calculate nutrient difference
     */
    private calculateNutrientDiff(original?: string, variation?: string): string {
        if (!original || !variation) return '0g';

        const originalNum = parseFloat(original.replace(/[^\d.]/g, ''));
        const variationNum = parseFloat(variation.replace(/[^\d.]/g, ''));

        const diff = variationNum - originalNum;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}g`;
    }

    /**
     * Compare instructions between versions
     */
    private compareInstructions(original: string, variation: string): string[] {
        const changes: string[] = [];

        if (original.length !== variation.length) {
            changes.push('Instructions length changed');
        }

        // Simple comparison - in a real implementation, you might use a diff algorithm
        if (original !== variation) {
            changes.push('Cooking instructions modified');
        }

        return changes;
    }

    /**
     * Save a recipe variation as a new recipe
     */
    async saveVariationAsNewRecipe(
        variationId: string,
        newName?: string
    ): Promise<Recipe> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get variation
        const { data: variation, error: varError } = await supabase
            .from('recipe_variations')
            .select('*')
            .eq('id', variationId)
            .eq('user_id', user.id)
            .single();

        if (varError || !variation) {
            throw new Error('Variation not found');
        }

        const recipeData = variation.recipe_data as Recipe;

        // Save as new recipe
        const { data: newRecipe, error: saveError } = await supabase
            .from('daily_recipes')
            .insert({
                ...recipeData,
                user_id: user.id,
                recipe_date: new Date().toISOString().split('T')[0],
                meal_type: recipeData.meal_type || 'dinner',
                recipe_name: newName || recipeData.recipe_name,
                created_via: 'chat'
            })
            .select()
            .single();

        if (saveError) throw saveError;
        return newRecipe;
    }

    /**
     * Delete a recipe variation
     */
    async deleteVariation(variationId: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('recipe_variations')
            .delete()
            .eq('id', variationId)
            .eq('user_id', user.id);

        if (error) throw error;
    }

    /**
     * Get recipe modification history for a chat session
     */
    async getSessionModificationHistory(sessionId: string): Promise<{
        original_recipes: Recipe[];
        variations: RecipeVariation[];
        modification_chain: {
            recipe_id: string;
            recipe_name: string;
            modifications: RecipeVariation[];
        }[];
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { original_recipes: [], variations: [], modification_chain: [] };

        // Get all recipes created in this session
        const { data: originalRecipes } = await supabase
            .from('daily_recipes')
            .select('*')
            .eq('user_id', user.id)
            .eq('chat_session_id', sessionId)
            .order('created_at');

        // Get all variations created in this session
        const { data: variations } = await supabase
            .from('recipe_variations')
            .select('*')
            .eq('user_id', user.id)
            .eq('chat_session_id', sessionId)
            .order('created_at');

        // Build modification chains
        const modification_chain = (originalRecipes || []).map(recipe => ({
            recipe_id: recipe.id,
            recipe_name: recipe.recipe_name,
            modifications: (variations || []).filter(v => v.original_recipe_id === recipe.id)
        }));

        return {
            original_recipes: originalRecipes || [],
            variations: variations || [],
            modification_chain
        };
    }

    /**
     * Enhanced recipe history tracking with detailed timeline
     */
    async getRecipeHistoryTimeline(recipeId: string): Promise<{
        original: Recipe;
        timeline: {
            id: string;
            type: 'original' | 'variation' | 'rollback';
            name: string;
            description: string;
            created_at: string;
            created_via: string;
            chat_session_id?: string;
            changes_summary?: string[];
            parent_id?: string;
        }[];
        statistics: {
            total_variations: number;
            most_recent_modification: string;
            modification_frequency: number; // modifications per day
            popular_modification_types: string[];
        };
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get original recipe
        const { data: originalRecipe, error: originalError } = await supabase
            .from('daily_recipes')
            .select('*')
            .eq('id', recipeId)
            .eq('user_id', user.id)
            .single();

        if (originalError || !originalRecipe) {
            throw new Error('Original recipe not found');
        }

        // Get all variations
        const { data: variations } = await supabase
            .from('recipe_variations')
            .select('*')
            .eq('original_recipe_id', recipeId)
            .eq('user_id', user.id)
            .order('created_at');

        // Build timeline
        const timeline = [
            {
                id: originalRecipe.id,
                type: 'original' as const,
                name: originalRecipe.recipe_name,
                description: 'Original recipe created',
                created_at: originalRecipe.created_at,
                created_via: originalRecipe.created_via || 'manual',
                chat_session_id: originalRecipe.chat_session_id
            },
            ...(variations || []).map(variation => ({
                id: variation.id,
                type: 'variation' as const,
                name: variation.variation_name,
                description: variation.variation_description || 'Recipe variation',
                created_at: variation.created_at,
                created_via: variation.created_via,
                chat_session_id: variation.chat_session_id,
                changes_summary: this.extractChangesSummary(variation.recipe_data),
                parent_id: variation.original_recipe_id
            }))
        ];

        // Calculate statistics
        const now = new Date();
        const firstModification = variations && variations.length > 0 ? new Date(variations[0].created_at) : now;
        const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstModification.getTime()) / (1000 * 60 * 60 * 24)));

        const statistics = {
            total_variations: variations?.length || 0,
            most_recent_modification: variations && variations.length > 0
                ? variations[variations.length - 1].created_at
                : originalRecipe.created_at,
            modification_frequency: (variations?.length || 0) / daysSinceFirst,
            popular_modification_types: this.analyzeModificationTypes(variations || [])
        };

        return {
            original: originalRecipe,
            timeline: timeline.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
            statistics
        };
    }

    /**
     * Enhanced comparison interface with detailed diff analysis
     */
    async getDetailedRecipeComparison(
        originalRecipeId: string,
        variationId?: string
    ): Promise<{
        original: Recipe;
        comparison_target: Recipe | RecipeVariation;
        detailed_differences: {
            ingredients: {
                added: { name: string; quantity: string; impact: string }[];
                removed: { name: string; quantity: string; impact: string }[];
                modified: {
                    name: string;
                    original_quantity: string;
                    new_quantity: string;
                    change_type: 'increased' | 'decreased' | 'unit_changed';
                    impact: string;
                }[];
                unchanged: { name: string; quantity: string }[];
            };
            instructions: {
                added_steps: string[];
                removed_steps: string[];
                modified_steps: { original: string; modified: string; step_number: number }[];
                technique_changes: string[];
            };
            nutritional: {
                calories: { original: number; new: number; change: number; percentage: number };
                protein: { original: string; new: string; impact: string };
                carbs: { original: string; new: string; impact: string };
                fats: { original: string; new: string; impact: string };
                overall_health_impact: 'improved' | 'neutral' | 'decreased';
            };
            timing: {
                prep_time: { original: number; new: number; change: number };
                cook_time: { original: number; new: number; change: number };
                total_time_change: number;
                efficiency_impact: string;
            };
            difficulty: {
                original: string;
                new: string;
                change_reason: string;
                skill_requirements: string[];
            };
            cost: {
                original: number;
                new: number;
                change: number;
                percentage: number;
                cost_factors: string[];
            };
        };
        recommendation: {
            preferred_version: 'original' | 'variation';
            reasoning: string[];
            use_cases: {
                original: string[];
                variation: string[];
            };
        };
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Get original recipe
        const { data: originalRecipe, error: originalError } = await supabase
            .from('daily_recipes')
            .select('*')
            .eq('id', originalRecipeId)
            .eq('user_id', user.id)
            .single();

        if (originalError || !originalRecipe) {
            throw new Error('Original recipe not found');
        }

        let comparisonTarget: Recipe | RecipeVariation;

        if (variationId) {
            // Compare with specific variation
            const { data: variation, error: variationError } = await supabase
                .from('recipe_variations')
                .select('*')
                .eq('id', variationId)
                .eq('user_id', user.id)
                .single();

            if (variationError || !variation) {
                throw new Error('Variation not found');
            }
            comparisonTarget = variation;
        } else {
            // Compare with most recent variation
            const { data: variations } = await supabase
                .from('recipe_variations')
                .select('*')
                .eq('original_recipe_id', originalRecipeId)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!variations || variations.length === 0) {
                throw new Error('No variations found for comparison');
            }
            comparisonTarget = variations[0];
        }

        // Perform detailed comparison
        const detailed_differences = await this.performDetailedComparison(originalRecipe, comparisonTarget);
        const recommendation = this.generateComparisonRecommendation(originalRecipe, comparisonTarget, detailed_differences);

        return {
            original: originalRecipe,
            comparison_target: comparisonTarget,
            detailed_differences,
            recommendation
        };
    }

    /**
     * Rollback capabilities with version management
     */
    async rollbackToVersion(
        originalRecipeId: string,
        targetVersionId?: string,
        rollbackReason?: string
    ): Promise<{
        rolled_back_recipe: Recipe;
        rollback_info: {
            from_version: string;
            to_version: string;
            rollback_reason: string;
            changes_reverted: string[];
            rollback_timestamp: string;
        };
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        let targetRecipe: Recipe | Partial<Recipe>;
        let fromVersion: string;
        let toVersion: string;

        if (targetVersionId) {
            // Rollback to specific variation
            const { data: variation, error: variationError } = await supabase
                .from('recipe_variations')
                .select('*')
                .eq('id', targetVersionId)
                .eq('user_id', user.id)
                .single();

            if (variationError || !variation) {
                throw new Error('Target variation not found');
            }

            targetRecipe = variation.recipe_data as Recipe;
            fromVersion = 'current';
            toVersion = variation.variation_name;
        } else {
            // Rollback to original recipe
            const { data: originalRecipe, error: originalError } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('id', originalRecipeId)
                .eq('user_id', user.id)
                .single();

            if (originalError || !originalRecipe) {
                throw new Error('Original recipe not found');
            }

            targetRecipe = originalRecipe;
            fromVersion = 'current_variation';
            toVersion = 'original';
        }

        // Create rollback as new recipe
        const rollbackName = `${targetRecipe.recipe_name} (Rolled Back)`;

        const { data: rolledBackRecipe, error: rollbackError } = await supabase
            .from('daily_recipes')
            .insert({
                user_id: user.id,
                recipe_date: new Date().toISOString().split('T')[0],
                meal_type: targetRecipe.meal_type || 'dinner',
                recipe_name: rollbackName,
                ingredients: targetRecipe.ingredients,
                instructions: targetRecipe.instructions,
                prep_time: targetRecipe.prep_time,
                cook_time: targetRecipe.cook_time,
                servings: targetRecipe.servings,
                estimated_cost: targetRecipe.estimated_cost,
                nutritional_info: targetRecipe.nutritional_info,
                season: targetRecipe.season,
                difficulty: targetRecipe.difficulty,
                cuisine_type: targetRecipe.cuisine_type,
                tags: targetRecipe.tags,
                variations: targetRecipe.variations,
                cooking_tips: targetRecipe.cooking_tips,
                image_url: targetRecipe.image_url,
                image_source: targetRecipe.image_source,
                image_attribution: targetRecipe.image_attribution,
                created_via: 'chat',
                ai_model_used: targetRecipe.ai_model_used
            })
            .select()
            .single();

        if (rollbackError) throw rollbackError;

        // Record rollback as a special variation for history tracking
        const rollbackTimestamp = new Date().toISOString();
        await supabase
            .from('recipe_variations')
            .insert({
                user_id: user.id,
                original_recipe_id: originalRecipeId,
                variation_name: `Rollback to ${toVersion}`,
                variation_description: rollbackReason || `Rolled back from ${fromVersion} to ${toVersion}`,
                recipe_data: targetRecipe,
                created_via: 'manual'
            });

        const rollback_info = {
            from_version: fromVersion,
            to_version: toVersion,
            rollback_reason: rollbackReason || 'User requested rollback',
            changes_reverted: this.calculateRevertedChanges(targetRecipe),
            rollback_timestamp: rollbackTimestamp
        };

        return {
            rolled_back_recipe: rolledBackRecipe,
            rollback_info
        };
    }

    /**
     * Extract changes summary from recipe data
     */
    private extractChangesSummary(recipeData: any): string[] {
        const changes: string[] = [];

        // This is a simplified version - in a real implementation,
        // you'd compare with the original recipe to identify specific changes
        if (recipeData.ingredients) {
            changes.push(`${recipeData.ingredients.length} ingredients`);
        }
        if (recipeData.difficulty) {
            changes.push(`Difficulty: ${recipeData.difficulty}`);
        }
        if (recipeData.prep_time || recipeData.cook_time) {
            const totalTime = (recipeData.prep_time || 0) + (recipeData.cook_time || 0);
            changes.push(`Total time: ${totalTime} minutes`);
        }

        return changes;
    }

    /**
     * Analyze modification types from variations
     */
    private analyzeModificationTypes(variations: RecipeVariation[]): string[] {
        const types: { [key: string]: number } = {};

        variations.forEach(variation => {
            const description = variation.variation_description?.toLowerCase() || '';

            if (description.includes('vegan') || description.includes('plant-based')) {
                types['dietary_modification'] = (types['dietary_modification'] || 0) + 1;
            }
            if (description.includes('spicy') || description.includes('spicier')) {
                types['spice_adjustment'] = (types['spice_adjustment'] || 0) + 1;
            }
            if (description.includes('healthy') || description.includes('lighter')) {
                types['health_optimization'] = (types['health_optimization'] || 0) + 1;
            }
            if (description.includes('substitute') || description.includes('replace')) {
                types['ingredient_substitution'] = (types['ingredient_substitution'] || 0) + 1;
            }
            if (description.includes('quick') || description.includes('faster')) {
                types['time_optimization'] = (types['time_optimization'] || 0) + 1;
            }
        });

        return Object.entries(types)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([type]) => type);
    }

    /**
     * Perform detailed comparison between recipes
     */
    private async performDetailedComparison(
        original: Recipe,
        target: Recipe | RecipeVariation
    ): Promise<any> {
        const targetRecipe = 'recipe_data' in target ? target.recipe_data as Recipe : target;

        // Ingredient comparison
        const originalIngredients = original.ingredients || [];
        const targetIngredients = targetRecipe.ingredients || [];

        const ingredientComparison = this.compareIngredients(originalIngredients, targetIngredients);
        const instructionComparison = this.compareInstructions(original.instructions, targetRecipe.instructions || '');
        const nutritionalComparison = this.compareNutrition(original.nutritional_info, targetRecipe.nutritional_info);
        const timingComparison = this.compareTiming(original, targetRecipe);
        const difficultyComparison = this.compareDifficulty(original.difficulty, targetRecipe.difficulty);
        const costComparison = this.compareCost(original.estimated_cost, targetRecipe.estimated_cost);

        return {
            ingredients: ingredientComparison,
            instructions: instructionComparison,
            nutritional: nutritionalComparison,
            timing: timingComparison,
            difficulty: difficultyComparison,
            cost: costComparison
        };
    }

    /**
     * Compare ingredients between recipes
     */
    private compareIngredients(original: any[], target: any[]): any {
        const originalNames = original.map(ing => ing.name?.toLowerCase() || '');
        const targetNames = target.map(ing => ing.name?.toLowerCase() || '');

        const added = target.filter(ing =>
            !originalNames.includes(ing.name?.toLowerCase() || '')
        ).map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            impact: this.assessIngredientImpact(ing.name, 'added')
        }));

        const removed = original.filter(ing =>
            !targetNames.includes(ing.name?.toLowerCase() || '')
        ).map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            impact: this.assessIngredientImpact(ing.name, 'removed')
        }));

        const modified = original.filter(origIng => {
            const targetIng = target.find(tIng =>
                tIng.name?.toLowerCase() === origIng.name?.toLowerCase()
            );
            return targetIng && targetIng.quantity !== origIng.quantity;
        }).map(origIng => {
            const targetIng = target.find(tIng =>
                tIng.name?.toLowerCase() === origIng.name?.toLowerCase()
            );
            return {
                name: origIng.name,
                original_quantity: origIng.quantity,
                new_quantity: targetIng?.quantity || '',
                change_type: this.determineQuantityChangeType(origIng.quantity, targetIng?.quantity || ''),
                impact: this.assessQuantityChangeImpact(origIng.name, origIng.quantity, targetIng?.quantity || '')
            };
        });

        const unchanged = original.filter(origIng => {
            const targetIng = target.find(tIng =>
                tIng.name?.toLowerCase() === origIng.name?.toLowerCase()
            );
            return targetIng && targetIng.quantity === origIng.quantity;
        }).map(ing => ({
            name: ing.name,
            quantity: ing.quantity
        }));

        return { added, removed, modified, unchanged };
    }

    /**
     * Compare instructions between recipes
     */
    // private compareInstructions(original: string, target: string): any {
    //     // Simple instruction comparison - could be enhanced with more sophisticated diff
    //     const originalSteps = original.split(/\d+\.|\n/).filter(step => step.trim().length > 0);
    //     const targetSteps = target.split(/\d+\.|\n/).filter(step => step.trim().length > 0);

    //     return {
    //         added_steps: targetSteps.filter(step => !originalSteps.includes(step)),
    //         removed_steps: originalSteps.filter(step => !targetSteps.includes(step)),
    //         modified_steps: [],
    //         technique_changes: this.identifyTechniqueChanges(original, target)
    //     };
    // }

    /**
     * Compare nutritional information
     */
    private compareNutrition(original: any, target: any): any {
        const origNutrition = original || {};
        const targetNutrition = target || {};

        const caloriesOrig = origNutrition.calories || 0;
        const caloriesTarget = targetNutrition.calories || 0;
        const caloriesChange = caloriesTarget - caloriesOrig;

        return {
            calories: {
                original: caloriesOrig,
                new: caloriesTarget,
                change: caloriesChange,
                percentage: caloriesOrig > 0 ? Math.round((caloriesChange / caloriesOrig) * 100) : 0
            },
            protein: {
                original: origNutrition.protein || '0g',
                new: targetNutrition.protein || '0g',
                impact: this.assessNutritionalImpact('protein', origNutrition.protein, targetNutrition.protein)
            },
            carbs: {
                original: origNutrition.carbs || '0g',
                new: targetNutrition.carbs || '0g',
                impact: this.assessNutritionalImpact('carbs', origNutrition.carbs, targetNutrition.carbs)
            },
            fats: {
                original: origNutrition.fats || '0g',
                new: targetNutrition.fats || '0g',
                impact: this.assessNutritionalImpact('fats', origNutrition.fats, targetNutrition.fats)
            },
            overall_health_impact: this.assessOverallHealthImpact(origNutrition, targetNutrition)
        };
    }

    /**
     * Compare timing between recipes
     */
    private compareTiming(original: Recipe, target: Recipe): any {
        const prepChange = (target.prep_time || 0) - original.prep_time;
        const cookChange = (target.cook_time || 0) - original.cook_time;
        const totalChange = prepChange + cookChange;

        return {
            prep_time: { original: original.prep_time, new: target.prep_time || 0, change: prepChange },
            cook_time: { original: original.cook_time, new: target.cook_time || 0, change: cookChange },
            total_time_change: totalChange,
            efficiency_impact: this.assessEfficiencyImpact(totalChange)
        };
    }

    /**
     * Compare difficulty between recipes
     */
    private compareDifficulty(original?: string, target?: string): any {
        return {
            original: original || 'Medium',
            new: target || 'Medium',
            change_reason: this.getDifficultyChangeReason(original, target),
            skill_requirements: this.getSkillRequirements(target || 'Medium')
        };
    }

    /**
     * Compare cost between recipes
     */
    private compareCost(original: number, target?: number): any {
        const targetCost = target || 0;
        const change = targetCost - original;
        const percentage = original > 0 ? Math.round((change / original) * 100) : 0;

        return {
            original,
            new: targetCost,
            change,
            percentage,
            cost_factors: this.identifyCostFactors(change)
        };
    }

    /**
     * Generate comparison recommendation
     */
    private generateComparisonRecommendation(
        original: Recipe,
        target: Recipe | RecipeVariation,
        differences: any
    ): any {
        const targetRecipe = 'recipe_data' in target ? target.recipe_data as Recipe : target;

        // Simple recommendation logic - could be enhanced with ML
        let preferredVersion: 'original' | 'variation' = 'original';
        const reasoning: string[] = [];

        // Analyze improvements
        if (differences.nutritional.overall_health_impact === 'improved') {
            preferredVersion = 'variation';
            reasoning.push('Improved nutritional profile');
        }

        if (differences.timing.total_time_change < 0) {
            preferredVersion = 'variation';
            reasoning.push('Reduced cooking time');
        }

        if (differences.cost.change < 0) {
            preferredVersion = 'variation';
            reasoning.push('Lower cost');
        }

        return {
            preferred_version: preferredVersion,
            reasoning: reasoning.length > 0 ? reasoning : ['Both versions have their merits'],
            use_cases: {
                original: ['Traditional preparation', 'Special occasions', 'When time is not a constraint'],
                variation: ['Quick weeknight meals', 'Health-conscious cooking', 'Budget-friendly options']
            }
        };
    }

    /**
     * Calculate reverted changes for rollback
     */
    private calculateRevertedChanges(targetRecipe: any): string[] {
        const changes: string[] = [];

        if (targetRecipe.ingredients) {
            changes.push('Ingredient list restored');
        }
        if (targetRecipe.instructions) {
            changes.push('Cooking instructions restored');
        }
        if (targetRecipe.prep_time || targetRecipe.cook_time) {
            changes.push('Timing restored');
        }
        if (targetRecipe.difficulty) {
            changes.push('Difficulty level restored');
        }

        return changes;
    }

    // Helper methods for detailed analysis
    private assessIngredientImpact(ingredientName: string, action: 'added' | 'removed'): string {
        const name = ingredientName?.toLowerCase() || '';
        if (name.includes('salt') || name.includes('pepper')) {
            return action === 'added' ? 'Enhanced seasoning' : 'Reduced seasoning';
        }
        if (name.includes('oil') || name.includes('butter')) {
            return action === 'added' ? 'Increased richness' : 'Reduced fat content';
        }
        return action === 'added' ? 'Added flavor complexity' : 'Simplified recipe';
    }

    private determineQuantityChangeType(original: string, target: string): 'increased' | 'decreased' | 'unit_changed' {
        // Simple quantity comparison - could be enhanced with unit parsing
        const origNum = parseFloat(original.replace(/[^\d.]/g, ''));
        const targetNum = parseFloat(target.replace(/[^\d.]/g, ''));

        if (origNum < targetNum) return 'increased';
        if (origNum > targetNum) return 'decreased';
        return 'unit_changed';
    }

    private assessQuantityChangeImpact(name: string, original: string, target: string): string {
        const changeType = this.determineQuantityChangeType(original, target);
        const ingredientName = name?.toLowerCase() || '';

        if (ingredientName.includes('salt') || ingredientName.includes('pepper')) {
            return changeType === 'increased' ? 'More seasoned' : 'Less seasoned';
        }
        return changeType === 'increased' ? 'More prominent flavor' : 'Subtler flavor';
    }

    private identifyTechniqueChanges(original: string, target: string): string[] {
        const changes: string[] = [];
        const techniques = ['bake', 'fry', 'grill', 'steam', 'boil', 'sauté'];

        techniques.forEach(technique => {
            const inOriginal = original.toLowerCase().includes(technique);
            const inTarget = target.toLowerCase().includes(technique);

            if (!inOriginal && inTarget) {
                changes.push(`Added ${technique} technique`);
            } else if (inOriginal && !inTarget) {
                changes.push(`Removed ${technique} technique`);
            }
        });

        return changes;
    }

    private assessNutritionalImpact(nutrient: string, original?: string, target?: string): string {
        if (!original || !target) return 'No change';

        const origNum = parseFloat(original.replace(/[^\d.]/g, ''));
        const targetNum = parseFloat(target.replace(/[^\d.]/g, ''));

        if (targetNum > origNum) {
            return `Increased ${nutrient}`;
        } else if (targetNum < origNum) {
            return `Decreased ${nutrient}`;
        }
        return 'No significant change';
    }

    private assessOverallHealthImpact(original: any, target: any): 'improved' | 'neutral' | 'decreased' {
        const origCalories = original?.calories || 0;
        const targetCalories = target?.calories || 0;

        // Simple health assessment - could be more sophisticated
        if (targetCalories < origCalories && targetCalories > 0) {
            return 'improved';
        } else if (targetCalories > origCalories * 1.2) {
            return 'decreased';
        }
        return 'neutral';
    }

    private assessEfficiencyImpact(totalTimeChange: number): string {
        if (totalTimeChange < -10) return 'Significantly faster';
        if (totalTimeChange < 0) return 'Slightly faster';
        if (totalTimeChange > 10) return 'Takes longer';
        return 'Similar timing';
    }

    private getDifficultyChangeReason(original?: string, target?: string): string {
        if (!original || !target || original === target) {
            return 'No difficulty change';
        }

        const levels = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
        const origLevel = levels[original as keyof typeof levels] || 2;
        const targetLevel = levels[target as keyof typeof levels] || 2;

        if (targetLevel > origLevel) {
            return 'Added complexity through technique or ingredients';
        } else {
            return 'Simplified preparation or techniques';
        }
    }

    private getSkillRequirements(difficulty: string): string[] {
        const requirements = {
            'Easy': ['Basic knife skills', 'Following instructions'],
            'Medium': ['Intermediate cooking techniques', 'Timing coordination', 'Seasoning to taste'],
            'Hard': ['Advanced techniques', 'Precise timing', 'Multiple cooking methods', 'Professional skills']
        };

        return requirements[difficulty as keyof typeof requirements] || requirements['Medium'];
    }

    private identifyCostFactors(costChange: number): string[] {
        const factors: string[] = [];

        if (costChange > 0) {
            factors.push('Premium ingredients added');
            factors.push('Increased portion size');
        } else if (costChange < 0) {
            factors.push('Substituted with budget ingredients');
            factors.push('Reduced portion size');
        } else {
            factors.push('Similar ingredient costs');
        }

        return factors;
    }
}

// Export singleton instance
export const variationService = VariationService.getInstance();