import { supabase } from '../lib/supabase';
import { cacheService, RecipeCacheEntry } from './cacheService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sync configuration
const SYNC_CONFIG = {
    SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
    OFFLINE_QUEUE_KEY: 'offline_sync_queue',
    LAST_SYNC_KEY: 'last_sync_timestamp',
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
} as const;

// Types for sync operations
interface SyncOperation {
    id: string;
    type: 'recipe_access' | 'recipe_favorite' | 'image_cache' | 'chat_message';
    data: any;
    timestamp: number;
    retryCount: number;
}

interface SyncResult {
    success: boolean;
    syncedOperations: number;
    failedOperations: number;
    errors: string[];
}

interface SyncStatus {
    isOnline: boolean;
    lastSync: number;
    pendingOperations: number;
    isSyncing: boolean;
}

class SyncService {
    private syncInterval: NodeJS.Timeout | null = null;
    private isSyncing = false;
    private offlineQueue: SyncOperation[] = [];
    private lastSync = 0;

    /**
     * Initialize the sync service
     */
    async initialize(): Promise<void> {
        try {
            // Load offline queue and last sync timestamp
            await this.loadOfflineQueue();
            await this.loadLastSyncTimestamp();

            // Start periodic sync
            this.startPeriodicSync();

            // Listen for network state changes
            this.setupNetworkListener();

            console.log('Sync service initialized');
        } catch (error) {
            console.error('Failed to initialize sync service:', error);
        }
    }

