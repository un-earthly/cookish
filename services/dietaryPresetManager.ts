import { supabase } from '@/lib/supabase';
import { dietaryService } from '@/services/dietaryService';
import { UserPreferences, DietaryRestrictionPreset } from '@/types/recipe';

/**
 * Manager for dietary restriction presets and user applications
 */
export class DietaryPresetManager {
    private static instance: DietaryPresetManager;

    private constructor() { }

    static getInstance(): DietaryPresetManager {
        if (!DietaryPresetManager.instance) {
            DietaryPresetManager.instance = new DietaryPresetManager();
        }
        return DietaryPresetManager.instance;
    }

    /**
     * Apply multiple dietary presets to user preferences
     */
    async applyMultiplePresets(
        userId: string,
        presetIds: string[]
    ): Promise<{ success: boolean; appliedPresets: string[]; errors: string[] }> {
        const appliedPresets: string[] = [];
        const errors: string[] = [];

        try {
            // Get current user preferences
            const { data: userPrefs, error: userError } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (userError || !userPrefs) {
                return { success: false, appliedPresets: [], errors: ['User preferences not found'] };
            }

            // Get preset details
            const { data: presets, error: presetsError } = await supabase
                .from('dietary_restriction_presets')
                .select('*')
                .in('id', presetIds)
                .eq('is_active', true);

            if (presetsError) {
                return { success: false, appliedPresets: [], errors: ['Failed to fetch presets'] };
            }

            if (!presets || presets.length === 0) {
                return { success: false, appliedPresets: [], errors: ['No valid presets found'] };
            }

            // Build combined dietary restrictions
            const combinedRestrictions = { ...userPrefs.detailed_dietary_restrictions };
            const combinedBlacklist = [...(userPrefs.ingredient_blacklist || [])];
            const combinedPreferences = { ...userPrefs.ingredient_preferences };

            for (const preset of presets) {
                try {
                    // Add preset restriction
                    combinedRestrictions[preset.name] = {
                        reason: preset.description,
                        severity: 'strict' as const,
                        exceptions: [],
                        notes: `Applied from ${preset.name} preset`
                    };

                    // Add restricted ingredients to blacklist
                    combinedBlacklist.push(...preset.restricted_ingredients);

                    // Add substitution preferences
                    if (!combinedPreferences.preferred_substitutions) {
                        combinedPreferences.preferred_substitutions = {};
                    }
                    Object.assign(combinedPreferences.preferred_substitutions, preset.allowed_substitutions);

                    appliedPresets.push(preset.id);
                } catch (error) {
                    
                    errors.push(`Failed to apply preset ${preset.name}: ${error}`);
                }
            }

            // Update user preferences
            const { error: updateError } = await supabase
                .from('user_preferences')
                .update({
                    detailed_dietary_restrictions: combinedRestrictions,
                    ingredient_blacklist: [...new Set(combinedBlacklist)], // Remove duplicates
                    ingredient_preferences: combinedPreferences,
                    dietary_restriction_presets: [...new Set([...(userPrefs.dietary_restriction_presets || []), ...appliedPresets])]
                })
                .eq('user_id', userId);

            if (updateError) {
                errors.push('Failed to update user preferences');
                return { success: false, appliedPresets: [], errors };
            }

            return { success: true, appliedPresets, errors };
        } catch (error) {
            return { success: false, appliedPresets: [], errors: [`Unexpected error: ${error}`] };
        }
    }

