import { supabase } from '@/lib/supabase';
import {
    DietaryRestrictionPreset,
    AllergenInfo,
    DetailedDietaryRestrictions,
    AllergenProfile,
    DietaryComplianceResult,
    AllergenWarning,
    SubstitutionSuggestion,
    Recipe,
    Ingredient,
    UserPreferences
} from '@/types/recipe';

/**
 * Service for managing dietary restrictions, allergen detection, and recipe compliance
 */
export class DietaryService {
    private static instance: DietaryService;
    private presetsCache: DietaryRestrictionPreset[] | null = null;
    private allergenCache: AllergenInfo[] | null = null;

    private constructor() { }

    static getInstance(): DietaryService {
        if (!DietaryService.instance) {
            DietaryService.instance = new DietaryService();
        }
        return DietaryService.instance;
    }

    /**
     * Get all available dietary restriction presets
     */
    async getDietaryRestrictionPresets(): Promise<DietaryRestrictionPreset[]> {
        if (this.presetsCache) {
            return this.presetsCache;
        }

        const { data, error } = await supabase
            .from('dietary_restriction_presets')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Error fetching dietary restriction presets:', error);
            return [];
        }

        this.presetsCache = data || [];
        return this.presetsCache;
    }

    /**
     * Get allergen information from database
     */
    async getAllergenDatabase(): Promise<AllergenInfo[]> {
        if (this.allergenCache) {
            return this.allergenCache;
        }

        const { data, error } = await supabase
            .from('allergen_database')
            .select('*')
            .order('ingredient_name');

        if (error) {
            console.error('Error fetching allergen database:', error);
            return [];
        }

        this.allergenCache = data || [];
        return this.allergenCache;
    }

    /**
     * Apply dietary restriction preset to user preferences
     */
    async applyDietaryPreset(
        presetId: string,
        userPreferences: UserPreferences
    ): Promise<Partial<UserPreferences>> {
        const presets = await this.getDietaryRestrictionPresets();
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            throw new Error('Dietary restriction preset not found');
        }

        const currentRestrictions = userPreferences.detailed_dietary_restrictions || {};
        const currentPresets = userPreferences.dietary_restriction_presets || [];

        // Add preset to user's applied presets
        const updatedPresets = [...new Set([...currentPresets, presetId])];

        // Add preset restrictions to detailed restrictions
        const updatedRestrictions = {
            ...currentRestrictions,
            [preset.name]: {
                reason: preset.description,
                severity: 'strict' as const,
                exceptions: [],
                notes: `Applied from ${preset.name} preset`
            }
        };

        // Update ingredient blacklist
        const currentBlacklist = userPreferences.ingredient_blacklist || [];
        const updatedBlacklist = [...new Set([...currentBlacklist, ...preset.restricted_ingredients])];

        // Update ingredient preferences with substitutions
        const currentPreferences = userPreferences.ingredient_preferences || {
            preferred_substitutions: {},
            favorite_ingredients: [],
            disliked_ingredients: []
        };

        const updatedPreferences = {
            ...currentPreferences,
            preferred_substitutions: {
                ...currentPreferences.preferred_substitutions,
                ...preset.allowed_substitutions
            }
        };

        return {
            detailed_dietary_restrictions: updatedRestrictions,
            dietary_restriction_presets: updatedPresets,
            ingredient_blacklist: updatedBlacklist,
            ingredient_preferences: updatedPreferences
        };
    }

    /**
     * Remove dietary restriction preset from user preferences
     */
    async removeDietaryPreset(
        presetId: string,
        userPreferences: UserPreferences
    ): Promise<Partial<UserPreferences>> {
        const presets = await this.getDietaryRestrictionPresets();
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            throw new Error('Dietary restriction preset not found');
        }

        const currentRestrictions = userPreferences.detailed_dietary_restrictions || {};
        const currentPresets = userPreferences.dietary_restriction_presets || [];

        // Remove preset from applied presets
        const updatedPresets = currentPresets.filter(id => id !== presetId);

        // Remove preset restriction from detailed restrictions
        const updatedRestrictions = { ...currentRestrictions };
        delete updatedRestrictions[preset.name];

        // Remove preset ingredients from blacklist
        const currentBlacklist = userPreferences.ingredient_blacklist || [];
        const updatedBlacklist = currentBlacklist.filter(
            ingredient => !preset.restricted_ingredients.includes(ingredient)
        );

        return {
            detailed_dietary_restrictions: updatedRestrictions,
            dietary_restriction_presets: updatedPresets,
            ingredient_blacklist: updatedBlacklist
        };
    }

    /**
     * Validate recipe against user's dietary restrictions
     */
    async validateRecipeDietaryCompliance(
        recipe: Recipe,
        userPreferences: UserPreferences
    ): Promise<DietaryComplianceResult> {
        const restrictions = userPreferences.detailed_dietary_restrictions || {};
        const blacklist = userPreferences.ingredient_blacklist || [];

        const result: DietaryComplianceResult = {
            compliant: true,
            violations: [],
            warnings: []
        };

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            return result;
        }

        // Check each ingredient against restrictions
        for (const ingredient of recipe.ingredients) {
            const ingredientName = ingredient.name.toLowerCase();

            // Check against blacklisted ingredients
            for (const blacklistedItem of blacklist) {
                if (ingredientName.includes(blacklistedItem.toLowerCase())) {
                    result.compliant = false;
                    result.violations.push({
                        ingredient: ingredient.name,
                        restriction: 'Blacklisted ingredient',
                        reason: `${blacklistedItem} is in your ingredient blacklist`
                    });
                }
            }

            // Check against detailed dietary restrictions
            for (const [restrictionName, restrictionDetails] of Object.entries(restrictions)) {
                const presets = await this.getDietaryRestrictionPresets();
                const preset = presets.find(p => p.name === restrictionName);

                if (preset) {
                    for (const restrictedItem of preset.restricted_ingredients) {
                        if (ingredientName.includes(restrictedItem.toLowerCase())) {
                            if (restrictionDetails.severity === 'strict') {
                                result.compliant = false;
                                result.violations.push({
                                    ingredient: ingredient.name,
                                    restriction: restrictionName,
                                    reason: restrictionDetails.reason
                                });
                            } else {
                                result.warnings.push({
                                    ingredient: ingredient.name,
                                    concern: `May not align with ${restrictionName} diet`,
                                    suggestion: `Consider substituting with ${preset.allowed_substitutions[restrictedItem]?.join(' or ')}`
                                });
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    /**
     * Detect allergens in recipe ingredients
     */
    async detectAllergens(recipe: Recipe): Promise<AllergenWarning[]> {
        const allergenDatabase = await this.getAllergenDatabase();
        const warnings: AllergenWarning[] = [];

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            return warnings;
        }

        for (const ingredient of recipe.ingredients) {
            const ingredientName = ingredient.name.toLowerCase();

            // Find matching allergen records
            const matchingAllergens = allergenDatabase.filter(allergenInfo => {
                return (
                    allergenInfo.ingredient_name.toLowerCase() === ingredientName ||
                    allergenInfo.alternative_names.some(altName =>
                        ingredientName.includes(altName.toLowerCase())
                    )
                );
            });

            for (const allergenInfo of matchingAllergens) {
                if (allergenInfo.common_allergens.length > 0) {
                    warnings.push({
                        ingredient: ingredient.name,
                        allergens: allergenInfo.common_allergens,
                        severity: allergenInfo.severity_level,
                        cross_contamination_risk: allergenInfo.cross_contamination_risk
                    });
                }
            }
        }

        return warnings;
    }

    /**
     * Generate substitution suggestions for recipe ingredients
     */
    async generateSubstitutionSuggestions(
        recipe: Recipe,
        userPreferences: UserPreferences
    ): Promise<SubstitutionSuggestion[]> {
        const suggestions: SubstitutionSuggestion[] = [];
        const presets = await this.getDietaryRestrictionPresets();
        const appliedPresets = userPreferences.dietary_restriction_presets || [];
        const userSubstitutions = userPreferences.ingredient_preferences?.preferred_substitutions || {};

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            return suggestions;
        }

        for (const ingredient of recipe.ingredients) {
            const ingredientName = ingredient.name.toLowerCase();

            // Check user's custom substitution preferences first
            for (const [originalIngredient, substitutions] of Object.entries(userSubstitutions)) {
                if (ingredientName.includes(originalIngredient.toLowerCase())) {
                    suggestions.push({
                        original_ingredient: ingredient.name,
                        dietary_restriction: 'Personal preference',
                        substitutions,
                        reason: 'Based on your ingredient preferences'
                    });
                }
            }

            // Check against applied dietary restriction presets
            for (const presetId of appliedPresets) {
                const preset = presets.find(p => p.id === presetId);
                if (!preset) continue;

                for (const restrictedItem of preset.restricted_ingredients) {
                    if (ingredientName.includes(restrictedItem.toLowerCase())) {
                        const substitutions = preset.allowed_substitutions[restrictedItem];
                        if (substitutions && substitutions.length > 0) {
                            suggestions.push({
                                original_ingredient: ingredient.name,
                                dietary_restriction: preset.name,
                                substitutions,
                                reason: preset.description,
                                nutritional_impact: this.calculateNutritionalImpact(restrictedItem, substitutions)
                            });
                        }
                    }
                }
            }
        }

        // Remove duplicates
        const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
            index === self.findIndex(s =>
                s.original_ingredient === suggestion.original_ingredient &&
                s.dietary_restriction === suggestion.dietary_restriction
            )
        );

        return uniqueSuggestions;
    }

    /**
     * Check if user has specific allergen sensitivities
     */
    async checkAllergenSensitivities(
        allergenWarnings: AllergenWarning[],
        userPreferences: UserPreferences
    ): Promise<AllergenWarning[]> {
        const allergenProfile = userPreferences.allergen_profile || {};
        const criticalWarnings: AllergenWarning[] = [];

        for (const warning of allergenWarnings) {
            for (const allergen of warning.allergens) {
                const userSensitivity = allergenProfile[allergen];
                if (userSensitivity) {
                    // Upgrade severity based on user's profile
                    const upgradedSeverity = this.getMaxSeverity(warning.severity, userSensitivity.severity);

                    criticalWarnings.push({
                        ...warning,
                        severity: upgradedSeverity,
                        allergens: [allergen] // Focus on the specific allergen
                    });
                }
            }
        }

        return criticalWarnings.length > 0 ? criticalWarnings : allergenWarnings;
    }

    /**
     * Generate dietary-compliant recipe prompt modifications
     */
    generateDietaryPromptModifications(userPreferences: UserPreferences): string {
        const modifications: string[] = [];
        const restrictions = userPreferences.detailed_dietary_restrictions || {};
        const blacklist = userPreferences.ingredient_blacklist || [];
        const allergenProfile = userPreferences.allergen_profile || {};

        // Add dietary restriction requirements
        for (const [restrictionName, details] of Object.entries(restrictions)) {
            if (details.severity === 'strict') {
                modifications.push(`Must be ${restrictionName.toLowerCase()}-compliant`);
            } else {
                modifications.push(`Preferably ${restrictionName.toLowerCase()}-friendly`);
            }
        }

        // Add ingredient blacklist
        if (blacklist.length > 0) {
            modifications.push(`Avoid these ingredients: ${blacklist.join(', ')}`);
        }

        // Add severe allergen warnings
        const severeAllergens = Object.entries(allergenProfile)
            .filter(([_, profile]) => profile.severity === 'severe' || profile.severity === 'life_threatening')
            .map(([allergen, _]) => allergen);

        if (severeAllergens.length > 0) {
            modifications.push(`CRITICAL: Must be completely free of ${severeAllergens.join(', ')} - this is a severe allergy`);
        }

        // Add nutritional goals
        const nutritionalGoals = userPreferences.nutritional_goals;
        if (nutritionalGoals) {
            if (nutritionalGoals.daily_calories) {
                modifications.push(`Target approximately ${Math.round(nutritionalGoals.daily_calories / 3)} calories per serving`);
            }
            if (nutritionalGoals.protein_target) {
                modifications.push(`Include high-protein ingredients (target: ${nutritionalGoals.protein_target}g protein)`);
            }
            if (nutritionalGoals.carb_limit) {
                modifications.push(`Keep carbohydrates under ${nutritionalGoals.carb_limit}g`);
            }
            if (nutritionalGoals.sodium_limit) {
                modifications.push(`Use low-sodium ingredients (limit: ${nutritionalGoals.sodium_limit}mg)`);
            }
        }

        // Add enhanced dietary goals
        const dietaryGoals = (userPreferences as any).dietary_goals;
        if (dietaryGoals) {
            if (dietaryGoals.weight_management) {
                modifications.push(`Focus on ${dietaryGoals.weight_management} goals`);
            }
            if (dietaryGoals.health_condition) {
                modifications.push(`Consider ${dietaryGoals.health_condition} dietary needs`);
            }
        }

        // Add cultural dietary preferences
        const culturalPrefs = (userPreferences as any).cultural_dietary_preferences;
        if (culturalPrefs) {
            for (const [culture, details] of Object.entries(culturalPrefs)) {
                modifications.push(`Respect ${culture} dietary customs: ${(details as any).description}`);
            }
        }

        // Add cooking restrictions
        const cookingRestrictions = (userPreferences as any).cooking_restrictions;
        if (cookingRestrictions) {
            if (cookingRestrictions.max_cook_time) {
                modifications.push(`Maximum cooking time: ${cookingRestrictions.max_cook_time} minutes`);
            }
            if (cookingRestrictions.equipment_limitations) {
                modifications.push(`Equipment limitations: ${cookingRestrictions.equipment_limitations.join(', ')}`);
            }
            if (cookingRestrictions.skill_level) {
                modifications.push(`Cooking skill level: ${cookingRestrictions.skill_level}`);
            }
        }

        // Add budget constraints
        const budgetConstraints = (userPreferences as any).budget_constraints;
        if (budgetConstraints && budgetConstraints.max_cost_per_serving) {
            modifications.push(`Budget limit: $${budgetConstraints.max_cost_per_serving} per serving`);
        }

        return modifications.length > 0
            ? `\n\nDIETARY REQUIREMENTS: ${modifications.join('. ')}.`
            : '';
    }

    /**
     * Generate enhanced dietary prompt using database function
     */
    async generateEnhancedDietaryPrompt(userId: string): Promise<string> {
        try {
            const { data, error } = await supabase
                .rpc('generate_enhanced_dietary_prompt', { user_id_param: userId });

            if (error) {
                console.error('Error generating enhanced dietary prompt:', error);
                // Fallback to basic prompt generation
                const { data: userPrefs } = await supabase
                    .from('user_preferences')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (userPrefs) {
                    return this.generateDietaryPromptModifications(userPrefs);
                }
                return '';
            }

            return data || '';
        } catch (error) {
            console.error('Error in generateEnhancedDietaryPrompt:', error);
            return '';
        }
    }

    /**
     * Calculate nutritional impact of ingredient substitution
     */
    private calculateNutritionalImpact(originalIngredient: string, substitutions: string[]): string {
        // Simple nutritional impact analysis
        const impacts: string[] = [];

        // Common substitution impacts
        if (originalIngredient.includes('meat') && substitutions.some(s => s.includes('tofu'))) {
            impacts.push('Lower saturated fat, similar protein');
        }
        if (originalIngredient.includes('dairy') && substitutions.some(s => s.includes('plant'))) {
            impacts.push('Lower calcium, may need fortified alternatives');
        }
        if (originalIngredient.includes('flour') && substitutions.some(s => s.includes('almond'))) {
            impacts.push('Higher protein and healthy fats, lower carbs');
        }
        if (originalIngredient.includes('sugar') && substitutions.some(s => s.includes('stevia'))) {
            impacts.push('Significantly lower calories and carbs');
        }

        return impacts.length > 0 ? impacts.join('; ') : 'Nutritional profile may vary';
    }

    /**
     * Get the maximum severity level between two severity levels
     */
    private getMaxSeverity(
        severity1: 'low' | 'medium' | 'high' | 'severe',
        severity2: 'mild' | 'moderate' | 'severe' | 'life_threatening'
    ): 'low' | 'medium' | 'high' | 'severe' {
        const severityMap = {
            'low': 1, 'mild': 1,
            'medium': 2, 'moderate': 2,
            'high': 3, 'severe': 4,
            'life_threatening': 4
        };

        const maxLevel = Math.max(severityMap[severity1], severityMap[severity2]);

        if (maxLevel >= 4) return 'severe';
        if (maxLevel >= 3) return 'high';
        if (maxLevel >= 2) return 'medium';
        return 'low';
    }

    /**
     * Get enhanced substitution suggestions using the substitution service
     */
    async getEnhancedSubstitutionSuggestions(
        recipe: Recipe,
        userPreferences: UserPreferences
    ): Promise<SubstitutionSuggestion[]> {
        try {
            // Import substitution service dynamically to avoid circular dependencies
            const { substitutionService } = await import('@/services/substitutionService');

            const enhancedResult = await substitutionService.getSubstitutionSuggestions(
                recipe,
                userPreferences,
                { focus: 'health' }
            );

            // Convert enhanced suggestions back to basic format for compatibility
            return enhancedResult.suggestions.map(enhanced => ({
                original_ingredient: enhanced.original_ingredient,
                dietary_restriction: enhanced.dietary_restriction,
                substitutions: enhanced.substitution_options.map(opt => opt.name),
                reason: enhanced.reason,
                nutritional_impact: enhanced.nutritional_impact
            }));
        } catch (error) {
            console.error('Error getting enhanced substitution suggestions:', error);
            // Fallback to basic substitution suggestions
            return this.generateSubstitutionSuggestions(recipe, userPreferences);
        }
    }

    /**
     * Analyze allergen safety of substitutions
     */
    async analyzeSubstitutionAllergenSafety(
        substitutions: SubstitutionSuggestion[],
        userPreferences: UserPreferences
    ): Promise<{ safe: SubstitutionSuggestion[]; risky: SubstitutionSuggestion[] }> {
        const allergenProfile = userPreferences.allergen_profile || {};
        const allergenDatabase = await this.getAllergenDatabase();

        const safe: SubstitutionSuggestion[] = [];
        const risky: SubstitutionSuggestion[] = [];

        for (const substitution of substitutions) {
            let isRisky = false;

            // Check each substitution option for allergens
            for (const substitutionOption of substitution.substitutions) {
                const matchingAllergens = allergenDatabase.filter(allergenInfo =>
                    allergenInfo.ingredient_name.toLowerCase() === substitutionOption.toLowerCase() ||
                    allergenInfo.alternative_names.some(altName =>
                        substitutionOption.toLowerCase().includes(altName.toLowerCase())
                    )
                );

                // Check if any allergens match user's profile
                for (const allergenInfo of matchingAllergens) {
                    for (const allergen of allergenInfo.common_allergens) {
                        const userSensitivity = allergenProfile[allergen];
                        if (userSensitivity &&
                            (userSensitivity.severity === 'severe' || userSensitivity.severity === 'life_threatening')) {
                            isRisky = true;
                            break;
                        }
                    }
                    if (isRisky) break;
                }
                if (isRisky) break;
            }

            if (isRisky) {
                risky.push(substitution);
            } else {
                safe.push(substitution);
            }
        }

        return { safe, risky };
    }

    /**
     * Validate recipe using enhanced database validation
     */
    async validateRecipeComprehensive(
        recipe: Recipe,
        userId: string
    ): Promise<DietaryComplianceResult> {
        try {
            const { data, error } = await supabase
                .rpc('validate_recipe_comprehensive', {
                    recipe_ingredients: recipe.ingredients,
                    user_id_param: userId
                });

            if (error) {
                console.error('Error in comprehensive recipe validation:', error);
                // Fallback to basic validation
                const { data: userPrefs } = await supabase
                    .from('user_preferences')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (userPrefs) {
                    return this.validateRecipeDietaryCompliance(recipe, userPrefs);
                }
            }

            return data || { compliant: true, violations: [], warnings: [] };
        } catch (error) {
            console.error('Error in validateRecipeComprehensive:', error);
            return { compliant: true, violations: [], warnings: [] };
        }
    }

    /**
     * Get dietary restriction presets with user application status
     */
    async getDietaryPresetsWithStatus(userId: string): Promise<any[]> {
        try {
            const { data, error } = await supabase
                .rpc('get_dietary_presets_with_status', { user_id_param: userId });

            if (error) {
                console.error('Error fetching dietary presets with status:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getDietaryPresetsWithStatus:', error);
            return [];
        }
    }

    /**
     * Get comprehensive dietary profile for a user
     */
    async getComprehensiveDietaryProfile(userId: string): Promise<any> {
        try {
            const { data, error } = await supabase
                .rpc('get_comprehensive_dietary_profile', { user_id_param: userId });

            if (error) {
                console.error('Error fetching comprehensive dietary profile:', error);
                return {};
            }

            return data || {};
        } catch (error) {
            console.error('Error in getComprehensiveDietaryProfile:', error);
            return {};
        }
    }

    /**
     * Update user's dietary goals
     */
    async updateDietaryGoals(
        userId: string,
        dietaryGoals: {
            weight_management?: 'weight_loss' | 'weight_gain' | 'maintenance';
            health_condition?: string;
            fitness_goals?: string[];
            energy_level_goals?: 'increase' | 'maintain' | 'balance';
        }
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_preferences')
                .update({ dietary_goals: dietaryGoals })
                .eq('user_id', userId);

            if (error) {
                console.error('Error updating dietary goals:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in updateDietaryGoals:', error);
            return false;
        }
    }

    /**
     * Update user's cultural dietary preferences
     */
    async updateCulturalDietaryPreferences(
        userId: string,
        culturalPreferences: {
            [cultureName: string]: {
                description: string;
                restrictions: string[];
                preferred_ingredients: string[];
                cooking_methods: string[];
            };
        }
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_preferences')
                .update({ cultural_dietary_preferences: culturalPreferences })
                .eq('user_id', userId);

            if (error) {
                console.error('Error updating cultural dietary preferences:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in updateCulturalDietaryPreferences:', error);
            return false;
        }
    }

    /**
     * Update user's cooking restrictions
     */
    async updateCookingRestrictions(
        userId: string,
        cookingRestrictions: {
            max_cook_time?: number;
            max_prep_time?: number;
            equipment_limitations?: string[];
            skill_level?: 'beginner' | 'intermediate' | 'advanced';
            physical_limitations?: string[];
        }
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_preferences')
                .update({ cooking_restrictions: cookingRestrictions })
                .eq('user_id', userId);

            if (error) {
                console.error('Error updating cooking restrictions:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in updateCookingRestrictions:', error);
            return false;
        }
    }

    /**
     * Update user's budget constraints
     */
    async updateBudgetConstraints(
        userId: string,
        budgetConstraints: {
            max_cost_per_serving?: number;
            max_weekly_budget?: number;
            preferred_cost_range?: 'budget' | 'moderate' | 'premium';
            cost_priority?: 'lowest' | 'balanced' | 'quality_focused';
        }
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_preferences')
                .update({ budget_constraints: budgetConstraints })
                .eq('user_id', userId);

            if (error) {
                console.error('Error updating budget constraints:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in updateBudgetConstraints:', error);
            return false;
        }
    }

    /**
     * Validate recipe ingredients against specific dietary preset
     */
    async validateAgainstPreset(
        ingredients: Ingredient[],
        presetId: string
    ): Promise<{ compliant: boolean; violations: string[]; suggestions: string[] }> {
        const presets = await this.getDietaryRestrictionPresets();
        const preset = presets.find(p => p.id === presetId);

        if (!preset) {
            return { compliant: true, violations: [], suggestions: [] };
        }

        const violations: string[] = [];
        const suggestions: string[] = [];

        for (const ingredient of ingredients) {
            const ingredientName = ingredient.name.toLowerCase();

            // Check against restricted ingredients
            for (const restrictedItem of preset.restricted_ingredients) {
                if (ingredientName.includes(restrictedItem.toLowerCase())) {
                    violations.push(`${ingredient.name} contains ${restrictedItem} (restricted in ${preset.name} diet)`);

                    // Add substitution suggestion if available
                    const substitutions = preset.allowed_substitutions[restrictedItem];
                    if (substitutions && substitutions.length > 0) {
                        suggestions.push(`Replace ${ingredient.name} with ${substitutions.join(' or ')}`);
                    }
                }
            }
        }

        return {
            compliant: violations.length === 0,
            violations,
            suggestions
        };
    }

    /**
     * Get recipe compliance score (0-1, where 1 is fully compliant)
     */
    async getRecipeComplianceScore(
        recipe: Recipe,
        userId: string
    ): Promise<number> {
        const validation = await this.validateRecipeComprehensive(recipe, userId);

        let score = 1.0;

        // Deduct for violations
        if (validation.violations) {
            score -= validation.violations.length * 0.3;
        }

        // Deduct for warnings
        if (validation.warnings) {
            score -= validation.warnings.length * 0.1;
        }

        return Math.max(score, 0.0);
    }

    /**
     * Generate dietary compliance report for a recipe
     */
    async generateComplianceReport(
        recipe: Recipe,
        userId: string
    ): Promise<{
        score: number;
        status: 'compliant' | 'warnings' | 'violations';
        summary: string;
        details: DietaryComplianceResult;
        recommendations: string[];
    }> {
        const validation = await this.validateRecipeComprehensive(recipe, userId);
        const score = await this.getRecipeComplianceScore(recipe, userId);

        let status: 'compliant' | 'warnings' | 'violations' = 'compliant';
        let summary = 'This recipe meets all your dietary requirements.';
        const recommendations: string[] = [];

        if (validation.violations && validation.violations.length > 0) {
            status = 'violations';
            summary = `This recipe has ${validation.violations.length} dietary restriction violation(s).`;
            recommendations.push('Consider finding an alternative recipe or making substitutions.');
        } else if (validation.warnings && validation.warnings.length > 0) {
            status = 'warnings';
            summary = `This recipe has ${validation.warnings.length} dietary concern(s) but no strict violations.`;
            recommendations.push('Review the warnings and decide if the recipe is suitable for you.');
        }

        // Add specific recommendations based on violations/warnings
        if (validation.violations) {
            for (const violation of validation.violations) {
                recommendations.push(`Address ${violation.ingredient}: ${violation.reason}`);
            }
        }

        return {
            score,
            status,
            summary,
            details: validation,
            recommendations
        };
    }

    /**
     * Clear caches (useful for testing or when data is updated)
     */
    clearCaches(): void {
        this.presetsCache = null;
        this.allergenCache = null;
    }
}

// Export singleton instance
export const dietaryService = DietaryService.getInstance();