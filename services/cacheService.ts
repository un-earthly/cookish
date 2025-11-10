import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Recipe } from '../types/recipe';

// Cache configuration constants
const CACHE_CONFIG = {
    MAX_CACHE_SIZE_MB: 100, // Maximum cache size in MB
    MAX_CACHE_AGE_DAYS: 30, // Maximum age for cached items
    CLEANUP_THRESHOLD: 0.8, // Cleanup when cache reaches 80% of max size
    WARMUP_BATCH_SIZE: 10, // Number of recipes to warm up at once
    SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes sync interval
    IMAGE_CACHE_PREFIX: 'img_cache_',
    RECIPE_CACHE_PREFIX: 'recipe_cache_',
    CHAT_CACHE_PREFIX: 'chat_cache_',
    METADATA_KEY: 'cache_metadata',
    STATS_KEY: 'cache_stats',
    SYNC_QUEUE_KEY: 'sync_queue',
} as const;

// Types for cache management
interface CacheMetadata {
    key: string;
    size: number;
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    expiresAt: number;
    type: 'image' | 'recipe' | 'data';
    priority: number; // 1-10, higher = more important
}

interface CacheStats {
    totalSize: number;
    totalItems: number;
    lastCleanup: number;
    hitCount: number;
    missCount: number;
}

interface ImageCacheEntry {
    url: string;
    localPath: string;
    source: 'unsplash' | 'pexels' | 'ai_generated' | 'placeholder';
    attribution?: string;
    width?: number;
    height?: number;
    mimeType?: string;
}

interface RecipeCacheEntry {
    id: string;
    name: string;
    data: Recipe; // Recipe data
    imageUrl?: string;
    tags: string[];
    lastModified: number;
    accessFrequency?: number;
    isFavorite?: boolean;
}

interface ChatCacheEntry {
    sessionId: string;
    messages: any[];
    lastActivity: number;
    messageCount: number;
}

interface SyncQueueItem {
    id: string;
    type: 'recipe' | 'image' | 'chat';
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    retryCount: number;
}

class CacheService {
    private metadata: Map<string, CacheMetadata> = new Map();
    private stats: CacheStats = {
        totalSize: 0,
        totalItems: 0,
        lastCleanup: 0,
        hitCount: 0,
        missCount: 0,
    };
    private syncQueue: SyncQueueItem[] = [];
    private initialized = false;
    private syncTimer: NodeJS.Timeout | null = null;



    /**
     * Cache an image with metadata
     */
    async cacheImage(
        url: string,
        imageData: string, // Base64 or blob data
        metadata: Partial<ImageCacheEntry> = {}
    ): Promise<string> {
        await this.ensureInitialized();

        const cacheKey = this.generateImageCacheKey(url);
        const size = this.estimateDataSize(imageData);

        // Check if we need to make space
        await this.ensureCacheSpace(size);

        try {
            // Store the image data
            await AsyncStorage.setItem(cacheKey, imageData);

            // Create cache metadata
            const cacheMetadata: CacheMetadata = {
                key: cacheKey,
                size,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 1,
                expiresAt: Date.now() + (CACHE_CONFIG.MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000),
                type: 'image',
                priority: 5, // Default priority
            };

            // Update local metadata
            this.metadata.set(cacheKey, cacheMetadata);
            this.stats.totalSize += size;
            this.stats.totalItems += 1;

            // Store image metadata in Supabase for sync
            await this.storeImageMetadataInSupabase(url, cacheKey, metadata);

            // Save updated metadata and stats
            await this.saveMetadata();
            await this.saveStats();

            return cacheKey;
        } catch (error) {
            console.error('Failed to cache image:', error);
            throw error;
        }
    }

    /**
     * Retrieve cached image
     */
    async getCachedImage(url: string): Promise<string | null> {
        await this.ensureInitialized();

        const cacheKey = this.generateImageCacheKey(url);
        const metadata = this.metadata.get(cacheKey);

        if (!metadata) {
            this.stats.missCount++;
            return null;
        }

        // Check if expired
        if (Date.now() > metadata.expiresAt) {
            await this.removeCacheEntry(cacheKey);
            this.stats.missCount++;
            return null;
        }

        try {
            const imageData = await AsyncStorage.getItem(cacheKey);

            if (imageData) {
                // Update access statistics
                metadata.lastAccessed = Date.now();
                metadata.accessCount++;
                this.metadata.set(cacheKey, metadata);
                this.stats.hitCount++;

                // Update access in Supabase
                await this.updateImageCacheAccess(cacheKey);

                return imageData;
            } else {
                // Data missing, remove metadata
                await this.removeCacheEntry(cacheKey);
                this.stats.missCount++;
                return null;
            }
        } catch (error) {
            console.error('Failed to retrieve cached image:', error);
            this.stats.missCount++;
            return null;
        }
    }