    /**
     * Perform full synchronization
     */
    async performSync(): Promise<SyncResult> {
        if (this.isSyncing) {
            return {
                success: false,
                syncedOperations: 0,
                failedOperations: 0,
                errors: ['Sync already in progress'],
            };
        }

        this.isSyncing = true;
        const result: SyncResult = {
            success: true,
            syncedOperations: 0,
            failedOperations: 0,
            errors: [],
        };

        try {
            // Check if we're online
            const isOnline = await this.checkConnectivity();
            if (!isOnline) {
                result.success = false;
                result.errors.push('No internet connection');
                return result;
            }

            // Process offline queue
            const queueResult = await this.processOfflineQueue();
            result.syncedOperations += queueResult.syncedOperations;
            result.failedOperations += queueResult.failedOperations;
            result.errors.push(...queueResult.errors);

            // Sync recent recipes from server
            await this.syncRecentRecipes();

            // Sync cache metadata
            await this.syncCacheMetadata();

            // Update last sync timestamp
            this.lastSync = Date.now();
            await this.saveLastSyncTimestamp();

            console.log('Sync completed successfully:', result);
        } catch (error) {
            console.error('Sync failed:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
        } finally {
            this.isSyncing = false;
        }

        return result;
    }

    /**
     * Queue an operation for offline sync
     */
    async queueOperation(
        type: SyncOperation['type'],
        data: any
    ): Promise<void> {
        const operation: SyncOperation = {
            id: this.generateOperationId(),
            type,
            data,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.offlineQueue.push(operation);
        await this.saveOfflineQueue();

        // Try to sync immediately if online
        if (await this.checkConnectivity()) {
            this.performSync().catch(console.error);
        }
    }

    /**
     * Get current sync status
     */
    getSyncStatus(): SyncStatus {
        return {
            isOnline: navigator.onLine ?? true, // Fallback for React Native
            lastSync: this.lastSync,
            pendingOperations: this.offlineQueue.length,
            isSyncing: this.isSyncing,
        };
    }

    /**
     * Force sync of specific recipe
     */
    async syncRecipe(recipeId: string): Promise<boolean> {
        try {
            const { data: recipe, error } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('id', recipeId)
                .single();

            if (error || !recipe) {
                console.error('Failed to fetch recipe for sync:', error);
                return false;
            }

            // Cache the recipe locally
            const recipeEntry: RecipeCacheEntry = {
                id: recipe.id,
                name: recipe.recipe_name,
                data: recipe,
                imageUrl: recipe.image_url,
                tags: recipe.tags || [],
                lastModified: new Date(recipe.updated_at || recipe.created_at).getTime(),
            };

            await cacheService.cacheRecipe(recipeEntry, 8); // High priority for manually synced recipes
            return true;
        } catch (error) {
            console.error('Failed to sync recipe:', error);
            return false;
        }
    }

    /**
     * Sync user's favorite recipes for offline access
     */
    async syncFavoriteRecipes(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return 0;

            const { data: favorites, error } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_favorite', true)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Failed to fetch favorite recipes:', error);
                return 0;
            }

            let syncedCount = 0;
            for (const recipe of favorites || []) {
                const recipeEntry: RecipeCacheEntry = {
                    id: recipe.id,
                    name: recipe.recipe_name,
                    data: recipe,
                    imageUrl: recipe.image_url,
                    tags: recipe.tags || [],
                    lastModified: new Date(recipe.updated_at || recipe.created_at).getTime(),
                };

                await cacheService.cacheRecipe(recipeEntry, 9); // Very high priority for favorites
                syncedCount++;
            }

            return syncedCount;
        } catch (error) {
            console.error('Failed to sync favorite recipes:', error);
            return 0;
        }
    }

    /**
     * Clean up sync service
     */
    async cleanup(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Private helper methods

    private async processOfflineQueue(): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            syncedOperations: 0,
            failedOperations: 0,
            errors: [],
        };

        const operationsToProcess = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const operation of operationsToProcess) {
            try {
                const success = await this.processOperation(operation);

                if (success) {
                    result.syncedOperations++;
                } else {
                    operation.retryCount++;

                    if (operation.retryCount < SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
                        // Re-queue for retry
                        this.offlineQueue.push(operation);
                    } else {
                        result.failedOperations++;
                        result.errors.push(`Failed to sync operation ${operation.id} after ${SYNC_CONFIG.MAX_RETRY_ATTEMPTS} attempts`);
                    }
                }
            } catch (error) {
                result.failedOperations++;
                result.errors.push(`Error processing operation ${operation.id}: ${error}`);
            }
        }

        await this.saveOfflineQueue();
        return result;
    }

    private async processOperation(operation: SyncOperation): Promise<boolean> {
        try {
            switch (operation.type) {
                case 'recipe_access':
                    return await this.syncRecipeAccess(operation.data);

                case 'recipe_favorite':
                    return await this.syncRecipeFavorite(operation.data);

                case 'image_cache':
                    return await this.syncImageCache(operation.data);

                case 'chat_message':
                    return await this.syncChatMessage(operation.data);

                default:
                    console.warn('Unknown operation type:', operation.type);
                    return false;
            }
        } catch (error) {
            console.error('Failed to process operation:', error);
            return false;
        }
    }

    private async syncRecipeAccess(data: any): Promise<boolean> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            await supabase.rpc('update_recipe_access_stats', {
                p_user_id: user.id,
                p_recipe_id: data.recipeId,
                p_is_favorite: data.isFavorite,
            });

            return true;
        } catch (error) {
            console.error('Failed to sync recipe access:', error);
            return false;
        }
    }

    private async syncRecipeFavorite(data: any): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('daily_recipes')
                .update({ is_favorite: data.isFavorite })
                .eq('id', data.recipeId);

            return !error;
        } catch (error) {
            console.error('Failed to sync recipe favorite:', error);
            return false;
        }
    }

    private async syncImageCache(data: any): Promise<boolean> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            await supabase
                .from('image_cache_metadata')
                .upsert({
                    user_id: user.id,
                    image_url: data.imageUrl,
                    local_path: data.localPath,
                    cache_key: data.cacheKey,
                    source: data.source,
                    attribution: data.attribution,
                    file_size: data.fileSize,
                });

            return true;
        } catch (error) {
            console.error('Failed to sync image cache:', error);
            return false;
        }
    }

    private async syncChatMessage(data: any): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert({
                    session_id: data.sessionId,
                    role: data.role,
                    content: data.content,
                    voice_input: data.voiceInput,
                    recipe_id: data.recipeId,
                });

            return !error;
        } catch (error) {
            console.error('Failed to sync chat message:', error);
            return false;
        }
    }

    private async syncRecentRecipes(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get recipes modified since last sync
            const { data: recipes, error } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('user_id', user.id)
                .gte('updated_at', new Date(this.lastSync).toISOString())
                .order('updated_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Failed to fetch recent recipes:', error);
                return;
            }

            // Cache recent recipes
            for (const recipe of recipes || []) {
                const recipeEntry: RecipeCacheEntry = {
                    id: recipe.id,
                    name: recipe.recipe_name,
                    data: recipe,
                    imageUrl: recipe.image_url,
                    tags: recipe.tags || [],
                    lastModified: new Date(recipe.updated_at || recipe.created_at).getTime(),
                };

                await cacheService.cacheRecipe(recipeEntry, 6); // Medium-high priority for recent recipes
            }
        } catch (error) {
            console.error('Failed to sync recent recipes:', error);
        }
    }

    private async syncCacheMetadata(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get cache size information
            const { data: cacheInfo, error } = await supabase
                .rpc('get_user_cache_size', { p_user_id: user.id });

            if (error) {
                console.error('Failed to get cache info:', error);
                return;
            }

            // Store cache statistics locally for monitoring
            const cacheStats = cacheService.getCacheStats();
            await AsyncStorage.setItem('cache_sync_info', JSON.stringify({
                local: cacheStats,
                remote: cacheInfo,
                lastSync: Date.now(),
            }));
        } catch (error) {
            console.error('Failed to sync cache metadata:', error);
        }
    }

    private async checkConnectivity(): Promise<boolean> {
        try {
            // Simple connectivity check
            const response = await fetch(supabase.supabaseUrl + '/rest/v1/', {
                method: 'HEAD',
                timeout: 5000,
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private startPeriodicSync(): void {
        this.syncInterval = setInterval(async () => {
            if (await this.checkConnectivity()) {
                await this.performSync();
            }
        }, SYNC_CONFIG.SYNC_INTERVAL_MS);
    }

    private setupNetworkListener(): void {
        // Listen for network state changes (implementation depends on platform)
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.performSync().catch(console.error);
            });
        }
    }

    private generateOperationId(): string {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async loadOfflineQueue(): Promise<void> {
        try {
            const queueJson = await AsyncStorage.getItem(SYNC_CONFIG.OFFLINE_QUEUE_KEY);
            if (queueJson) {
                this.offlineQueue = JSON.parse(queueJson);
            }
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.offlineQueue = [];
        }
    }

    private async saveOfflineQueue(): Promise<void> {
        try {
            await AsyncStorage.setItem(
                SYNC_CONFIG.OFFLINE_QUEUE_KEY,
                JSON.stringify(this.offlineQueue)
            );
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    private async loadLastSyncTimestamp(): Promise<void> {
        try {
            const timestamp = await AsyncStorage.getItem(SYNC_CONFIG.LAST_SYNC_KEY);
            if (timestamp) {
                this.lastSync = parseInt(timestamp, 10);
            }
        } catch (error) {
            console.error('Failed to load last sync timestamp:', error);
            this.lastSync = 0;
        }
    }

    private async saveLastSyncTimestamp(): Promise<void> {
        try {
            await AsyncStorage.setItem(SYNC_CONFIG.LAST_SYNC_KEY, this.lastSync.toString());
        } catch (error) {
            console.error('Failed to save last sync timestamp:', error);
        }
    }
}

// Export singleton instance
export const syncService = new SyncService();

// Export types
export type {
    SyncOperation,
    SyncResult,
    SyncStatus,
};