import { supabase } from '@/lib/supabase';
import { AIRouterService } from '@/services/aiRouterService';
import { chatService } from '@/services/chatService';
import { imageService } from '@/services/imageService';
import { dietaryService } from '@/services/dietaryService';
import { variationService } from '@/services/variationService';
import { cacheService } from '@/services/cacheService';
import { voiceService } from '@/services/voiceService';
import { errorHandlingService } from '@/services/errorHandlingService';
import { UserPreferences, Recipe, ChatSession } from '@/types/recipe';

/**
 * Central service for managing application-wide integration and state
 */
export class AppIntegrationService {
    private static instance: AppIntegrationService;
    private aiRouter: AIRouterService;
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    private constructor() {
        this.aiRouter = AIRouterService.getInstance();
    }

    static getInstance(): AppIntegrationService {
        if (!AppIntegrationService.instance) {
            AppIntegrationService.instance = new AppIntegrationService();
        }
        return AppIntegrationService.instance;
    }

    /**
     * Initialize all services and dependencies
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.performInitialization();
        await this.initializationPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            console.log('Initializing app integration services...');

            // Check authentication
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Initialize core services in order
            await this.initializeCoreServices();
            await this.initializeAIServices();
            await this.initializeUIServices();

            this.isInitialized = true;
            console.log('App integration services initialized successfully');

        } catch (error) {
            console.error('Failed to initialize app integration services:', error);
            this.initializationPromise = null;

            // Report initialization error
            await errorHandlingService.handleError(error as Error, {
                action: 'app_initialization'
            });

            throw error;
        }
    }

    /**
     * Initialize core services (cache, database, etc.)
     */
    private async initializeCoreServices(): Promise<void> {
        try {
            // Initialize cache service
            await cacheService.initialize();

            // Initialize dietary service (if it has initialize method)
            if ('initialize' in dietaryService && typeof dietaryService.initialize === 'function') {
                await dietaryService.initialize();
            }

            // Initialize image service (if it has initialize method)
            if ('initialize' in imageService && typeof imageService.initialize === 'function') {
                await imageService.initialize();
            }

        } catch (error) {
            console.error('Failed to initialize core services:', error);
            throw error;
        }
    }

    /**
     * Initialize AI-related services
     */
    private async initializeAIServices(): Promise<void> {
        try {
            // Initialize AI router
            await this.aiRouter.initialize();

            // Initialize voice service if supported
            const isVoiceSupported = await voiceService.isVoiceInputSupported();
            if (isVoiceSupported && 'initialize' in voiceService && typeof voiceService.initialize === 'function') {
                await voiceService.initialize();
            }

        } catch (error) {
            console.error('Failed to initialize AI services:', error);
            // Don't throw - AI services are not critical for basic functionality
        }
    }

    /**
     * Initialize UI-related services
     */
    private async initializeUIServices(): Promise<void> {
        try {
            // Initialize variation service (if it has initialize method)
            if ('initialize' in variationService && typeof variationService.initialize === 'function') {
                await variationService.initialize();
            }

        } catch (error) {
            console.error('Failed to initialize UI services:', error);
            // Don't throw - UI services can be initialized lazily
        }
    }

