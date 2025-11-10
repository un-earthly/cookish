import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ImageSearchParams,
    ImageResult,
    ImageSource
} from '@/types/recipe';
import { cacheService, ImageCacheEntry } from './cacheService';
import { syncService } from './syncService';

// Rate limiting configuration
const UNSPLASH_RATE_LIMIT = 50; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_KEY = 'unsplash_rate_limit';

interface RateLimitData {
    requests: number;
    windowStart: number;
}

export class UnsplashService {
    private accessKey: string;
    private baseUrl = 'https://api.unsplash.com';

    constructor() {
        this.accessKey = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || '';
        if (!this.accessKey) {
            console.warn('Unsplash access key not configured');
        }
    }

    /**
     * Search for recipe images with intelligent query optimization
     */
    async searchRecipeImage(params: ImageSearchParams): Promise<ImageResult | null> {
        if (!this.accessKey) {
            console.warn('Unsplash access key not available');
            return null;
        }

        // Check rate limit
        const canMakeRequest = await this.checkRateLimit();
        if (!canMakeRequest) {
            console.log('Unsplash rate limit exceeded');
            return null;
        }

        try {
            const searchQuery = this.buildSearchQuery(params);
            const url = `${this.baseUrl}/search/photos`;

            const response = await fetch(`${url}?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`, {
                headers: {
                    'Authorization': `Client-ID ${this.accessKey}`,
                    'Accept-Version': 'v1'
                }
            });

            if (!response.ok) {
                throw new Error(`Unsplash API error: ${response.status}`);
            }

            const data = await response.json();

            // Update rate limit counter
            await this.updateRateLimit();

            if (data.results && data.results.length > 0) {
                const photo = data.results[0];
                return {
                    url: photo.urls.regular,
                    source: 'unsplash',
                    attribution: `Photo by ${photo.user.name} on Unsplash`,
                    cached: false,
                    width: photo.width,
                    height: photo.height
                };
            }

            return null;

        } catch (error) {
            console.error('Unsplash search failed:', error);
            return null;
        }
    }

    /**
     * Build optimized search query for food photography
     */
    private buildSearchQuery(params: ImageSearchParams): string {
        const queryParts: string[] = [];

        // Primary search term - recipe name
        if (params.recipeName) {
            // Clean recipe name for better search results
            const cleanName = params.recipeName
                .toLowerCase()
                .replace(/recipe|dish|meal/gi, '')
                .trim();
            queryParts.push(cleanName);
        }

        // Add cuisine context
        if (params.cuisine) {
            queryParts.push(params.cuisine);
        }

        // Add main ingredients (limit to 2-3 most important)
        if (params.mainIngredients && params.mainIngredients.length > 0) {
            const topIngredients = params.mainIngredients
                .slice(0, 3)
                .filter(ingredient => ingredient.length > 2); // Filter out short words
            queryParts.push(...topIngredients);
        }

        // Add cooking method context
        if (params.cookingMethod) {
            queryParts.push(params.cookingMethod);
        }

        // Always add food context
        queryParts.push('food');

        // Join with spaces and limit length
        let query = queryParts.join(' ');

        // Limit query length for API
        if (query.length > 100) {
            query = query.substring(0, 97) + '...';
        }

        return query;
    }

    /**
     * Check if we can make a request within rate limits
     */
    private async checkRateLimit(): Promise<boolean> {
        try {
            const rateLimitData = await AsyncStorage.getItem(RATE_LIMIT_KEY);

            if (!rateLimitData) {
                return true; // No previous requests
            }

            const { requests, windowStart }: RateLimitData = JSON.parse(rateLimitData);
            const now = Date.now();

            // Check if we're in a new window
            if (now - windowStart > RATE_LIMIT_WINDOW) {
                return true; // New window, reset counter
            }

            // Check if we're under the limit
            return requests < UNSPLASH_RATE_LIMIT;

        } catch (error) {
            console.error('Error checking rate limit:', error);
            return true; // Allow request on error
        }
    }