    /**
     * Remove dietary presets from user preferences
     */
    async removePresets(
        userId: string,
        presetIds: string[]
    ): Promise<{ success: boolean; removedPresets: string[]; errors: string[] }> {
        const removedPresets: string[] = [];
        const errors: string[] = [];

        try {
            // Get current user preferences
            const { data: userPrefs, error: userError } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (userError || !userPrefs) {
                return { success: false, removedPresets: [], errors: ['User preferences not found'] };
            }

            // Get preset details to know what to remove
            const { data: presets, error: presetsError } = await supabase
                .from('dietary_restriction_presets')
                .select('*')
                .in('id', presetIds);

            if (presetsError) {
                return { success: false, removedPresets: [], errors: ['Failed to fetch presets'] };
            }

            if (!presets || presets.length === 0) {
                return { success: false, removedPresets: [], errors: ['No presets found to remove'] };
            }

            // Remove preset restrictions
            const updatedRestrictions = { ...userPrefs.detailed_dietary_restrictions };
            let updatedBlacklist = [...(userPrefs.ingredient_blacklist || [])];
            const updatedPreferences = { ...userPrefs.ingredient_preferences };

            for (const preset of presets) {
                try {
                    // Remove preset restriction
                    delete updatedRestrictions[preset.name];

                    // Remove preset ingredients from blacklist
                    updatedBlacklist = updatedBlacklist.filter(
                        ingredient => !preset.restricted_ingredients.includes(ingredient)
                    );

                    // Remove preset substitutions (only if they match exactly)
                    if (updatedPreferences.preferred_substitutions) {
                        for (const [ingredient, substitutions] of Object.entries(preset.allowed_substitutions)) {
                            if (JSON.stringify(updatedPreferences.preferred_substitutions[ingredient]) ===
                                JSON.stringify(substitutions)) {
                                delete updatedPreferences.preferred_substitutions[ingredient];
                            }
                        }
                    }

                    removedPresets.push(preset.id);
                } catch (error) {
                    errors.push(`Failed to remove preset ${preset.name}: ${error}`);
                }
            }

            // Update applied presets list
            const updatedAppliedPresets = (userPrefs.dietary_restriction_presets || [])
                .filter((id: string) => !presetIds.includes(id));

            // Update user preferences
            const { error: updateError } = await supabase
                .from('user_preferences')
                .update({
                    detailed_dietary_restrictions: updatedRestrictions,
                    ingredient_blacklist: updatedBlacklist,
                    ingredient_preferences: updatedPreferences,
                    dietary_restriction_presets: updatedAppliedPresets
                })
                .eq('user_id', userId);

            if (updateError) {
                errors.push('Failed to update user preferences');
                return { success: false, removedPresets: [], errors };
            }

            return { success: true, removedPresets, errors };
        } catch (error) {
            return { success: false, removedPresets: [], errors: [`Unexpected error: ${error}`] };
        }
    }