    /**
     * Get service health status
     */
    async getServiceHealth(): Promise<{
        overall: 'healthy' | 'degraded' | 'unhealthy';
        services: {
            database: 'healthy' | 'unhealthy';
            aiRouter: 'healthy' | 'degraded' | 'unhealthy';
            imageService: 'healthy' | 'degraded' | 'unhealthy';
            voiceService: 'healthy' | 'unavailable' | 'unhealthy';
            cacheService: 'healthy' | 'unhealthy';
        };
        capabilities: string[];
        limitations: string[];
    }> {
        const health = {
            overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
            services: {
                database: 'healthy' as 'healthy' | 'unhealthy',
                aiRouter: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
                imageService: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
                voiceService: 'healthy' as 'healthy' | 'unavailable' | 'unhealthy',
                cacheService: 'healthy' as 'healthy' | 'unhealthy',
            },
            capabilities: [] as string[],
            limitations: [] as string[]
        };

        try {
            // Check database connectivity
            const { error: dbError } = await supabase.from('user_preferences').select('id').limit(1);
            if (dbError) {
                health.services.database = 'unhealthy';
                health.limitations.push('Database connectivity issues');
            } else {
                health.capabilities.push('Recipe storage and sync');
            }

            // Check AI router status
            const aiConfig = this.aiRouter.getConfig();
            if (!aiConfig) {
                health.services.aiRouter = 'unhealthy';
                health.limitations.push('AI services not configured');
            } else if (!aiConfig.isOnline && !aiConfig.localModelReady) {
                health.services.aiRouter = 'degraded';
                health.limitations.push('Limited AI functionality (offline)');
            } else {
                health.capabilities.push('AI recipe generation');
                if (aiConfig.subscriptionTier === 'premium') {
                    health.capabilities.push('Premium AI features');
                }
            }

            // Check image service
            try {
                const imageStats = 'getServiceStatus' in imageService && typeof imageService.getServiceStatus === 'function'
                    ? await imageService.getServiceStatus()
                    : { isAvailable: true, rateLimitReached: false };

                if (!imageStats.isAvailable) {
                    health.services.imageService = 'unhealthy';
                    health.limitations.push('Image fetching unavailable');
                } else if (imageStats.rateLimitReached) {
                    health.services.imageService = 'degraded';
                    health.limitations.push('Image rate limit reached');
                } else {
                    health.capabilities.push('Recipe images');
                }
            } catch (error) {
                health.services.imageService = 'degraded';
                health.limitations.push('Image service status unknown');
            }

            // Check voice service
            const isVoiceSupported = await voiceService.isVoiceInputSupported();
            if (!isVoiceSupported) {
                health.services.voiceService = 'unavailable';
                health.limitations.push('Voice input not available');
            } else {
                health.capabilities.push('Voice recipe requests');
            }

            // Check cache service
            try {
                const cacheStats = 'getStats' in cacheService && typeof cacheService.getStats === 'function'
                    ? await cacheService.getStats()
                    : { errorRate: 0 };

                if (cacheStats.errorRate > 0.1) {
                    health.services.cacheService = 'unhealthy';
                    health.limitations.push('Cache performance issues');
                } else {
                    health.capabilities.push('Offline recipe access');
                }
            } catch (error) {
                health.services.cacheService = 'unhealthy';
                health.limitations.push('Cache service status unknown');
            }

            // Determine overall health
            const unhealthyServices = Object.values(health.services).filter(status => status === 'unhealthy').length;
            const degradedServices = Object.values(health.services).filter(status => status === 'degraded').length;

            if (unhealthyServices > 2) {
                health.overall = 'unhealthy';
            } else if (unhealthyServices > 0 || degradedServices > 1) {
                health.overall = 'degraded';
            }

        } catch (error) {
            console.error('Failed to check service health:', error);
            health.overall = 'unhealthy';
            health.limitations.push('Unable to determine service status');
        }

        return health;
    }

    /**
     * Create a new chat session with proper initialization
     */
    async createChatSession(): Promise<ChatSession> {
        await this.initialize();
        return await chatService.createSession();
    }

    /**
     * Generate recipe with full service integration
     */
    async generateRecipe(prompt: string, sessionId?: string): Promise<Recipe> {
        await this.initialize();

        // Use the integrated recipe generation pipeline
        const { generateChatRecipe } = await import('@/services/recipeService');
        return await generateChatRecipe(prompt, sessionId);
    }

    /**
     * Get user preferences with caching
     */
    async getUserPreferences(): Promise<UserPreferences | null> {
        await this.initialize();

        try {
            // Try cache first (if available)
            let cached = null;
            if ('get' in cacheService && typeof cacheService.get === 'function') {
                cached = await cacheService.get('user_preferences');
                if (cached) {
                    return cached;
                }
            }

            // Fetch from database
            const { getUserPreferences } = await import('@/services/recipeService');
            const preferences = await getUserPreferences();

            // Cache the result (if available)
            if (preferences && 'set' in cacheService && typeof cacheService.set === 'function') {
                await cacheService.set('user_preferences', preferences, 300); // 5 minutes
            }

            return preferences;

        } catch (error) {
            console.error('Failed to get user preferences:', error);
            return null;
        }
    }

    /**
     * Update user preferences with cache invalidation
     */
    async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
        await this.initialize();

        const { saveUserPreferences } = await import('@/services/recipeService');
        await saveUserPreferences(preferences);

        // Invalidate cache (if available)
        if ('delete' in cacheService && typeof cacheService.delete === 'function') {
            await cacheService.delete('user_preferences');
        }