    /**
     * Update rate limit counter after successful request
     */
    private async updateRateLimit(): Promise<void> {
        try {
            const now = Date.now();
            const rateLimitData = await AsyncStorage.getItem(RATE_LIMIT_KEY);

            let requests = 1;
            let windowStart = now;

            if (rateLimitData) {
                const existing: RateLimitData = JSON.parse(rateLimitData);

                // Check if we're in the same window
                if (now - existing.windowStart <= RATE_LIMIT_WINDOW) {
                    requests = existing.requests + 1;
                    windowStart = existing.windowStart;
                }
            }

            const newData: RateLimitData = { requests, windowStart };
            await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newData));

        } catch (error) {
            console.error('Error updating rate limit:', error);
        }
    }

    /**
     * Get current rate limit status
     */
    async getRateLimitStatus(): Promise<{ remaining: number; resetTime: Date }> {
        try {
            const rateLimitData = await AsyncStorage.getItem(RATE_LIMIT_KEY);

            if (!rateLimitData) {
                return {
                    remaining: UNSPLASH_RATE_LIMIT,
                    resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
                };
            }

            const { requests, windowStart }: RateLimitData = JSON.parse(rateLimitData);
            const now = Date.now();

            // Check if we're in a new window
            if (now - windowStart > RATE_LIMIT_WINDOW) {
                return {
                    remaining: UNSPLASH_RATE_LIMIT,
                    resetTime: new Date(now + RATE_LIMIT_WINDOW)
                };
            }

            return {
                remaining: Math.max(0, UNSPLASH_RATE_LIMIT - requests),
                resetTime: new Date(windowStart + RATE_LIMIT_WINDOW)
            };

        } catch (error) {
            console.error('Error getting rate limit status:', error);
            return {
                remaining: 0,
                resetTime: new Date(Date.now() + RATE_LIMIT_WINDOW)
            };
        }
    }
}

export class PexelsService {
    private apiKey: string;
    private baseUrl = 'https://api.pexels.com/v1';

    constructor() {
        this.apiKey = process.env.EXPO_PUBLIC_PEXELS_API_KEY || '';
        if (!this.apiKey) {
            console.warn('Pexels API key not configured');
        }
    }

