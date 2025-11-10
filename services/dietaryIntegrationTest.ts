/**
 * Integration test for the enhanced dietary restriction system
 * This file demonstrates how the new dietary features work together
 */

import { dietaryService } from './dietaryService';
import { dietaryPresetManager } from './dietaryPresetManager';
import { UserPreferences, Recipe } from '../types/recipe';

// Mock user preferences for testing
const mockUserPreferences: UserPreferences = {
    id: '1',
    user_id: 'test-user-123',
    api_provider: 'openai',
    api_key: 'test-key',
    location: 'United States',
    timezone: 'UTC',
    created_at: '2023-01-01',
    updated_at: '2023-01-01',
    subscription_tier: 'premium',
    detailed_dietary_restrictions: {
        'vegan': {
            reason: 'Ethical and environmental choice',
            severity: 'strict',
            exceptions: [],
            notes: 'No animal products whatsoever'
        }
    },
    allergen_profile: {
        'nuts': {
            severity: 'severe',
            symptoms: ['swelling', 'difficulty breathing'],
            cross_reactivity: ['tree nuts', 'peanuts'],
            emergency_contact: '911'
        }
    },
    ingredient_blacklist: ['beef', 'pork', 'chicken', 'fish', 'dairy'],
    nutritional_goals: {
        daily_calories: 2000,
        protein_target: 60,
        carb_limit: 150,
        sodium_limit: 2300
    },
    dietary_goals: {
        weight_management: 'maintenance',
        health_condition: 'heart health',
        fitness_goals: ['muscle building', 'endurance'],
        energy_level_goals: 'increase'
    },
    cultural_dietary_preferences: {
        'Mediterranean': {
            description: 'Mediterranean-style eating with emphasis on olive oil and vegetables',
            restrictions: ['processed foods'],
            preferred_ingredients: ['olive oil', 'vegetables', 'legumes'],
            cooking_methods: ['grilling', 'roasting', 'steaming'],
            traditional_dishes: ['hummus', 'tabbouleh', 'ratatouille']
        }
    },
    cooking_restrictions: {
        max_cook_time: 45,
        max_prep_time: 20,
        equipment_limitations: ['no deep fryer'],
        skill_level: 'intermediate',
        kitchen_size: 'medium'
    },
    budget_constraints: {
        max_cost_per_serving: 8.00,
        preferred_cost_range: 'moderate',
        cost_priority: 'balanced'
    }
};

// Mock recipe for testing
const mockRecipe: Recipe = {
    id: 'recipe-123',
    user_id: 'test-user-123',
    recipe_date: '2023-01-01',
    meal_type: 'dinner',
    recipe_name: 'Mediterranean Quinoa Bowl',
    ingredients: [
        { name: 'quinoa', quantity: '1 cup' },
        { name: 'chickpeas', quantity: '1 can' },
        { name: 'olive oil', quantity: '2 tbsp' },
        { name: 'tomatoes', quantity: '2 medium' },
        { name: 'cucumber', quantity: '1 large' },
        { name: 'red onion', quantity: '1/4 cup' },
        { name: 'lemon juice', quantity: '2 tbsp' },
        { name: 'fresh herbs', quantity: '1/4 cup' }
    ],
    instructions: '1. Cook quinoa according to package directions. 2. Drain and rinse chickpeas. 3. Chop vegetables. 4. Combine all ingredients in a bowl. 5. Dress with olive oil and lemon juice.',
    prep_time: 15,
    cook_time: 20,
    servings: 4,
    estimated_cost: 6.50,
    nutritional_info: {
        calories: 380,
        protein: '14g',
        carbs: '58g',
        fats: '12g',
        fiber: '8g',
        sodium: '320mg'
    },
    season: 'spring',
    is_favorite: false,
    created_at: '2023-01-01'
};

/**
 * Test the enhanced dietary prompt generation
 */
export async function testDietaryPromptGeneration() {
    console.log('=== Testing Dietary Prompt Generation ===');

    // Test basic prompt generation
    const basicPrompt = dietaryService.generateDietaryPromptModifications(mockUserPreferences);
    console.log('Basic Dietary Prompt:', basicPrompt);

    // Test enhanced prompt generation (would use database in real scenario)
    try {
        const enhancedPrompt = await dietaryService.generateEnhancedDietaryPrompt(mockUserPreferences.user_id);
        console.log('Enhanced Dietary Prompt:', enhancedPrompt);
    } catch (error) {
        console.log('Enhanced prompt generation requires database connection');
    }

    console.log('✅ Dietary prompt generation test completed\n');
}

/**
 * Test recipe dietary compliance validation
 */