        // Reinitialize AI router if API settings changed
        if (preferences.api_key || preferences.api_provider || preferences.subscription_tier) {
            await this.aiRouter.initialize();
        }
    }

    /**
     * Handle app state changes (foreground/background)
     */
    async handleAppStateChange(nextAppState: string): Promise<void> {
        if (nextAppState === 'background') {
            // Cleanup resources when app goes to background
            await this.cleanupBackgroundResources();
        } else if (nextAppState === 'active') {
            // Refresh services when app becomes active
            await this.refreshActiveServices();
        }
    }

    /**
     * Cleanup resources when app goes to background
     */
    private async cleanupBackgroundResources(): Promise<void> {
        try {
            // Stop any ongoing voice recording
            await voiceService.cleanup();

            // Cleanup cache if needed
            await cacheService.cleanup();

        } catch (error) {
            console.error('Failed to cleanup background resources:', error);
        }
    }

    /**
     * Refresh services when app becomes active
     */
    private async refreshActiveServices(): Promise<void> {
        try {
            // Refresh AI router configuration
            await this.aiRouter.refreshConfig();

            // Refresh image service rate limits (if available)
            if ('refreshRateLimits' in imageService && typeof imageService.refreshRateLimits === 'function') {
                await imageService.refreshRateLimits();
            }

        } catch (error) {
            console.error('Failed to refresh active services:', error);
        }
    }

    /**
     * Get available features based on current service status
     */
    async getAvailableFeatures(): Promise<{
        recipeGeneration: boolean;
        voiceInput: boolean;
        imageGeneration: boolean;
        recipeModification: boolean;
        offlineAccess: boolean;
        premiumFeatures: boolean;
    }> {
        const health = await this.getServiceHealth();
        const aiConfig = this.aiRouter.getConfig();

        return {
            recipeGeneration: health.services.aiRouter !== 'unhealthy',
            voiceInput: health.services.voiceService === 'healthy',
            imageGeneration: health.services.imageService !== 'unhealthy',
            recipeModification: health.services.aiRouter !== 'unhealthy',
            offlineAccess: health.services.cacheService === 'healthy',
            premiumFeatures: aiConfig?.subscriptionTier === 'premium' && health.services.aiRouter === 'healthy'
        };
    }

    /**
     * Handle network connectivity changes
     */
    async handleNetworkChange(isConnected: boolean): Promise<void> {
        try {
            if (isConnected) {
                // Network restored - reinitialize online services
                await this.aiRouter.refreshConfig();
                if ('refreshRateLimits' in imageService && typeof imageService.refreshRateLimits === 'function') {
                    await imageService.refreshRateLimits();
                }
            } else {
                // Network lost - prepare for offline mode
                console.log('Network lost - switching to offline mode');
            }
        } catch (error) {
            console.error('Failed to handle network change:', error);
        }
    }

    /**
     * Get service statistics for monitoring
     */
    async getServiceStats(): Promise<{
        chatSessions: number;
        recipesGenerated: number;
        cacheHitRate: number;
        imagesCached: number;
        voiceRequestsProcessed: number;
        errorRate: number;
    }> {
        try {
            const [chatStats, cacheStats, imageStats] = await Promise.all([
                chatService.getChatStats(),
                'getStats' in cacheService && typeof cacheService.getStats === 'function'
                    ? cacheService.getStats()
                    : Promise.resolve({ hitRate: 0, errorRate: 0 }),
                'getCacheStats' in imageService && typeof imageService.getCacheStats === 'function'
                    ? imageService.getCacheStats()
                    : Promise.resolve({ totalCached: 0 })
            ]);

            return {
                chatSessions: chatStats.totalSessions,
                recipesGenerated: chatStats.recipesGenerated,
                cacheHitRate: cacheStats.hitRate,
                imagesCached: 'totalCached' in imageStats ? imageStats.totalCached : imageStats.totalImages,
                voiceRequestsProcessed: 0, // TODO: Add voice service stats
                errorRate: cacheStats.errorRate
            };

        } catch (error) {
            console.error('Failed to get service stats:', error);
            return {
                chatSessions: 0,
                recipesGenerated: 0,
                cacheHitRate: 0,
                imagesCached: 0,
                voiceRequestsProcessed: 0,
                errorRate: 1
            };
        }
    }

    /**
     * Reset all services (for troubleshooting)
     */
    async resetServices(): Promise<void> {
        try {
            this.isInitialized = false;
            this.initializationPromise = null;

            // Clear caches (if available)
            if ('clear' in cacheService && typeof cacheService.clear === 'function') {
                await cacheService.clear();
            }

            // Reinitialize
            await this.initialize();

        } catch (error) {
            console.error('Failed to reset services:', error);
            throw error;
        }
    }

    /**
     * Check if services are initialized
     */
    isServicesInitialized(): boolean {
        return this.isInitialized;
    }
}

// Export singleton instance
export const appIntegrationService = AppIntegrationService.getInstance();