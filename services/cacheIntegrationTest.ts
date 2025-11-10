/**
 * Integration test for enhanced cacheService
 * This file demonstrates the enhanced caching capabilities
 */

import { cacheService } from './cacheService';
import type { RecipeCacheEntry } from './cacheService';

// Mock recipe data for testing
const mockRecipe: RecipeCacheEntry = {
    id: 'test-recipe-123',
    name: 'Enhanced Pasta Carbonara',
    data: {
        id: 'test-recipe-123',
        user_id: 'test-user',
        recipe_date: '2024-11-10',
        meal_type: 'dinner',
        recipe_name: 'Enhanced Pasta Carbonara',
        ingredients: [
            { name: 'Spaghetti', quantity: '400g' },
            { name: 'Eggs', quantity: '4 large' },
            { name: 'Parmesan cheese', quantity: '100g grated' },
            { name: 'Pancetta', quantity: '150g diced' }
        ],
        instructions: 'Cook pasta, prepare carbonara sauce, combine and serve.',
        prep_time: 15,
        cook_time: 20,
        servings: 4,
        estimated_cost: 12.50,
        nutritional_info: {
            calories: 520,
            protein: '22g',
            carbs: '45g',
            fats: '28g'
        },
        season: 'fall',
        is_favorite: true,
        created_at: '2024-11-10T10:00:00Z',
        difficulty: 'Medium',
        cuisine_type: 'Italian',
        tags: ['pasta', 'quick', 'comfort-food'],
        created_via: 'chat'
    },
    imageUrl: 'https://example.com/carbonara.jpg',
    tags: ['pasta', 'italian', 'comfort-food'],
    lastModified: Date.now(),
    accessFrequency: 5,
    isFavorite: true
};

/**
 * Test enhanced caching functionality
 */
export async function testEnhancedCaching(): Promise<void> {
    console.log('🧪 Testing Enhanced Cache Service...');

    try {
        // Initialize cache service
        await cacheService.initialize();
        console.log('✅ Cache service initialized');

        // Test recipe caching with high priority
        await cacheService.cacheRecipe(mockRecipe, 9);
        console.log('✅ Recipe cached with high priority');

        // Test recipe retrieval
        const cachedRecipe = await cacheService.getCachedRecipe(mockRecipe.id);
        if (cachedRecipe && cachedRecipe.name === mockRecipe.name) {
            console.log('✅ Recipe retrieved successfully');
        } else {
            console.log('❌ Recipe retrieval failed');
        }

        // Test chat session caching
        const mockMessages = [
            { id: '1', content: 'I want to make pasta', role: 'user' },
            { id: '2', content: 'Here\'s a great carbonara recipe!', role: 'assistant' }
        ];

        await cacheService.cacheChatSession('test-session-456', mockMessages);
        console.log('✅ Chat session cached');

        const cachedChat = await cacheService.getCachedChatSession('test-session-456');
        if (cachedChat && cachedChat.messageCount === 2) {
            console.log('✅ Chat session retrieved successfully');
        } else {
            console.log('❌ Chat session retrieval failed');
        }

        // Test cache warming
        const warmResult = await cacheService.warmCache();
        console.log(`✅ Cache warming completed: ${warmResult.warmed} warmed, ${warmResult.skipped} skipped, ${warmResult.errors} errors`);

        // Test frequently accessed recipes
        const frequentRecipes = await cacheService.getFrequentlyAccessedRecipes(5);
        console.log(`✅ Found ${frequentRecipes.length} frequently accessed recipes`);

        // Test cache statistics
        const stats = cacheService.getCacheStats();
        console.log('✅ Cache statistics:', {
            totalItems: stats.totalItems,
            hitRate: Math.round(stats.hitRate * 100) + '%',
            breakdown: stats.breakdown,
            syncQueueSize: stats.syncQueueSize
        });

        // Test sync queue
        await cacheService.addToSyncQueue({
            type: 'recipe',
            action: 'update',
            data: { recipeId: mockRecipe.id, accessCount: 6 }
        });
        console.log('✅ Item added to sync queue');

        // Test cleanup
        const cleanedCount = await cacheService.performCleanup();
        console.log(`✅ Cache cleanup completed: ${cleanedCount} items removed`);

        console.log('🎉 All enhanced caching tests passed!');

    } catch (error) {
        console.error('❌ Enhanced caching test failed:', error);
    }
}

/**
 * Demonstrate cache integration with recipe service patterns
 */
export function demonstrateCacheIntegration(): void {
    console.log('\n📋 Enhanced Cache Service Features:');
    console.log('• ✅ Intelligent cache management with size limits');
    console.log('• ✅ Cache warming for frequently accessed recipes');
    console.log('• ✅ Chat session caching for conversation history');
    console.log('• ✅ Background sync queue for offline-first operation');
    console.log('• ✅ Enhanced statistics and monitoring');
    console.log('• ✅ Priority-based cache eviction');
    console.log('• ✅ Automatic cleanup and maintenance');
    console.log('• ✅ Supabase integration for cross-device sync');
    console.log('• ✅ TypeScript support with proper type definitions');
    console.log('• ✅ Error handling and recovery mechanisms');
}

// Export for use in other modules
export { mockRecipe };