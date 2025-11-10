import { cacheService } from './cacheService';
import { syncService } from './syncService';
import { imageService } from './imageService';

/**
 * Cache initialization and management utility
 */
class CacheInitializer {
    private initialized = false;

    /**
     * Initialize all caching services
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            console.log('Initializing cache services...');

            // Initialize cache service first
            await cacheService.initialize();
            console.log('Cache service initialized');

            // Initialize sync service
            await syncService.initialize();
            console.log('Sync service initialized');

            // Perform initial cache warming for frequently accessed content
            await this.performInitialCacheWarming();

            this.initialized = true;
            console.log('All cache services initialized successfully');

        } catch (error) {
            console.error('Failed to initialize cache services:', error);
            // Don't throw - allow app to continue with degraded caching
        }
    }

    /**
     * Perform initial cache warming
     */
    private async performInitialCacheWarming(): Promise<void> {
        try {
            // Warm recipe cache with frequently accessed recipes
            await cacheService.warmCache();

            // Sync favorite recipes for offline access
            const syncedFavorites = await syncService.syncFavoriteRecipes();
            console.log(`Synced ${syncedFavorites} favorite recipes for offline access`);

            // Warm image cache
            await imageService.warmImageCache();

        } catch (error) {
            console.error('Failed to perform initial cache warming:', error);
        }
    }

    /**
     * Perform maintenance tasks
     */
    async performMaintenance(): Promise<void> {
        try {
            console.log('Performing cache maintenance...');

            // Cleanup expired cache entries
            const removedCount = await cacheService.performCleanup();
            console.log(`Removed ${removedCount} expired cache entries`);

            // Perform sync if online
            const syncResult = await syncService.performSync();
            if (syncResult.success) {
                console.log(`Sync completed: ${syncResult.syncedOperations} operations synced`);
            } else {
                console.log(`Sync failed: ${syncResult.errors.join(', ')}`);
            }

            // Clean up image cache
            const imageCleanupCount = await imageService.performCacheCleanup();
            console.log(`Image cache cleanup removed ${imageCleanupCount} items`);

        } catch (error) {
            console.error('Failed to perform cache maintenance:', error);
        }
    }

    /**
     * Get comprehensive cache status
     */
    async getCacheStatus(): Promise<{
        initialized: boolean;
        cacheStats: any;
        syncStatus: any;
        imageStats: any;
    }> {
        try {
            const [cacheStats, syncStatus, imageStats] = await Promise.all([
                cacheService.getCacheStats(),
                syncService.getSyncStatus(),
                imageService.getCacheStats(),
            ]);

            return {
                initialized: this.initialized,
                cacheStats,
                syncStatus,
                imageStats,
            };
        } catch (error) {
            console.error('Failed to get cache status:', error);
            return {
                initialized: this.initialized,
                cacheStats: null,
                syncStatus: null,
                imageStats: null,
            };
        }
    }

    /**
     * Clear all caches
     */
    async clearAllCaches(): Promise<void> {
        try {
            console.log('Clearing all caches...');

            await Promise.all([
                cacheService.clearCache(),
                imageService.clearCache(),
            ]);

            console.log('All caches cleared successfully');
        } catch (error) {
            console.error('Failed to clear all caches:', error);
            throw error;
        }
    }

    /**
     * Cleanup services on app shutdown
     */
    async cleanup(): Promise<void> {
        try {
            await syncService.cleanup();
            console.log('Cache services cleaned up');
        } catch (error) {
            console.error('Failed to cleanup cache services:', error);
        }
    }

    /**
     * Check if caching is available
     */
    isAvailable(): boolean {
        return this.initialized;
    }
}

// Export singleton instance
export const cacheInitializer = new CacheInitializer();

// Export convenience functions
export const initializeCache = () => cacheInitializer.initialize();
export const performCacheMaintenance = () => cacheInitializer.performMaintenance();
export const getCacheStatus = () => cacheInitializer.getCacheStatus();
export const clearAllCaches = () => cacheInitializer.clearAllCaches();
export const cleanupCache = () => cacheInitializer.cleanup();