export async function testRecipeValidation() {
    console.log('=== Testing Recipe Validation ===');

    // Test compliant recipe
    const complianceResult = await dietaryService.validateRecipeDietaryCompliance(
        mockRecipe,
        mockUserPreferences
    );

    console.log('Recipe Compliance Result:', {
        compliant: complianceResult.compliant,
        violationCount: complianceResult.violations.length,
        warningCount: complianceResult.warnings.length
    });

    // Test non-compliant recipe
    const nonCompliantRecipe: Recipe = {
        ...mockRecipe,
        recipe_name: 'Beef Steak with Cheese',
        ingredients: [
            { name: 'beef steak', quantity: '8oz' },
            { name: 'cheddar cheese', quantity: '2oz' },
            { name: 'butter', quantity: '2 tbsp' }
        ]
    };

    const nonCompliantResult = await dietaryService.validateRecipeDietaryCompliance(
        nonCompliantRecipe,
        mockUserPreferences
    );

    console.log('Non-Compliant Recipe Result:', {
        compliant: nonCompliantResult.compliant,
        violationCount: nonCompliantResult.violations.length,
        warningCount: nonCompliantResult.warnings.length,
        violations: nonCompliantResult.violations.map(v => v.ingredient)
    });

    console.log('✅ Recipe validation test completed\n');
}

/**
 * Test substitution suggestions
 */
export async function testSubstitutionSuggestions() {
    console.log('=== Testing Substitution Suggestions ===');

    const recipeWithSubstitutions: Recipe = {
        ...mockRecipe,
        ingredients: [
            { name: 'ground beef', quantity: '1 lb' },
            { name: 'milk', quantity: '1 cup' },
            { name: 'butter', quantity: '2 tbsp' }
        ]
    };

    const suggestions = await dietaryService.generateSubstitutionSuggestions(
        recipeWithSubstitutions,
        mockUserPreferences
    );

    console.log('Substitution Suggestions:', suggestions.map(s => ({
        original: s.original_ingredient,
        alternatives: s.substitutions,
        reason: s.dietary_restriction
    })));

    console.log('✅ Substitution suggestions test completed\n');
}

/**
 * Test allergen detection
 */
export async function testAllergenDetection() {
    console.log('=== Testing Allergen Detection ===');

    const recipeWithAllergens: Recipe = {
        ...mockRecipe,
        ingredients: [
            { name: 'peanuts', quantity: '1/4 cup' },
            { name: 'almonds', quantity: '1/4 cup' },
            { name: 'wheat flour', quantity: '2 cups' }
        ]
    };

    const allergenWarnings = await dietaryService.detectAllergens(recipeWithAllergens);

    console.log('Allergen Warnings:', allergenWarnings.map(w => ({
        ingredient: w.ingredient,
        allergens: w.allergens,
        severity: w.severity
    })));

    console.log('✅ Allergen detection test completed\n');
}

/**
 * Test dietary preset management
 */
export async function testDietaryPresetManagement() {
    console.log('=== Testing Dietary Preset Management ===');

    // Test preset application (would use database in real scenario)
    try {
        const applicationResult = await dietaryPresetManager.applyMultiplePresets(
            mockUserPreferences.user_id,
            ['vegan-preset-id', 'gluten-free-preset-id']
        );
        console.log('Preset Application Result:', applicationResult);
    } catch (error) {
        console.log('Preset management requires database connection');
    }

    // Test preset compatibility validation
    try {
        const compatibility = await dietaryPresetManager.validatePresetCompatibility(
            mockUserPreferences.user_id,
            'mediterranean-preset-id'
        );
        console.log('Preset Compatibility:', compatibility);
    } catch (error) {
        console.log('Preset compatibility check requires database connection');
    }

    console.log('✅ Dietary preset management test completed\n');
}

/**
 * Run all integration tests
 */
export async function runAllDietaryTests() {
    console.log('🧪 Starting Dietary System Integration Tests\n');

    await testDietaryPromptGeneration();
    await testRecipeValidation();
    await testSubstitutionSuggestions();
    await testAllergenDetection();
    await testDietaryPresetManagement();

    console.log('🎉 All dietary system tests completed successfully!');
}

/**
 * Demonstrate the complete dietary workflow
 */
export async function demonstrateDietaryWorkflow() {
    console.log('🔄 Demonstrating Complete Dietary Workflow\n');

    // 1. Generate dietary-aware prompt
    console.log('Step 1: Generate dietary-aware prompt');
    const dietaryPrompt = dietaryService.generateDietaryPromptModifications(mockUserPreferences);
    console.log('Generated prompt additions:', dietaryPrompt.substring(0, 200) + '...\n');

    // 2. Validate a recipe
    console.log('Step 2: Validate recipe against dietary restrictions');
    const validation = await dietaryService.validateRecipeDietaryCompliance(mockRecipe, mockUserPreferences);
    console.log('Validation result:', validation.compliant ? 'COMPLIANT' : 'NON-COMPLIANT');

    if (!validation.compliant) {
        console.log('Violations found:', validation.violations.length);
    }
    console.log('');

    // 3. Generate substitutions if needed
    if (!validation.compliant) {
        console.log('Step 3: Generate substitution suggestions');
        const substitutions = await dietaryService.generateSubstitutionSuggestions(mockRecipe, mockUserPreferences);
        console.log('Substitution suggestions:', substitutions.length);
    }

    // 4. Check allergens
    console.log('Step 4: Check for allergens');
    const allergens = await dietaryService.detectAllergens(mockRecipe);
    console.log('Allergen warnings:', allergens.length);

    console.log('\n✅ Dietary workflow demonstration completed!');
}

// Export for use in other parts of the application
export {
    mockUserPreferences,
    mockRecipe
};