    /**
     * Cache recipe data
     */
    async cacheRecipe(recipe: RecipeCacheEntry, priority: number = 5): Promise<void> {
        await this.ensureInitialized();

        const cacheKey = this.generateRecipeCacheKey(recipe.id);
        const recipeData = JSON.stringify(recipe);
        const size = this.estimateDataSize(recipeData);

        await this.ensureCacheSpace(size);

        try {
            await AsyncStorage.setItem(cacheKey, recipeData);

            const cacheMetadata: CacheMetadata = {
                key: cacheKey,
                size,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 1,
                expiresAt: Date.now() + (CACHE_CONFIG.MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000),
                type: 'recipe',
                priority,
            };

            this.metadata.set(cacheKey, cacheMetadata);
            this.stats.totalSize += size;
            this.stats.totalItems += 1;

            // Update recipe access stats in Supabase
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.rpc('update_recipe_access_stats', {
                    p_user_id: user.id,
                    p_recipe_id: recipe.id,
                });
            }

            await this.saveMetadata();
            await this.saveStats();
        } catch (error) {
            console.error('Failed to cache recipe:', error);
            throw error;
        }
    }

    /**
     * Retrieve cached recipe
     */
    async getCachedRecipe(recipeId: string): Promise<RecipeCacheEntry | null> {
        await this.ensureInitialized();

        const cacheKey = this.generateRecipeCacheKey(recipeId);
        const metadata = this.metadata.get(cacheKey);

        if (!metadata || Date.now() > metadata.expiresAt) {
            if (metadata) {
                await this.removeCacheEntry(cacheKey);
            }
            this.stats.missCount++;
            return null;
        }

        try {
            const recipeData = await AsyncStorage.getItem(cacheKey);

            if (recipeData) {
                metadata.lastAccessed = Date.now();
                metadata.accessCount++;
                this.metadata.set(cacheKey, metadata);
                this.stats.hitCount++;

                return JSON.parse(recipeData);
            } else {
                await this.removeCacheEntry(cacheKey);
                this.stats.missCount++;
                return null;
            }
        } catch (error) {
            console.error('Failed to retrieve cached recipe:', error);
            this.stats.missCount++;
            return null;
        }
    }

    /**
     * Warm cache with frequently accessed recipes
     */
    async warmCache(): Promise<{ warmed: number; skipped: number; errors: number }> {
        await this.ensureInitialized();

        const result = { warmed: 0, skipped: 0, errors: 0 };

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return result;

            // Get high-priority recipes for cache warming
            const { data: recipes, error } = await supabase
                .rpc('get_cache_warming_recipes', {
                    p_user_id: user.id,
                    p_limit: CACHE_CONFIG.WARMUP_BATCH_SIZE,
                });

            if (error) {
                console.error('Failed to get cache warming recipes:', error);
                return result;
            }

            // Cache recipes that aren't already cached
            for (const recipe of recipes || []) {
                try {
                    const cacheKey = this.generateRecipeCacheKey(recipe.recipe_id);

                    if (this.metadata.has(cacheKey)) {
                        result.skipped++;
                        continue;
                    }

                    // Fetch full recipe data
                    const { data: fullRecipe } = await supabase
                        .from('daily_recipes')
                        .select('*')
                        .eq('id', recipe.recipe_id)
                        .single();

                    if (fullRecipe) {
                        const recipeEntry: RecipeCacheEntry = {
                            id: fullRecipe.id,
                            name: fullRecipe.recipe_name,
                            data: fullRecipe,
                            imageUrl: fullRecipe.image_url,
                            tags: fullRecipe.tags || [],
                            lastModified: new Date(fullRecipe.updated_at || fullRecipe.created_at).getTime(),
                            accessFrequency: recipe.access_count || 0,
                            isFavorite: fullRecipe.is_favorite || false,
                        };

                        await this.cacheRecipe(recipeEntry, recipe.cache_priority || 7);
                        result.warmed++;
                    } else {
                        result.errors++;
                    }
                } catch (error) {
                    console.error(`Failed to warm cache for recipe ${recipe.recipe_id}:`, error);
                    result.errors++;
                }
            }

            // Also warm cache with recent favorites
            await this.warmFavoriteRecipes();

        } catch (error) {
            console.error('Failed to warm cache:', error);
            result.errors++;
        }

        return result;
    }

    /**
     * Warm cache with user's favorite recipes
     */
    private async warmFavoriteRecipes(): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: favorites } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_favorite', true)
                .order('created_at', { ascending: false })
                .limit(5);

            for (const recipe of favorites || []) {
                const cacheKey = this.generateRecipeCacheKey(recipe.id);

                if (!this.metadata.has(cacheKey)) {
                    const recipeEntry: RecipeCacheEntry = {
                        id: recipe.id,
                        name: recipe.recipe_name,
                        data: recipe,
                        imageUrl: recipe.image_url,
                        tags: recipe.tags || [],
                        lastModified: new Date(recipe.updated_at || recipe.created_at).getTime(),
                        isFavorite: true,
                    };

                    await this.cacheRecipe(recipeEntry, 9); // High priority for favorites
                }
            }
        } catch (error) {
            console.error('Failed to warm favorite recipes cache:', error);
        }
    }

    /**
     * Cache chat session data
     */
    async cacheChatSession(sessionId: string, messages: any[]): Promise<void> {
        await this.ensureInitialized();

        const cacheKey = this.generateChatCacheKey(sessionId);
        const chatData: ChatCacheEntry = {
            sessionId,
            messages,
            lastActivity: Date.now(),
            messageCount: messages.length,
        };

        const chatDataStr = JSON.stringify(chatData);
        const size = this.estimateDataSize(chatDataStr);

        await this.ensureCacheSpace(size);

        try {
            await AsyncStorage.setItem(cacheKey, chatDataStr);

            const cacheMetadata: CacheMetadata = {
                key: cacheKey,
                size,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 1,
                expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days for chat
                type: 'data',
                priority: 6,
            };

            this.metadata.set(cacheKey, cacheMetadata);
            this.stats.totalSize += size;
            this.stats.totalItems += 1;

            await this.saveMetadata();
            await this.saveStats();
        } catch (error) {
            console.error('Failed to cache chat session:', error);
            throw error;
        }
    }

    /**
     * Retrieve cached chat session
     */
    async getCachedChatSession(sessionId: string): Promise<ChatCacheEntry | null> {
        await this.ensureInitialized();

        const cacheKey = this.generateChatCacheKey(sessionId);
        const metadata = this.metadata.get(cacheKey);

        if (!metadata || Date.now() > metadata.expiresAt) {
            if (metadata) {
                await this.removeCacheEntry(cacheKey);
            }
            this.stats.missCount++;
            return null;
        }

        try {
            const chatData = await AsyncStorage.getItem(cacheKey);

            if (chatData) {
                metadata.lastAccessed = Date.now();
                metadata.accessCount++;
                this.metadata.set(cacheKey, metadata);
                this.stats.hitCount++;

                return JSON.parse(chatData);
            } else {
                await this.removeCacheEntry(cacheKey);
                this.stats.missCount++;
                return null;
            }
        } catch (error) {
            console.error('Failed to retrieve cached chat session:', error);
            this.stats.missCount++;
            return null;
        }
    }

    /**
     * Add item to sync queue for background synchronization
     */
    async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
        const syncItem: SyncQueueItem = {
            ...item,
            id: this.generateSyncId(),
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.syncQueue.push(syncItem);
        await this.saveSyncQueue();

        // Start sync timer if not already running
        this.startSyncTimer();
    }

    /**
     * Process sync queue
     */
    async processSyncQueue(): Promise<{ processed: number; failed: number }> {
        const result = { processed: 0, failed: 0 };

        if (this.syncQueue.length === 0) {
            return result;
        }

        const itemsToProcess = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of itemsToProcess) {
            try {
                await this.processSyncItem(item);
                result.processed++;
            } catch (error) {
                console.error(`Failed to sync item ${item.id}:`, error);

                // Retry logic
                if (item.retryCount < 3) {
                    item.retryCount++;
                    item.timestamp = Date.now();
                    this.syncQueue.push(item);
                } else {
                    result.failed++;
                }
            }
        }

        await this.saveSyncQueue();
        return result;
    }

    /**
     * Get cache statistics with detailed breakdown
     */
    getCacheStats(): CacheStats & {
        hitRate: number;
        breakdown: { [key: string]: number };
        syncQueueSize: number;
    } {
        const totalRequests = this.stats.hitCount + this.stats.missCount;
        const hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

        // Calculate breakdown by cache type
        const breakdown: { [key: string]: number } = {};
        const metadataValues = Array.from(this.metadata.values());
        for (const metadata of metadataValues) {
            breakdown[metadata.type] = (breakdown[metadata.type] || 0) + 1;
        }

        return {
            ...this.stats,
            hitRate,
            breakdown,
            syncQueueSize: this.syncQueue.length,
        };
    }

    /**
     * Get frequently accessed recipes for intelligent caching
     */
    async getFrequentlyAccessedRecipes(limit: number = 10): Promise<RecipeCacheEntry[]> {
        await this.ensureInitialized();

        const recipeEntries: Array<{ entry: RecipeCacheEntry; metadata: CacheMetadata }> = [];
        const metadataEntries = Array.from(this.metadata.entries());

        for (const [key, metadata] of metadataEntries) {
            if (metadata.type === 'recipe') {
                try {
                    const recipeData = await AsyncStorage.getItem(key);
                    if (recipeData) {
                        const recipe: RecipeCacheEntry = JSON.parse(recipeData);
                        recipeEntries.push({ entry: recipe, metadata });
                    }
                } catch (error) {
                    console.error(`Failed to load recipe from cache: ${key}`, error);
                }
            }
        }

        // Sort by access count and priority
        recipeEntries.sort((a, b) => {
            const scoreA = a.metadata.accessCount * a.metadata.priority;
            const scoreB = b.metadata.accessCount * b.metadata.priority;
            return scoreB - scoreA;
        });

        return recipeEntries.slice(0, limit).map(item => item.entry);
    }

    /**
     * Clear all cache data
     */
    async clearCache(): Promise<void> {
        await this.ensureInitialized();

        try {
            // Remove all cached items
            const keys = Array.from(this.metadata.keys());
            await AsyncStorage.multiRemove(keys);

            // Clear metadata and stats
            this.metadata.clear();
            this.stats = {
                totalSize: 0,
                totalItems: 0,
                lastCleanup: Date.now(),
                hitCount: 0,
                missCount: 0,
            };

            await this.saveMetadata();
            await this.saveStats();
        } catch (error) {
            console.error('Failed to clear cache:', error);
            throw error;
        }
    }

    /**
     * Perform cache cleanup
     */
    async performCleanup(): Promise<number> {
        await this.ensureInitialized();

        const now = Date.now();
        let removedCount = 0;
        let freedSize = 0;

        // Remove expired items
        const expiredKeys: string[] = [];
        const metadataEntries = Array.from(this.metadata.entries());
        for (const [key, metadata] of metadataEntries) {
            if (now > metadata.expiresAt) {
                expiredKeys.push(key);
            }
        }

        // Remove expired items
        if (expiredKeys.length > 0) {
            await AsyncStorage.multiRemove(expiredKeys);

            for (const key of expiredKeys) {
                const metadata = this.metadata.get(key);
                if (metadata) {
                    freedSize += metadata.size;
                    removedCount++;
                }
                this.metadata.delete(key);
            }
        }

        // If still over threshold, remove least recently used items
        const maxSize = CACHE_CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024;
        if (this.stats.totalSize > maxSize * CACHE_CONFIG.CLEANUP_THRESHOLD) {
            const sortedEntries = Array.from(this.metadata.entries())
                .sort(([, a], [, b]) => {
                    // Sort by priority (desc) then by last accessed (asc)
                    if (a.priority !== b.priority) {
                        return b.priority - a.priority;
                    }
                    return a.lastAccessed - b.lastAccessed;
                });

            const targetSize = maxSize * 0.7; // Clean to 70% of max size
            let currentSize = this.stats.totalSize - freedSize;

            for (const [key, metadata] of sortedEntries) {
                if (currentSize <= targetSize) break;

                await AsyncStorage.removeItem(key);
                this.metadata.delete(key);
                currentSize -= metadata.size;
                freedSize += metadata.size;
                removedCount++;
            }
        }

        // Update stats
        this.stats.totalSize -= freedSize;
        this.stats.totalItems -= removedCount;
        this.stats.lastCleanup = now;

        await this.saveMetadata();
        await this.saveStats();

        return removedCount;
    }

    // Private helper methods

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    private generateImageCacheKey(url: string): string {
        const hash = this.simpleHash(url);
        return `${CACHE_CONFIG.IMAGE_CACHE_PREFIX}${hash}`;
    }

    private generateRecipeCacheKey(recipeId: string): string {
        return `${CACHE_CONFIG.RECIPE_CACHE_PREFIX}${recipeId}`;
    }

    private generateChatCacheKey(sessionId: string): string {
        return `${CACHE_CONFIG.CHAT_CACHE_PREFIX}${sessionId}`;
    }

    private generateSyncId(): string {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private estimateDataSize(data: string): number {
        // Rough estimate: 1 character ≈ 1 byte for ASCII, 2-4 bytes for Unicode
        return data.length * 2;
    }

    private async ensureCacheSpace(requiredSize: number): Promise<void> {
        const maxSize = CACHE_CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024;

        if (this.stats.totalSize + requiredSize > maxSize) {
            await this.performCleanup();
        }
    }

    private async removeCacheEntry(key: string): Promise<void> {
        const metadata = this.metadata.get(key);
        if (metadata) {
            await AsyncStorage.removeItem(key);
            this.metadata.delete(key);
            this.stats.totalSize -= metadata.size;
            this.stats.totalItems -= 1;
        }
    }

    private async loadMetadata(): Promise<void> {
        try {
            const metadataJson = await AsyncStorage.getItem(CACHE_CONFIG.METADATA_KEY);
            if (metadataJson) {
                const metadataArray: [string, CacheMetadata][] = JSON.parse(metadataJson);
                this.metadata = new Map(metadataArray);
            }
        } catch (error) {
            console.error('Failed to load cache metadata:', error);
            this.metadata.clear();
        }
    }

    private async saveMetadata(): Promise<void> {
        try {
            const metadataArray = Array.from(this.metadata.entries());
            await AsyncStorage.setItem(CACHE_CONFIG.METADATA_KEY, JSON.stringify(metadataArray));
        } catch (error) {
            console.error('Failed to save cache metadata:', error);
        }
    }

    private async loadStats(): Promise<void> {
        try {
            const statsJson = await AsyncStorage.getItem(CACHE_CONFIG.STATS_KEY);
            if (statsJson) {
                this.stats = JSON.parse(statsJson);
            }
        } catch (error) {
            console.error('Failed to load cache stats:', error);
        }
    }

    private async saveStats(): Promise<void> {
        try {
            await AsyncStorage.setItem(CACHE_CONFIG.STATS_KEY, JSON.stringify(this.stats));
        } catch (error) {
            console.error('Failed to save cache stats:', error);
        }
    }

    private async performMaintenanceIfNeeded(): Promise<void> {
        const now = Date.now();
        const daysSinceLastCleanup = (now - this.stats.lastCleanup) / (24 * 60 * 60 * 1000);

        // Perform cleanup if it's been more than 7 days
        if (daysSinceLastCleanup > 7) {
            await this.performCleanup();
        }
    }

    private async storeImageMetadataInSupabase(
        url: string,
        cacheKey: string,
        metadata: Partial<ImageCacheEntry>
    ): Promise<void> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from('image_cache_metadata')
                .upsert({
                    user_id: user.id,
                    image_url: url,
                    local_path: cacheKey,
                    cache_key: cacheKey,
                    source: metadata.source || 'placeholder',
                    attribution: metadata.attribution,
                    width: metadata.width,
                    height: metadata.height,
                    mime_type: metadata.mimeType,
                    file_size: this.metadata.get(cacheKey)?.size || 0,
                });
        } catch (error) {
            console.error('Failed to store image metadata in Supabase:', error);
        }
    }

    private async updateImageCacheAccess(cacheKey: string): Promise<void> {
        try {
            await supabase.rpc('update_image_cache_access', {
                p_cache_key: cacheKey,
            });
        } catch (error) {
            console.error('Failed to update image cache access:', error);
        }
    }

    private async saveSyncQueue(): Promise<void> {
        try {
            await AsyncStorage.setItem(CACHE_CONFIG.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('Failed to save sync queue:', error);
        }
    }

    private async loadSyncQueue(): Promise<void> {
        try {
            const queueJson = await AsyncStorage.getItem(CACHE_CONFIG.SYNC_QUEUE_KEY);
            if (queueJson) {
                this.syncQueue = JSON.parse(queueJson);
            }
        } catch (error) {
            console.error('Failed to load sync queue:', error);
            this.syncQueue = [];
        }
    }

    private startSyncTimer(): void {
        if (this.syncTimer) return;

        this.syncTimer = setInterval(async () => {
            try {
                await this.processSyncQueue();
            } catch (error) {
                console.error('Sync timer error:', error);
            }
        }, CACHE_CONFIG.SYNC_INTERVAL_MS);
    }

    private stopSyncTimer(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    private async processSyncItem(item: SyncQueueItem): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        switch (item.type) {
            case 'recipe':
                await this.syncRecipeItem(item, user.id);
                break;
            case 'image':
                await this.syncImageItem(item, user.id);
                break;
            case 'chat':
                await this.syncChatItem(item, user.id);
                break;
            default:
                throw new Error(`Unknown sync item type: ${item.type}`);
        }
    }

    private async syncRecipeItem(item: SyncQueueItem, userId: string): Promise<void> {
        switch (item.action) {
            case 'create':
            case 'update':
                await supabase.rpc('update_recipe_cache_stats', {
                    p_user_id: userId,
                    p_recipe_id: item.data.recipeId,
                    p_access_count: item.data.accessCount || 1,
                    p_last_accessed: new Date(item.data.lastAccessed || Date.now()).toISOString(),
                });
                break;
            case 'delete':
                // Handle recipe deletion if needed
                break;
        }
    }

    private async syncImageItem(item: SyncQueueItem, userId: string): Promise<void> {
        switch (item.action) {
            case 'create':
            case 'update':
                await supabase
                    .from('image_cache_metadata')
                    .upsert({
                        user_id: userId,
                        image_url: item.data.imageUrl,
                        cache_key: item.data.cacheKey,
                        local_path: item.data.localPath,
                        source: item.data.source,
                        attribution: item.data.attribution,
                        file_size: item.data.fileSize,
                        last_accessed: new Date().toISOString(),
                    });
                break;
            case 'delete':
                await supabase
                    .from('image_cache_metadata')
                    .delete()
                    .eq('cache_key', item.data.cacheKey);
                break;
        }
    }

    private async syncChatItem(item: SyncQueueItem, userId: string): Promise<void> {
        switch (item.action) {
            case 'create':
            case 'update':
                await supabase.rpc('update_chat_cache_stats', {
                    p_user_id: userId,
                    p_session_id: item.data.sessionId,
                    p_message_count: item.data.messageCount,
                    p_last_activity: new Date(item.data.lastActivity).toISOString(),
                });
                break;
            case 'delete':
                // Handle chat deletion if needed
                break;
        }
    }

    /**
     * Initialize with enhanced sync queue loading
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Load existing metadata, stats, and sync queue
            await Promise.all([
                this.loadMetadata(),
                this.loadStats(),
                this.loadSyncQueue(),
            ]);

            // Perform cleanup if needed
            await this.performMaintenanceIfNeeded();

            // Start sync timer
            this.startSyncTimer();

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize cache service:', error);
            // Initialize with empty state if loading fails
            this.metadata.clear();
            this.syncQueue = [];
            this.stats = {
                totalSize: 0,
                totalItems: 0,
                lastCleanup: Date.now(),
                hitCount: 0,
                missCount: 0,
            };
            this.initialized = true;
        }
    }

    /**
     * Cleanup method to stop timers
     */
    async cleanup(): Promise<void> {
        this.stopSyncTimer();
        await this.processSyncQueue(); // Process remaining items
    }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export types for use in other modules
export type {
    CacheMetadata,
    CacheStats,
    ImageCacheEntry,
    RecipeCacheEntry,
    ChatCacheEntry,
    SyncQueueItem,
};