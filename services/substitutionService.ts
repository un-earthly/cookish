import { supabase } from '@/lib/supabase';
import {
    Recipe,
    Ingredient,
    UserPreferences,
    SubstitutionSuggestion,
    AllergenWarning,
    EnhancedNutritionalInfo,
    DietaryRestrictionPreset
} from '@/types/recipe';
import { dietaryService } from '@/services/dietaryService';

/**
 * Advanced ingredient substitution engine with nutritional impact analysis
 */
export class SubstitutionService {
    private static instance: SubstitutionService;
    private substitutionDatabase: SubstitutionDatabase | null = null;

    private constructor() { }

    static getInstance(): SubstitutionService {
        if (!SubstitutionService.instance) {
            SubstitutionService.instance = new SubstitutionService();
        }
        return SubstitutionService.instance;
    }

    /**
     * Get comprehensive substitution suggestions for a recipe
     */
    async getSubstitutionSuggestions(
        recipe: Recipe,
        userPreferences: UserPreferences,
        options: SubstitutionOptions = {}
    ): Promise<EnhancedSubstitutionResult> {
        const substitutionDb = await this.getSubstitutionDatabase();
        const suggestions: EnhancedSubstitutionSuggestion[] = [];

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            return {
                suggestions: [],
                nutritionalImpact: null,
                costImpact: null,
                difficultyImpact: 'none'
            };
        }

        // Get dietary-based substitutions
        const dietarySubstitutions = await dietaryService.generateSubstitutionSuggestions(
            recipe,
            userPreferences
        );

        // Enhance dietary substitutions with detailed analysis
        for (const dietarySub of dietarySubstitutions) {
            const enhanced = await this.enhanceSubstitutionSuggestion(
                dietarySub,
                recipe,
                userPreferences,
                options
            );
            suggestions.push(enhanced);
        }

        // Add general improvement substitutions
        const improvementSubs = await this.generateImprovementSubstitutions(
            recipe,
            userPreferences,
            options
        );
        suggestions.push(...improvementSubs);

        // Add allergen-safe substitutions
        if (recipe.allergen_warnings && recipe.allergen_warnings.length > 0) {
            const allergenSafeSubs = await this.generateAllergenSafeSubstitutions(
                recipe,
                userPreferences,
                options
            );
            suggestions.push(...allergenSafeSubs);
        }

        // Calculate overall impacts
        const nutritionalImpact = this.calculateOverallNutritionalImpact(suggestions);
        const costImpact = this.calculateOverallCostImpact(suggestions);
        const difficultyImpact = this.calculateOverallDifficultyImpact(suggestions);