    /**
     * Get recommended presets based on user's current preferences
     */
    async getRecommendedPresets(userId: string): Promise<DietaryRestrictionPreset[]> {
        try {
            // Get user's current dietary restrictions and preferences
            const { data: userPrefs } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!userPrefs) return [];

            // Get all available presets
            const allPresets = await dietaryService.getDietaryRestrictionPresets();
            const appliedPresets = userPrefs.dietary_restriction_presets || [];

            // Filter out already applied presets
            const availablePresets = allPresets.filter(preset => !appliedPresets.includes(preset.id));

            // Simple recommendation logic based on existing restrictions
            const currentRestrictions = Object.keys(userPrefs.detailed_dietary_restrictions || {});
            const blacklistedIngredients = userPrefs.ingredient_blacklist || [];

            const recommendations = availablePresets.filter(preset => {
                // Recommend if user has similar restrictions
                const hasRelatedRestrictions = currentRestrictions.some(restriction =>
                    preset.name.toLowerCase().includes(restriction.toLowerCase()) ||
                    restriction.toLowerCase().includes(preset.name.toLowerCase())
                );

                // Recommend if user blacklists ingredients that this preset restricts
                const hasRelatedBlacklist = preset.restricted_ingredients.some(ingredient =>
                    blacklistedIngredients.some((blacklisted: string) =>
                        blacklisted.toLowerCase().includes(ingredient.toLowerCase())
                    )
                );

                return hasRelatedRestrictions || hasRelatedBlacklist;
            });

            // Sort by relevance (simple scoring)
            return recommendations.sort((a, b) => {
                const scoreA = this.calculateRelevanceScore(a, userPrefs);
                const scoreB = this.calculateRelevanceScore(b, userPrefs);
                return scoreB - scoreA;
            });
        } catch (error) {
            console.error('Error getting recommended presets:', error);
            return [];
        }
    }

    /**
     * Validate preset compatibility with user's current restrictions
     */
    async validatePresetCompatibility(
        userId: string,
        presetId: string
    ): Promise<{
        compatible: boolean;
        conflicts: string[];
        warnings: string[];
        benefits: string[];
    }> {
        try {
            const { data: userPrefs } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            const { data: preset } = await supabase
                .from('dietary_restriction_presets')
                .select('*')
                .eq('id', presetId)
                .single();

            if (!userPrefs || !preset) {
                return { compatible: false, conflicts: ['Invalid user or preset'], warnings: [], benefits: [] };
            }

            const conflicts: string[] = [];
            const warnings: string[] = [];
            const benefits: string[] = [];

            // Check for conflicts with current restrictions
            const currentRestrictions = userPrefs.detailed_dietary_restrictions || {};
            for (const [restrictionName, details] of Object.entries(currentRestrictions)) {
                if (restrictionName === preset.name) {
                    warnings.push(`You already have ${preset.name} restrictions applied`);
                }

                // Check for conflicting restrictions (e.g., vegetarian vs carnivore)
                if (this.areRestrictionsConflicting(restrictionName, preset.name)) {
                    conflicts.push(`${preset.name} conflicts with your existing ${restrictionName} restriction`);
                }
            }

            // Check allergen compatibility
            const allergenProfile = userPrefs.allergen_profile || {};
            for (const ingredient of preset.restricted_ingredients) {
                if (allergenProfile[ingredient] &&
                    (allergenProfile[ingredient].severity === 'severe' ||
                        allergenProfile[ingredient].severity === 'life_threatening')) {
                    benefits.push(`${preset.name} will help avoid ${ingredient} which you're severely allergic to`);
                }
            }

            // Check ingredient preferences
            const preferences = userPrefs.ingredient_preferences || {};
            const dislikedIngredients = preferences.disliked_ingredients || [];
            const matchingDislikes = preset.restricted_ingredients.filter((ingredient: string) =>
                dislikedIngredients.some((disliked: string) =>
                    disliked.toLowerCase().includes(ingredient.toLowerCase())
                )
            );

            if (matchingDislikes.length > 0) {
                benefits.push(`${preset.name} will help avoid ingredients you dislike: ${matchingDislikes.join(', ')}`);
            }

            return {
                compatible: conflicts.length === 0,
                conflicts,
                warnings,
                benefits
            };
        } catch (error) {
            console.error('Error validating preset compatibility:', error);
            return { compatible: false, conflicts: ['Validation error'], warnings: [], benefits: [] };
        }
    }

    /**
     * Calculate relevance score for preset recommendation
     */
    private calculateRelevanceScore(preset: DietaryRestrictionPreset, userPrefs: any): number {
        let score = 0;

        const currentRestrictions = Object.keys(userPrefs.detailed_dietary_restrictions || {});
        const blacklistedIngredients = userPrefs.ingredient_blacklist || [];
        const allergenProfile = userPrefs.allergen_profile || {};

        // Score based on related restrictions
        currentRestrictions.forEach(restriction => {
            if (preset.name.toLowerCase().includes(restriction.toLowerCase()) ||
                restriction.toLowerCase().includes(preset.name.toLowerCase())) {
                score += 3;
            }
        });

        // Score based on blacklisted ingredients
        preset.restricted_ingredients.forEach(ingredient => {
            if (blacklistedIngredients.some((blacklisted: string) =>
                blacklisted.toLowerCase().includes(ingredient.toLowerCase()))) {
                score += 2;
            }
        });

        // Score based on allergen profile
        preset.restricted_ingredients.forEach(ingredient => {
            if (allergenProfile[ingredient] &&
                (allergenProfile[ingredient].severity === 'severe' ||
                    allergenProfile[ingredient].severity === 'life_threatening')) {
                score += 5; // High score for allergen safety
            }
        });

        return score;
    }

    /**
     * Check if two dietary restrictions are conflicting
     */
    private areRestrictionsConflicting(restriction1: string, restriction2: string): boolean {
        const conflicts = [
            ['vegan', 'carnivore'],
            ['vegetarian', 'carnivore'],
            ['keto', 'high-carb'],
            ['low-fat', 'high-fat'],
            ['raw', 'cooked-only']
        ];

        const r1 = restriction1.toLowerCase();
        const r2 = restriction2.toLowerCase();

        return conflicts.some(([a, b]) =>
            (r1.includes(a) && r2.includes(b)) ||
            (r1.includes(b) && r2.includes(a))
        );
    }
}

// Export singleton instance
export const dietaryPresetManager = DietaryPresetManager.getInstance();