    /**
     * Search for recipe images on Pexels (fallback service)
     */
    async searchRecipeImage(params: ImageSearchParams): Promise<ImageResult | null> {
        if (!this.apiKey) {
            console.warn('Pexels API key not available');
            return null;
        }

        try {
            const searchQuery = this.buildSearchQuery(params);
            const url = `${this.baseUrl}/search`;

            const response = await fetch(`${url}?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`, {
                headers: {
                    'Authorization': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Pexels API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.photos && data.photos.length > 0) {
                const photo = data.photos[0];
                return {
                    url: photo.src.large,
                    source: 'pexels',
                    attribution: `Photo by ${photo.photographer} on Pexels`,
                    cached: false,
                    width: photo.width,
                    height: photo.height
                };
            }

            return null;

        } catch (error) {
            console.error('Pexels search failed:', error);
            return null;
        }
    }

    /**
     * Build search query optimized for Pexels
     */
    private buildSearchQuery(params: ImageSearchParams): string {
        const queryParts: string[] = [];

        // Recipe name
        if (params.recipeName) {
            const cleanName = params.recipeName
                .toLowerCase()
                .replace(/recipe|dish|meal/gi, '')
                .trim();
            queryParts.push(cleanName);
        }

        // Main ingredients
        if (params.mainIngredients && params.mainIngredients.length > 0) {
            queryParts.push(params.mainIngredients[0]); // Just use the first ingredient
        }

        // Always add food context
        queryParts.push('food');

        return queryParts.join(' ');
    }
}

export class ImageService {
    private unsplashService: UnsplashService;
    private pexelsService: PexelsService;
    private cachePrefix = 'recipe_image_';

    constructor() {
        this.unsplashService = new UnsplashService();
        this.pexelsService = new PexelsService();
    }

    /**
     * Get recipe image with automatic fallback between services
     */
    async getRecipeImage(params: ImageSearchParams): Promise<ImageResult> {
        // Check new cache service first
        const cachedImage = await this.getCachedImageFromService(params);
        if (cachedImage) {
            return cachedImage;
        }

        // Check legacy cache for backward compatibility
        const legacyCachedImage = await this.getCachedImage(params);
        if (legacyCachedImage) {
            // Migrate to new cache service
            await this.migrateLegacyCache(params, legacyCachedImage);
            return legacyCachedImage;
        }

        // Try Unsplash first (higher quality)
        let result = await this.unsplashService.searchRecipeImage(params);

        // Fallback to Pexels if Unsplash fails or rate limited
        if (!result) {
            console.log('Falling back to Pexels for image search');
            result = await this.pexelsService.searchRecipeImage(params);
        }

        // If both services fail, return placeholder
        if (!result) {
            result = this.getPlaceholderImage(params);
        }

        // Cache the result using new cache service
        if (result.source !== 'placeholder') {
            await this.cacheImageWithService(params, result);
        }

        return result;
    }

    /**
     * Get cached image using new cache service
     */
    private async getCachedImageFromService(params: ImageSearchParams): Promise<ImageResult | null> {
        try {
            const imageUrl = this.generateImageUrl(params);
            const cachedImageData = await cacheService.getCachedImage(imageUrl);

            if (cachedImageData) {
                // Convert cached data back to ImageResult
                return {
                    url: imageUrl,
                    source: 'unsplash', // Will be overridden by actual source from metadata
                    attribution: 'Cached image',
                    cached: true,
                    width: 400,
                    height: 300
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting cached image from service:', error);
            return null;
        }
    }

    /**
     * Cache image using new cache service
     */
    private async cacheImageWithService(params: ImageSearchParams, result: ImageResult): Promise<void> {
        try {
            // Download the image data
            const response = await fetch(result.url);
            const imageBlob = await response.blob();
            const imageData = await this.blobToBase64(imageBlob);

            // Prepare cache metadata
            const metadata: Partial<ImageCacheEntry> = {
                url: result.url,
                source: result.source as any,
                attribution: result.attribution,
                width: result.width,
                height: result.height,
                mimeType: imageBlob.type,
            };

            // Cache with the service
            await cacheService.cacheImage(result.url, imageData, metadata);

            // Queue sync operation
            await syncService.queueOperation('image_cache', {
                imageUrl: result.url,
                source: result.source,
                attribution: result.attribution,
                fileSize: imageBlob.size,
            });

        } catch (error) {
            console.error('Error caching image with service:', error);
            // Fallback to legacy cache
            await this.cacheImage(params, result);
        }
    }

    /**
     * Migrate legacy cache to new cache service
     */
    private async migrateLegacyCache(params: ImageSearchParams, result: ImageResult): Promise<void> {
        try {
            // This is a simplified migration - in practice, you might want to
            // download the image again or convert existing cached data
            const metadata: Partial<ImageCacheEntry> = {
                url: result.url,
                source: result.source as any,
                attribution: result.attribution,
                width: result.width,
                height: result.height,
            };

            // For migration, we'll just store the URL as a reference
            await cacheService.cacheImage(result.url, result.url, metadata);

            // Remove from legacy cache
            const cacheKey = this.getCacheKey(params);
            await AsyncStorage.removeItem(cacheKey);

        } catch (error) {
            console.error('Error migrating legacy cache:', error);
        }
    }

    /**
     * Convert blob to base64 string
     */
    private async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Generate a consistent image URL for caching
     */
    private generateImageUrl(params: ImageSearchParams): string {
        // Create a deterministic URL based on search parameters
        const searchTerms = [
            params.recipeName,
            params.cuisine,
            ...(params.mainIngredients || [])
        ].filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-');

        return `cache://recipe-image/${searchTerms}`;
    }

    /**
     * Get cached image if available (legacy method for backward compatibility)
     */
    private async getCachedImage(params: ImageSearchParams): Promise<ImageResult | null> {
        try {
            const cacheKey = this.getCacheKey(params);
            const cachedData = await AsyncStorage.getItem(cacheKey);

            if (cachedData) {
                const result: ImageResult = JSON.parse(cachedData);
                result.cached = true;
                return result;
            }

            return null;
        } catch (error) {
            console.error('Error getting cached image:', error);
            return null;
        }
    }

    /**
     * Cache image result (legacy method for backward compatibility)
     */
    private async cacheImage(params: ImageSearchParams, result: ImageResult): Promise<void> {
        try {
            const cacheKey = this.getCacheKey(params);
            const cacheData = { ...result, cached: false }; // Don't store cached flag
            await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error caching image:', error);
        }
    }

    /**
     * Generate cache key from search parameters
     */
    private getCacheKey(params: ImageSearchParams): string {
        const keyParts = [
            this.cachePrefix,
            params.recipeName?.toLowerCase().replace(/\s+/g, '_'),
            params.cuisine?.toLowerCase(),
            params.mainIngredients?.slice(0, 2).join('_').toLowerCase()
        ].filter(Boolean);

        return keyParts.join('_');
    }

    /**
     * Get placeholder image when no real image is available
     */
    private getPlaceholderImage(params: ImageSearchParams): ImageResult {
        // You can customize placeholder images based on cuisine or ingredients
        const placeholderUrl = 'https://via.placeholder.com/400x300/f0f0f0/666666?text=Recipe+Image';

        return {
            url: placeholderUrl,
            source: 'placeholder',
            attribution: 'Placeholder image',
            cached: false,
            width: 400,
            height: 300
        };
    }

    /**
     * Clear image cache (both new and legacy)
     */
    async clearCache(): Promise<void> {
        try {
            // Clear new cache service
            await cacheService.clearCache();

            // Clear legacy cache for backward compatibility
            const keys = await AsyncStorage.getAllKeys();
            const imageCacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
            await AsyncStorage.multiRemove(imageCacheKeys);
        } catch (error) {
            console.error('Error clearing image cache:', error);
        }
    }

    /**
     * Get cache statistics (combined new and legacy)
     */
    async getCacheStats(): Promise<{ totalImages: number; cacheSize: string; hitRate: number }> {
        try {
            // Get stats from new cache service
            const newCacheStats = cacheService.getCacheStats();

            // Get legacy cache stats
            const keys = await AsyncStorage.getAllKeys();
            const imageCacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));

            let legacySize = 0;
            for (const key of imageCacheKeys) {
                const data = await AsyncStorage.getItem(key);
                if (data) {
                    legacySize += data.length;
                }
            }

            const totalSize = newCacheStats.totalSize + legacySize;
            const totalImages = newCacheStats.totalItems + imageCacheKeys.length;

            return {
                totalImages,
                cacheSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
                hitRate: newCacheStats.hitRate
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { totalImages: 0, cacheSize: '0 MB', hitRate: 0 };
        }
    }

    /**
     * Warm image cache for frequently accessed recipes
     */
    async warmImageCache(): Promise<number> {
        try {
            await cacheService.warmCache();
            return 1; // Return success indicator
        } catch (error) {
            console.error('Error warming image cache:', error);
            return 0;
        }
    }

    /**
     * Perform cache cleanup
     */
    async performCacheCleanup(): Promise<number> {
        try {
            const removedCount = await cacheService.performCleanup();
            console.log(`Cleaned up ${removedCount} cached images`);
            return removedCount;
        } catch (error) {
            console.error('Error performing cache cleanup:', error);
            return 0;
        }
    }

    /**
     * Get Unsplash rate limit status
     */
    async getUnsplashRateLimit(): Promise<{ remaining: number; resetTime: Date }> {
        return this.unsplashService.getRateLimitStatus();
    }
}

// Export singleton instance
export const imageService = new ImageService();