        return {
            suggestions: this.prioritizeSubstitutions(suggestions, options),
            nutritionalImpact,
            costImpact,
            difficultyImpact
        };
    }

    /**
     * Apply substitutions to a recipe and return modified recipe
     */
    async applySubstitutions(
        recipe: Recipe,
        substitutionsToApply: string[],
        userPreferences: UserPreferences
    ): Promise<Recipe> {
        const allSuggestions = await this.getSubstitutionSuggestions(recipe, userPreferences);
        const modifiedIngredients = [...recipe.ingredients];

        for (const substitutionId of substitutionsToApply) {
            const suggestion = allSuggestions.suggestions.find(s => s.id === substitutionId);
            if (!suggestion) continue;

            // Find and replace the ingredient
            const ingredientIndex = modifiedIngredients.findIndex(
                ing => ing.name.toLowerCase() === suggestion.original_ingredient.toLowerCase()
            );

            if (ingredientIndex !== -1) {
                // Use the first substitution option
                const newIngredientName = suggestion.substitution_options[0]?.name;
                if (newIngredientName) {
                    modifiedIngredients[ingredientIndex] = {
                        ...modifiedIngredients[ingredientIndex],
                        name: newIngredientName,
                        quantity: this.adjustQuantityForSubstitution(
                            modifiedIngredients[ingredientIndex].quantity,
                            suggestion.substitution_options[0]
                        ),
                        notes: `Substituted from ${suggestion.original_ingredient}`
                    };
                }
            }
        }

        // Recalculate nutritional information
        const modifiedRecipe = {
            ...recipe,
            ingredients: modifiedIngredients,
            nutritional_info: await this.recalculateNutrition(modifiedIngredients, recipe.servings)
        };

        // Update recipe metadata
        modifiedRecipe.tags = this.updateTagsForSubstitutions(recipe.tags || [], substitutionsToApply);
        modifiedRecipe.estimated_cost = this.recalculateCost(modifiedIngredients);

        return modifiedRecipe;
    }

    /**
     * Generate smart substitutions for ingredient availability
     */
    async generateAvailabilitySubstitutions(
        unavailableIngredients: string[],
        recipe: Recipe,
        userPreferences: UserPreferences
    ): Promise<EnhancedSubstitutionSuggestion[]> {
        const substitutionDb = await this.getSubstitutionDatabase();
        const suggestions: EnhancedSubstitutionSuggestion[] = [];

        for (const unavailableIngredient of unavailableIngredients) {
            const alternatives = substitutionDb.getAlternatives(unavailableIngredient);

            if (alternatives.length > 0) {
                const suggestion: EnhancedSubstitutionSuggestion = {
                    id: `availability_${unavailableIngredient}`,
                    original_ingredient: unavailableIngredient,
                    dietary_restriction: 'Ingredient availability',
                    substitution_options: alternatives.map(alt => ({
                        name: alt.name,
                        ratio: alt.conversionRatio,
                        availability_score: alt.availabilityScore,
                        cost_difference: alt.costDifference,
                        nutritional_similarity: alt.nutritionalSimilarity
                    })),
                    reason: 'Ingredient not available',
                    confidence_score: 0.8,
                    nutritional_impact: this.calculateNutritionalImpactForAlternatives(alternatives),
                    cost_impact: this.calculateCostImpactForAlternatives(alternatives),
                    difficulty_impact: 'none',
                    category: 'availability',
                    priority: 'high'
                };

                suggestions.push(suggestion);
            }
        }

        return suggestions;
    }

    /**
     * Analyze nutritional impact of potential substitutions
     */
    async analyzeNutritionalImpact(
        originalIngredients: Ingredient[],
        substitutedIngredients: Ingredient[]
    ): Promise<NutritionalImpactAnalysis> {
        const originalNutrition = await this.calculateIngredientNutrition(originalIngredients);
        const substitutedNutrition = await this.calculateIngredientNutrition(substitutedIngredients);

        return {
            calorie_change: substitutedNutrition.calories - originalNutrition.calories,
            protein_change: substitutedNutrition.protein - originalNutrition.protein,
            carb_change: substitutedNutrition.carbs - originalNutrition.carbs,
            fat_change: substitutedNutrition.fats - originalNutrition.fats,
            fiber_change: substitutedNutrition.fiber - originalNutrition.fiber,
            sodium_change: substitutedNutrition.sodium - originalNutrition.sodium,
            overall_health_score: this.calculateHealthScore(substitutedNutrition) -
                this.calculateHealthScore(originalNutrition),
            key_changes: this.identifyKeyNutritionalChanges(originalNutrition, substitutedNutrition)
        };
    }

    /**
     * Get substitution database (cached)
     */
    private async getSubstitutionDatabase(): Promise<SubstitutionDatabase> {
        if (this.substitutionDatabase) {
            return this.substitutionDatabase;
        }

        this.substitutionDatabase = new SubstitutionDatabase();
        await this.substitutionDatabase.initialize();
        return this.substitutionDatabase;
    }

    /**
     * Enhance a basic substitution suggestion with detailed analysis
     */
    private async enhanceSubstitutionSuggestion(
        basicSuggestion: SubstitutionSuggestion,
        recipe: Recipe,
        userPreferences: UserPreferences,
        options: SubstitutionOptions
    ): Promise<EnhancedSubstitutionSuggestion> {
        const substitutionDb = await this.getSubstitutionDatabase();

        // Get detailed substitution options
        const substitutionOptions = basicSuggestion.substitutions.map(sub => {
            const details = substitutionDb.getIngredientDetails(sub);
            return {
                name: sub,
                ratio: details?.conversionRatio || 1,
                availability_score: details?.availabilityScore || 0.7,
                cost_difference: details?.costDifference || 0,
                nutritional_similarity: details?.nutritionalSimilarity || 0.8
            };
        });

        return {
            id: `enhanced_${basicSuggestion.original_ingredient}_${basicSuggestion.dietary_restriction}`,
            original_ingredient: basicSuggestion.original_ingredient,
            dietary_restriction: basicSuggestion.dietary_restriction,
            substitution_options: substitutionOptions,
            reason: basicSuggestion.reason,
            confidence_score: this.calculateConfidenceScore(basicSuggestion, userPreferences),
            nutritional_impact: basicSuggestion.nutritional_impact || 'Minimal impact expected',
            cost_impact: this.estimateCostImpact(substitutionOptions),
            difficulty_impact: this.estimateDifficultyImpact(substitutionOptions),
            category: this.categorizeSubstitution(basicSuggestion),
            priority: this.calculatePriority(basicSuggestion, userPreferences)
        };
    }

    /**
     * Generate improvement-focused substitutions
     */
    private async generateImprovementSubstitutions(
        recipe: Recipe,
        userPreferences: UserPreferences,
        options: SubstitutionOptions
    ): Promise<EnhancedSubstitutionSuggestion[]> {
        const suggestions: EnhancedSubstitutionSuggestion[] = [];
        const substitutionDb = await this.getSubstitutionDatabase();

        // Health improvement substitutions
        if (options.focus === 'health' || !options.focus) {
            for (const ingredient of recipe.ingredients) {
                const healthierAlternatives = substitutionDb.getHealthierAlternatives(ingredient.name);

                if (healthierAlternatives.length > 0) {
                    suggestions.push({
                        id: `health_${ingredient.name}`,
                        original_ingredient: ingredient.name,
                        dietary_restriction: 'Health improvement',
                        substitution_options: healthierAlternatives.map(alt => ({
                            name: alt.name,
                            ratio: alt.conversionRatio,
                            availability_score: alt.availabilityScore,
                            cost_difference: alt.costDifference,
                            nutritional_similarity: alt.nutritionalSimilarity
                        })),
                        reason: 'Healthier alternative available',
                        confidence_score: 0.7,
                        nutritional_impact: 'Improved nutritional profile',
                        cost_impact: this.calculateCostImpactForAlternatives(healthierAlternatives),
                        difficulty_impact: 'none',
                        category: 'health',
                        priority: 'medium'
                    });
                }
            }
        }

        // Cost optimization substitutions
        if (options.focus === 'cost' || !options.focus) {
            for (const ingredient of recipe.ingredients) {
                const cheaperAlternatives = substitutionDb.getCheaperAlternatives(ingredient.name);

                if (cheaperAlternatives.length > 0) {
                    suggestions.push({
                        id: `cost_${ingredient.name}`,
                        original_ingredient: ingredient.name,
                        dietary_restriction: 'Cost optimization',
                        substitution_options: cheaperAlternatives.map(alt => ({
                            name: alt.name,
                            ratio: alt.conversionRatio,
                            availability_score: alt.availabilityScore,
                            cost_difference: alt.costDifference,
                            nutritional_similarity: alt.nutritionalSimilarity
                        })),
                        reason: 'More budget-friendly option',
                        confidence_score: 0.6,
                        nutritional_impact: 'Similar nutritional value',
                        cost_impact: this.calculateCostImpactForAlternatives(cheaperAlternatives),
                        difficulty_impact: 'none',
                        category: 'cost',
                        priority: 'low'
                    });
                }
            }
        }

        return suggestions;
    }

    /**
     * Generate allergen-safe substitutions
     */
    private async generateAllergenSafeSubstitutions(
        recipe: Recipe,
        userPreferences: UserPreferences,
        options: SubstitutionOptions
    ): Promise<EnhancedSubstitutionSuggestion[]> {
        const suggestions: EnhancedSubstitutionSuggestion[] = [];
        const allergenProfile = userPreferences.allergen_profile || {};
        const substitutionDb = await this.getSubstitutionDatabase();

        if (!recipe.allergen_warnings) return suggestions;

        for (const warning of recipe.allergen_warnings) {
            for (const allergen of warning.allergens) {
                const userSensitivity = allergenProfile[allergen];

                if (userSensitivity && (userSensitivity.severity === 'severe' || userSensitivity.severity === 'life_threatening')) {
                    const safeAlternatives = substitutionDb.getAllergenFreeAlternatives(warning.ingredient, allergen);

                    if (safeAlternatives.length > 0) {
                        suggestions.push({
                            id: `allergen_${warning.ingredient}_${allergen}`,
                            original_ingredient: warning.ingredient,
                            dietary_restriction: `${allergen}-free`,
                            substitution_options: safeAlternatives.map(alt => ({
                                name: alt.name,
                                ratio: alt.conversionRatio,
                                availability_score: alt.availabilityScore,
                                cost_difference: alt.costDifference,
                                nutritional_similarity: alt.nutritionalSimilarity
                            })),
                            reason: `Safe alternative for ${allergen} allergy`,
                            confidence_score: 0.9,
                            nutritional_impact: 'Allergen-free with similar nutrition',
                            cost_impact: this.calculateCostImpactForAlternatives(safeAlternatives),
                            difficulty_impact: 'none',
                            category: 'allergen_safety',
                            priority: 'critical'
                        });
                    }
                }
            }
        }

        return suggestions;
    }

    /**
     * Calculate confidence score for a substitution
     */
    private calculateConfidenceScore(
        suggestion: SubstitutionSuggestion,
        userPreferences: UserPreferences
    ): number {
        let score = 0.5; // Base score

        // Higher confidence for user's dietary restrictions
        const userRestrictions = Object.keys(userPreferences.detailed_dietary_restrictions || {});
        if (userRestrictions.includes(suggestion.dietary_restriction)) {
            score += 0.3;
        }

        // Higher confidence for common substitutions
        const commonSubstitutions = ['vegan', 'gluten-free', 'dairy-free'];
        if (commonSubstitutions.some(common =>
            suggestion.dietary_restriction.toLowerCase().includes(common)
        )) {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Estimate cost impact of substitution options
     */
    private estimateCostImpact(options: SubstitutionOption[]): string {
        const avgCostDiff = options.reduce((sum, opt) => sum + opt.cost_difference, 0) / options.length;

        if (avgCostDiff > 2) return 'Higher cost';
        if (avgCostDiff > 0.5) return 'Slightly higher cost';
        if (avgCostDiff < -2) return 'Lower cost';
        if (avgCostDiff < -0.5) return 'Slightly lower cost';
        return 'Similar cost';
    }

    /**
     * Estimate difficulty impact of substitution options
     */
    private estimateDifficultyImpact(options: SubstitutionOption[]): 'none' | 'slight' | 'moderate' | 'significant' {
        // Simple heuristic based on availability and similarity
        const avgAvailability = options.reduce((sum, opt) => sum + opt.availability_score, 0) / options.length;
        const avgSimilarity = options.reduce((sum, opt) => sum + opt.nutritional_similarity, 0) / options.length;

        if (avgAvailability < 0.3 || avgSimilarity < 0.5) return 'significant';
        if (avgAvailability < 0.6 || avgSimilarity < 0.7) return 'moderate';
        if (avgAvailability < 0.8 || avgSimilarity < 0.9) return 'slight';
        return 'none';
    }

    /**
     * Categorize substitution type
     */
    private categorizeSubstitution(suggestion: SubstitutionSuggestion): SubstitutionCategory {
        const restriction = suggestion.dietary_restriction.toLowerCase();

        if (restriction.includes('allerg')) return 'allergen_safety';
        if (restriction.includes('vegan') || restriction.includes('vegetarian')) return 'dietary_preference';
        if (restriction.includes('gluten') || restriction.includes('dairy')) return 'dietary_restriction';
        if (restriction.includes('health') || restriction.includes('nutrition')) return 'health';
        if (restriction.includes('cost') || restriction.includes('budget')) return 'cost';
        if (restriction.includes('availability')) return 'availability';

        return 'dietary_restriction';
    }

    /**
     * Calculate priority level for substitution
     */
    private calculatePriority(
        suggestion: SubstitutionSuggestion,
        userPreferences: UserPreferences
    ): 'critical' | 'high' | 'medium' | 'low' {
        const allergenProfile = userPreferences.allergen_profile || {};
        const restriction = suggestion.dietary_restriction.toLowerCase();

        // Critical for severe allergies
        if (restriction.includes('allerg')) {
            for (const [allergen, profile] of Object.entries(allergenProfile)) {
                if (restriction.includes(allergen.toLowerCase()) &&
                    (profile.severity === 'severe' || profile.severity === 'life_threatening')) {
                    return 'critical';
                }
            }
        }

        // High for strict dietary restrictions
        const userRestrictions = userPreferences.detailed_dietary_restrictions || {};
        for (const [restrictionName, details] of Object.entries(userRestrictions)) {
            if (restriction.includes(restrictionName.toLowerCase()) && details.severity === 'strict') {
                return 'high';
            }
        }

        // Medium for health improvements
        if (restriction.includes('health') || restriction.includes('nutrition')) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Prioritize substitutions based on user preferences and context
     */
    private prioritizeSubstitutions(
        suggestions: EnhancedSubstitutionSuggestion[],
        options: SubstitutionOptions
    ): EnhancedSubstitutionSuggestion[] {
        return suggestions.sort((a, b) => {
            // Priority order: critical > high > medium > low
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Then by confidence score
            const confidenceDiff = b.confidence_score - a.confidence_score;
            if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;

            // Then by category relevance to focus
            if (options.focus) {
                const aRelevant = a.category === options.focus;
                const bRelevant = b.category === options.focus;
                if (aRelevant && !bRelevant) return -1;
                if (!aRelevant && bRelevant) return 1;
            }

            return 0;
        });
    }

    // Additional helper methods implementation
    private calculateOverallNutritionalImpact(suggestions: EnhancedSubstitutionSuggestion[]): string | null {
        if (suggestions.length === 0) return null;

        const impacts = suggestions.map(s => s.nutritional_impact.toLowerCase());

        if (impacts.some(impact => impact.includes('improved') || impact.includes('healthier'))) {
            return 'Overall nutritional improvement expected';
        }
        if (impacts.some(impact => impact.includes('lower') && impact.includes('calorie'))) {
            return 'Lower calorie content with substitutions';
        }
        if (impacts.some(impact => impact.includes('higher') && impact.includes('protein'))) {
            return 'Increased protein content';
        }

        return 'Minimal overall nutritional impact';
    }

    private calculateOverallCostImpact(suggestions: EnhancedSubstitutionSuggestion[]): string | null {
        if (suggestions.length === 0) return null;

        const costImpacts = suggestions.map(s => s.cost_impact.toLowerCase());

        if (costImpacts.some(impact => impact.includes('higher'))) {
            return 'Recipe cost may increase with substitutions';
        }
        if (costImpacts.some(impact => impact.includes('lower'))) {
            return 'Recipe cost may decrease with substitutions';
        }

        return 'Similar overall cost expected';
    }

    private calculateOverallDifficultyImpact(suggestions: EnhancedSubstitutionSuggestion[]): 'none' | 'slight' | 'moderate' | 'significant' {
        if (suggestions.length === 0) return 'none';

        const difficultyImpacts = suggestions.map(s => s.difficulty_impact);

        if (difficultyImpacts.some(impact => impact === 'significant')) return 'significant';
        if (difficultyImpacts.some(impact => impact === 'moderate')) return 'moderate';
        if (difficultyImpacts.some(impact => impact === 'slight')) return 'slight';

        return 'none';
    }

    private adjustQuantityForSubstitution(originalQuantity: string, substitution: SubstitutionOption): string {
        // Parse the original quantity
        const quantityMatch = originalQuantity.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (!quantityMatch) return originalQuantity;

        const [, amount, unit] = quantityMatch;
        const numericAmount = parseFloat(amount);
        const adjustedAmount = numericAmount * substitution.ratio;

        // Round to reasonable precision
        const roundedAmount = Math.round(adjustedAmount * 100) / 100;
        return `${roundedAmount} ${unit}`.trim();
    }

    private async recalculateNutrition(ingredients: Ingredient[], servings: number = 4): Promise<EnhancedNutritionalInfo> {
        // Basic nutritional estimation based on ingredient types
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFats = 0;

        for (const ingredient of ingredients) {
            const name = ingredient.name.toLowerCase();

            // Basic calorie and macro estimates per ingredient
            if (name.includes('oil') || name.includes('butter')) {
                totalCalories += 120;
                totalFats += 14;
            } else if (name.includes('meat') || name.includes('chicken') || name.includes('beef')) {
                totalCalories += 150;
                totalProtein += 25;
                totalFats += 5;
            } else if (name.includes('fish')) {
                totalCalories += 120;
                totalProtein += 22;
                totalFats += 3;
            } else if (name.includes('cheese')) {
                totalCalories += 100;
                totalProtein += 7;
                totalFats += 8;
                totalCarbs += 1;
            } else if (name.includes('rice') || name.includes('pasta') || name.includes('bread')) {
                totalCalories += 200;
                totalCarbs += 45;
                totalProtein += 4;
            } else if (name.includes('vegetable') || name.includes('fruit')) {
                totalCalories += 25;
                totalCarbs += 6;
            } else {
                totalCalories += 50;
                totalCarbs += 8;
                totalProtein += 2;
            }
        }

        return {
            calories: Math.round(totalCalories / servings),
            protein: `${Math.round(totalProtein / servings)}g`,
            carbs: `${Math.round(totalCarbs / servings)}g`,
            fats: `${Math.round(totalFats / servings)}g`,
            per_serving: true,
            confidence_score: 0.6 // Estimated values
        };
    }

    private updateTagsForSubstitutions(originalTags: string[], substitutionIds: string[]): string[] {
        const newTags = [...originalTags];

        // Add tags based on substitution types
        for (const substitutionId of substitutionIds) {
            if (substitutionId.includes('vegan')) {
                newTags.push('vegan-friendly');
            }
            if (substitutionId.includes('gluten')) {
                newTags.push('gluten-free');
            }
            if (substitutionId.includes('dairy')) {
                newTags.push('dairy-free');
            }
            if (substitutionId.includes('health')) {
                newTags.push('health-conscious');
            }
            if (substitutionId.includes('allergen')) {
                newTags.push('allergen-safe');
            }
        }

        // Remove duplicates
        return [...new Set(newTags)];
    }

    private recalculateCost(ingredients: Ingredient[]): number {
        let totalCost = 0;

        for (const ingredient of ingredients) {
            const name = ingredient.name.toLowerCase();

            // Basic cost estimates per ingredient category
            if (name.includes('meat') || name.includes('chicken') || name.includes('beef')) {
                totalCost += 4.00;
            } else if (name.includes('fish') || name.includes('seafood')) {
                totalCost += 5.00;
            } else if (name.includes('cheese') || name.includes('dairy')) {
                totalCost += 2.50;
            } else if (name.includes('organic') || name.includes('premium')) {
                totalCost += 3.00;
            } else if (name.includes('vegetable') || name.includes('fruit')) {
                totalCost += 1.00;
            } else if (name.includes('spice') || name.includes('herb')) {
                totalCost += 0.50;
            } else {
                totalCost += 1.50;
            }
        }

        return Math.round(totalCost * 100) / 100;
    }

    private calculateCostImpactForAlternatives(alternatives: any[]): string {
        // Implementation for calculating cost impact
        return 'Similar cost';
    }

    private calculateNutritionalImpactForAlternatives(alternatives: any[]): string {
        // Implementation for calculating nutritional impact
        return 'Similar nutrition';
    }

    private async calculateIngredientNutrition(ingredients: Ingredient[]): Promise<any> {
        // Implementation for calculating nutrition from ingredients
        return { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 };
    }

    private calculateHealthScore(nutrition: any): number {
        // Implementation for calculating health score
        return 0;
    }

    private identifyKeyNutritionalChanges(original: any, substituted: any): string[] {
        // Implementation for identifying key nutritional changes
        return [];
    }
}

/**
 * Substitution database for ingredient alternatives
 */
class SubstitutionDatabase {
    private alternatives: Map<string, IngredientAlternative[]> = new Map();

    async initialize(): Promise<void> {
        // Initialize with common substitutions
        this.loadCommonSubstitutions();
    }

    private loadCommonSubstitutions(): void {
        // Load common ingredient substitutions
        const commonSubs = [
            {
                ingredient: 'butter',
                alternatives: [
                    { name: 'coconut oil', conversionRatio: 0.75, availabilityScore: 0.8, costDifference: 0.5, nutritionalSimilarity: 0.7 },
                    { name: 'olive oil', conversionRatio: 0.75, availabilityScore: 0.9, costDifference: 0.2, nutritionalSimilarity: 0.6 },
                    { name: 'vegan butter', conversionRatio: 1.0, availabilityScore: 0.7, costDifference: 1.0, nutritionalSimilarity: 0.9 }
                ]
            },
            {
                ingredient: 'milk',
                alternatives: [
                    { name: 'almond milk', conversionRatio: 1.0, availabilityScore: 0.9, costDifference: 0.3, nutritionalSimilarity: 0.6 },
                    { name: 'oat milk', conversionRatio: 1.0, availabilityScore: 0.8, costDifference: 0.4, nutritionalSimilarity: 0.7 },
                    { name: 'soy milk', conversionRatio: 1.0, availabilityScore: 0.8, costDifference: 0.2, nutritionalSimilarity: 0.8 }
                ]
            }
            // More substitutions would be added here
        ];

        for (const sub of commonSubs) {
            this.alternatives.set(sub.ingredient.toLowerCase(), sub.alternatives);
        }
    }

    getAlternatives(ingredient: string): IngredientAlternative[] {
        return this.alternatives.get(ingredient.toLowerCase()) || [];
    }

    getHealthierAlternatives(ingredient: string): IngredientAlternative[] {
        // Implementation for getting healthier alternatives
        return [];
    }

    getCheaperAlternatives(ingredient: string): IngredientAlternative[] {
        // Implementation for getting cheaper alternatives
        return [];
    }

    getAllergenFreeAlternatives(ingredient: string, allergen: string): IngredientAlternative[] {
        // Implementation for getting allergen-free alternatives
        return [];
    }

    getIngredientDetails(ingredient: string): IngredientAlternative | null {
        // Implementation for getting ingredient details
        return null;
    }
}

// Type definitions
interface SubstitutionOptions {
    focus?: 'health' | 'cost' | 'availability' | 'allergen_safety';
    maxSuggestions?: number;
    includeExperimental?: boolean;
}

interface EnhancedSubstitutionResult {
    suggestions: EnhancedSubstitutionSuggestion[];
    nutritionalImpact: string | null;
    costImpact: string | null;
    difficultyImpact: 'none' | 'slight' | 'moderate' | 'significant';
}

interface EnhancedSubstitutionSuggestion {
    id: string;
    original_ingredient: string;
    dietary_restriction: string;
    substitution_options: SubstitutionOption[];
    reason: string;
    confidence_score: number;
    nutritional_impact: string;
    cost_impact: string;
    difficulty_impact: 'none' | 'slight' | 'moderate' | 'significant';
    category: SubstitutionCategory;
    priority: 'critical' | 'high' | 'medium' | 'low';
}

interface SubstitutionOption {
    name: string;
    ratio: number;
    availability_score: number;
    cost_difference: number;
    nutritional_similarity: number;
}

type SubstitutionCategory =
    | 'dietary_restriction'
    | 'dietary_preference'
    | 'allergen_safety'
    | 'health'
    | 'cost'
    | 'availability';

interface IngredientAlternative {
    name: string;
    conversionRatio: number;
    availabilityScore: number;
    costDifference: number;
    nutritionalSimilarity: number;
}

interface NutritionalImpactAnalysis {
    calorie_change: number;
    protein_change: number;
    carb_change: number;
    fat_change: number;
    fiber_change: number;
    sodium_change: number;
    overall_health_score: number;
    key_changes: string[];
}

// Export singleton instance
export const substitutionService = SubstitutionService.getInstance();