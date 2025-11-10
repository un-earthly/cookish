import { supabase } from '@/lib/supabase';
import {
    AIRouterConfig,
    RecipeRequest,
    Recipe,
    UserPreferences,
    SubscriptionTier,
    ApiProvider
} from '@/types/recipe';
import {
    generateRecipe,
    generateRecipeWithOpenAI,
    generateRecipeWithGemini
} from '@/services/recipeGenerator';
// Network connectivity will be checked via a simple fetch test for now
// import NetInfo from '@react-native-community/netinfo';

export class AIRouterService {
    private static instance: AIRouterService;
    private config: AIRouterConfig | null = null;
    private userPreferences: UserPreferences | null = null;

    private constructor() { }

    static getInstance(): AIRouterService {
        if (!AIRouterService.instance) {
            AIRouterService.instance = new AIRouterService();
        }
        return AIRouterService.instance;
    }

    /**
     * Initialize the AI router with current user configuration
     */
    async initialize(): Promise<void> {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            // Load user preferences
            const { data: preferences, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) throw error;

            this.userPreferences = preferences;

            // Check network connectivity with simple test
            const isOnline = await this.checkNetworkConnectivity();

            // Check if local model is ready (placeholder for now)
            const localModelReady = await this.checkLocalModelStatus();

            // Build configuration
            this.config = {
                subscriptionTier: preferences?.subscription_tier || 'free',
                isOnline: isOnline || false,
                localModelReady,
                preferredModel: preferences?.preferred_ai_model
            };

        } catch (error) {
            console.error('Failed to initialize AI router:', error);
            // Fallback configuration
            this.config = {
                subscriptionTier: 'free',
                isOnline: false,
                localModelReady: false
            };
        }
    }

    /**
     * Get current router configuration
     */
    getConfig(): AIRouterConfig | null {
        return this.config;
    }

    /**
     * Route recipe generation request to appropriate AI service
     */
    async generateRecipe(request: RecipeRequest): Promise<Partial<Recipe>> {
        if (!this.config) {
            await this.initialize();
        }

        if (!this.config) {
            throw new Error('AI router not properly initialized');
        }

        // Determine which AI service to use based on configuration
        const aiService = this.determineAIService();

        try {
            let recipeData: Partial<Recipe>;

            switch (aiService) {
                case 'cloud_premium':
                    recipeData = await this.generateWithCloudPremium(request);
                    break;
                case 'cloud_basic':
                    recipeData = await this.generateWithCloudBasic(request);
                    break;
                case 'local':
                    recipeData = await this.generateWithLocal(request);
                    break;
                default:
                    throw new Error('No available AI service');
            }

            // Add metadata about how recipe was generated
            recipeData.created_via = 'chat';
            recipeData.ai_model_used = this.getModelUsed(aiService);
            recipeData.chat_session_id = request.sessionId;

            return recipeData;

        } catch (error) {
            console.error('Recipe generation failed:', error);

            // Try fallback if primary method fails
            if (aiService !== 'local' && this.config.localModelReady) {
                console.log('Falling back to local AI');
                const fallbackData = await this.generateWithLocal(request);
                fallbackData.created_via = 'chat';
                fallbackData.ai_model_used = 'local_fallback';
                fallbackData.chat_session_id = request.sessionId;
                return fallbackData;
            }

            throw error;
        }
    }

    /**
     * Determine which AI service to use based on current configuration
     */
    private determineAIService(): 'cloud_premium' | 'cloud_basic' | 'local' {
        if (!this.config) {
            return 'local';
        }

        const { subscriptionTier, isOnline, localModelReady } = this.config;

        // Premium users get cloud AI when online
        if (subscriptionTier === 'premium' && isOnline) {
            return 'cloud_premium';
        }

        // Free users get basic cloud AI when online
        if (subscriptionTier === 'free' && isOnline) {
            return 'cloud_basic';
        }

        // Offline or no internet - use local if available
        if (localModelReady) {
            return 'local';
        }

        // Last resort - try basic cloud even if connection is poor
        if (isOnline) {
            return 'cloud_basic';
        }

        throw new Error('No AI service available - please check internet connection or download local model');
    }

    /**
     * Generate recipe using premium cloud AI (Claude)
     */
    private async generateWithCloudPremium(request: RecipeRequest): Promise<Partial<Recipe>> {
        if (!this.userPreferences?.api_key) {
            throw new Error('API key not configured');
        }

        // Import the enhanced recipe generation functions
        const { generateRecipeFromPrompt } = await import('@/services/recipeGenerator');

        // Build user preferences for enhanced generation
        const userPrefs = {
            dietaryRestrictions: this.userPreferences.dietary_restrictions || [],
            cookingSkillLevel: this.userPreferences.cooking_skill_level || 'beginner',
            preferredCuisines: this.userPreferences.preferred_cuisines || [],
            location: this.userPreferences.location || 'United States'
        };

        // Use Claude API with premium features
        return await generateRecipeFromPrompt(
            'claude',
            this.userPreferences.api_key,
            request.prompt,
            userPrefs,
            true // isPremium = true
        );
    }

    /**
     * Generate recipe using basic cloud AI (OpenAI/Gemini)
     */
    private async generateWithCloudBasic(request: RecipeRequest): Promise<Partial<Recipe>> {
        if (!this.userPreferences?.api_key) {
            throw new Error('API key not configured');
        }

        // For conversational requests, use the enhanced prompt system
        if (request.prompt) {
            const { generateRecipeFromPrompt } = await import('@/services/recipeGenerator');

            const userPrefs = {
                dietaryRestrictions: this.userPreferences.dietary_restrictions || [],
                cookingSkillLevel: this.userPreferences.cooking_skill_level || 'beginner',
                preferredCuisines: this.userPreferences.preferred_cuisines || [],
                location: this.userPreferences.location || 'United States'
            };

            return await generateRecipeFromPrompt(
                this.userPreferences.api_provider || 'openai',
                this.userPreferences.api_key,
                request.prompt,
                userPrefs,
                false // isPremium = false
            );
        }

        // Fallback to traditional generation for non-conversational requests
        const provider = this.userPreferences.api_provider || 'openai';
        const season = this.getCurrentSeason();
        const location = this.userPreferences.location || 'United States';

        return await generateRecipe(
            provider,
            this.userPreferences.api_key,
            'dinner',
            season,
            location,
            false // isPremium = false
        );
    }

    /**
     * Generate recipe using local AI model
     */
    private async generateWithLocal(request: RecipeRequest): Promise<Partial<Recipe>> {
        // Placeholder for local AI implementation
        // This will be implemented in task 4.3
        throw new Error('Local AI not yet implemented');
    }

    /**
     * Build enhanced prompt for premium AI features
     */
    private buildEnhancedPrompt(request: RecipeRequest): string {
        let prompt = `Create a recipe based on: ${request.prompt}`;

        if (request.dietaryRestrictions?.length) {
            prompt += `\nDietary restrictions: ${request.dietaryRestrictions.join(', ')}`;
        }

        if (request.preferredCuisine) {
            prompt += `\nPreferred cuisine: ${request.preferredCuisine}`;
        }

        if (request.cookingTime) {
            prompt += `\nCooking time preference: ${request.cookingTime}`;
        }

        if (request.difficulty) {
            prompt += `\nDifficulty level: ${request.difficulty}`;
        }

        if (request.servings) {
            prompt += `\nServings needed: ${request.servings}`;
        }

        // Add user skill level context
        if (this.userPreferences?.cooking_skill_level) {
            prompt += `\nUser cooking skill: ${this.userPreferences.cooking_skill_level}`;
        }

        return prompt;
    }

    /**
     * Check network connectivity with simple test
     */
    private async checkNetworkConnectivity(): Promise<boolean> {
        try {
            const response = await fetch('https://www.google.com', {
                method: 'HEAD'
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Check if local AI model is ready
     */
    private async checkLocalModelStatus(): Promise<boolean> {
        // Placeholder - will be implemented in task 4.1
        return false;
    }

    /**
     * Get current season for recipe generation
     */
    private getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'fall';
        return 'winter';
    }

    /**
     * Get the model name used for generation
     */
    private getModelUsed(service: 'cloud_premium' | 'cloud_basic' | 'local'): string {
        switch (service) {
            case 'cloud_premium':
                return 'claude-sonnet-4'; // Placeholder
            case 'cloud_basic':
                return this.userPreferences?.api_provider || 'openai';
            case 'local':
                return 'llama-3.2-1b';
            default:
                return 'unknown';
        }
    }

    /**
     * Update subscription tier
     */
    async updateSubscriptionTier(tier: SubscriptionTier): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabase
            .from('user_preferences')
            .update({
                subscription_tier: tier,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);

        if (error) throw error;

        // Update local config
        if (this.config) {
            this.config.subscriptionTier = tier;
        }

        if (this.userPreferences) {
            this.userPreferences.subscription_tier = tier;
        }
    }

    /**
     * Check if user has premium features
     */
    hasPremiumFeatures(): boolean {
        return this.config?.subscriptionTier === 'premium';
    }

    /**
     * Check if local AI is available
     */
    isLocalAIAvailable(): boolean {
        return this.config?.localModelReady || false;
    }

    /**
     * Check if online AI is available
     */
    isOnlineAIAvailable(): boolean {
        return this.config?.isOnline || false;
    }

    /**
     * Get available AI services
     */
    getAvailableServices(): string[] {
        const services: string[] = [];

        if (this.config?.isOnline) {
            if (this.config.subscriptionTier === 'premium') {
                services.push('Premium Cloud AI');
            }
            services.push('Basic Cloud AI');
        }

        if (this.config?.localModelReady) {
            services.push('Local AI');
        }

        return services;
    }

    /**
     * Refresh configuration (call when network status changes)
     */
    async refreshConfig(): Promise<void> {
        await this.initialize();
    }
    /**
     * Modify an existing recipe based on user feedback
     */
    async modifyRecipe(
        originalRecipe: Partial<Recipe>,
        modificationRequest: string,
        sessionId?: string
    ): Promise<Partial<Recipe>> {
        if (!this.config) {
            await this.initialize();
        }

        if (!this.config || !this.userPreferences?.api_key) {
            throw new Error('AI router not properly initialized or API key missing');
        }

        try {
            const { modifyRecipe } = await import('@/services/recipeGenerator');

            // Premium users get Claude for modifications, others use their configured provider
            const provider = this.config.subscriptionTier === 'premium' ? 'claude' :
                (this.userPreferences.api_provider || 'openai');

            const modifiedRecipe = await modifyRecipe(
                provider,
                this.userPreferences.api_key,
                originalRecipe,
                modificationRequest,
                this.config.subscriptionTier === 'premium'
            );

            // Add metadata
            modifiedRecipe.created_via = 'chat';
            modifiedRecipe.ai_model_used = provider;
            modifiedRecipe.chat_session_id = sessionId;

            return modifiedRecipe;

        } catch (error) {
            console.error('Recipe modification failed:', error);
            throw error;
        }
    }

    /**
     * Get available premium features based on subscription
     */
    getAvailablePremiumFeatures(): string[] {
        const features: string[] = [];

        if (this.hasPremiumFeatures()) {
            features.push(
                'Advanced nutritional analysis',
                'Recipe variations and substitutions',
                'Professional cooking tips',
                'Cultural context and pairing suggestions',
                'Complex recipe generation',
                'Recipe modification through chat',
                'Unlimited image generation'
            );
        } else {
            features.push(
                'Basic recipe generation',
                'Simple nutritional info',
                'Limited image fetching (50/hour)',
                'Basic cooking instructions'
            );
        }

        return features;
    }

    /**
     * Check if specific premium feature is available
     */
    hasFeature(feature: string): boolean {
        const premiumFeatures = [
            'recipe_variations',
            'cooking_tips',
            'detailed_nutrition',
            'recipe_modification',
            'unlimited_images',
            'complex_recipes'
        ];

        if (premiumFeatures.includes(feature)) {
            return this.hasPremiumFeatures();
        }

        return true; // Basic features are always available
    }
}
