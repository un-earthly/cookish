import { errorHandlingService, ErrorRecoveryAction } from '@/services/errorHandlingService';
import { AIRouterService } from '@/services/aiRouterService';
import { chatService } from '@/services/chatService';
import { voiceService } from '@/services/voiceService';
import { imageService } from '@/services/imageService';

/**
 * Specialized error handler for AI-related operations
 * Provides context-aware error handling for recipe generation, chat, and AI services
 */
export class AIErrorHandler {
    private static instance: AIErrorHandler;
    private aiRouter: AIRouterService;

    private constructor() {
        this.aiRouter = AIRouterService.getInstance();
    }

    static getInstance(): AIErrorHandler {
        if (!AIErrorHandler.instance) {
            AIErrorHandler.instance = new AIErrorHandler();
        }
        return AIErrorHandler.instance;
    }

    /**
     * Handle recipe generation errors with intelligent fallback
     */
    async handleRecipeGenerationError(
        error: Error,
        context: {
            prompt?: string;
            sessionId?: string;
            retryCount?: number;
            originalProvider?: string;
        }
    ): Promise<{
        canRecover: boolean;
        fallbackAvailable: boolean;
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
        suggestedAction?: 'retry' | 'fallback' | 'manual';
    }> {
        const retryCount = context.retryCount || 0;
        const maxRetries = 2;

        // Analyze the specific error
        const errorAnalysis = await this.analyzeRecipeGenerationError(error, context);

        // Determine recovery options
        const canRecover = retryCount < maxRetries;
        const fallbackAvailable = await this.checkFallbackOptions(context.originalProvider);

        // Generate recovery actions
        const recoveryActions: ErrorRecoveryAction[] = [];

        if (canRecover && errorAnalysis.isRetryable) {
            recoveryActions.push({
                type: 'retry',
                label: 'Try Again',
                action: async () => {
                    if (context.prompt && context.sessionId) {
                        await chatService.processUserMessage(
                            context.sessionId,
                            context.prompt,
                            false
                        );
                    }
                }
            });
        }

        if (fallbackAvailable) {
            const fallbackProvider = await this.determineFallbackProvider(context.originalProvider);
            recoveryActions.push({
                type: 'fallback',
                label: `Switch to ${fallbackProvider}`,
                action: async () => {
                    await this.switchToFallbackProvider(fallbackProvider);
                    if (context.prompt && context.sessionId) {
                        await chatService.processUserMessage(
                            context.sessionId,
                            context.prompt,
                            false
                        );
                    }
                }
            });
        }

        // Add manual alternatives
        recoveryActions.push({
            type: 'fallback',
            label: 'Browse Recipe Library',
            action: async () => {
                const { router } = await import('expo-router');
                router.push('/(tabs)/history');
            }
        });

        recoveryActions.push({
            type: 'redirect',
            label: 'Check Settings',
            action: async () => {
                const { router } = await import('expo-router');
                router.push('/(tabs)/settings');
            }
        });

        // Determine suggested action
        let suggestedAction: 'retry' | 'fallback' | 'manual' = 'manual';
        if (canRecover && errorAnalysis.isRetryable) {
            suggestedAction = 'retry';
        } else if (fallbackAvailable) {
            suggestedAction = 'fallback';
        }

        return {
            canRecover,
            fallbackAvailable,
            userMessage: errorAnalysis.userMessage,
            recoveryActions,
            suggestedAction
        };
    }

    /**
     * Handle chat service errors with context preservation
     */
    async handleChatError(
        error: Error,
        context: {
            sessionId?: string;
            messageId?: string;
            conversationContext?: any;
            retryAction?: () => Promise<void>;
        }
    ): Promise<{
        canRecoverSession: boolean;
        shouldStartNewSession: boolean;
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
    }> {
        const errorMessage = error.message.toLowerCase();

        // Analyze chat-specific error patterns
        const canRecoverSession = !errorMessage.includes('session expired') &&
            !errorMessage.includes('invalid session') &&
            !errorMessage.includes('session not found');

        const shouldStartNewSession = errorMessage.includes('session') ||
            errorMessage.includes('context lost') ||
            errorMessage.includes('conversation');

        const recoveryActions: ErrorRecoveryAction[] = [];

        if (canRecoverSession && context.retryAction) {
            recoveryActions.push({
                type: 'retry',
                label: 'Retry Message',
                action: context.retryAction
            });
        }

        if (shouldStartNewSession) {
            recoveryActions.push({
                type: 'reset',
                label: 'Start New Conversation',
                action: async () => {
                    const newSession = await chatService.createSession();
                    chatService.setCurrentSession(newSession);
                }
            });
        }

        // Add context preservation option if possible
        if (context.conversationContext) {
            recoveryActions.push({
                type: 'fallback',
                label: 'Continue with Context',
                action: async () => {
                    const newSession = await chatService.createSession();
                    // Add context message to new session
                    await chatService.addMessage(
                        newSession.id,
                        'assistant',
                        'I\'ve started a new conversation. Feel free to continue where we left off.'
                    );
                }
            });
        }

        recoveryActions.push({
            type: 'fallback',
            label: 'Browse Previous Chats',
            action: async () => {
                const { router } = await import('expo-router');
                router.push('/(tabs)/history');
            }
        });

        const userMessage = this.generateChatErrorMessage(error, canRecoverSession);

        return {
            canRecoverSession,
            shouldStartNewSession,
            userMessage,
            recoveryActions
        };
    }

    /**
     * Handle voice input errors with graceful degradation
     */
    async handleVoiceInputError(
        error: Error,
        context: {
            isRecording?: boolean;
            hasTranscription?: boolean;
            retryAction?: () => Promise<void>;
        }
    ): Promise<{
        canRetryVoice: boolean;
        shouldFallbackToText: boolean;
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
    }> {
        const errorMessage = error.message.toLowerCase();

        const canRetryVoice = !errorMessage.includes('permission denied') &&
            !errorMessage.includes('not supported') &&
            !errorMessage.includes('unavailable');

        const shouldFallbackToText = true; // Always offer text fallback

        const recoveryActions: ErrorRecoveryAction[] = [];

        if (canRetryVoice) {
            recoveryActions.push({
                type: 'retry',
                label: 'Try Voice Again',
                action: async () => {
                    if (context.retryAction) {
                        await context.retryAction();
                    } else {
                        // Clean up and retry voice input
                        await voiceService.cleanup();
                        await voiceService.startRecording();
                    }
                }
            });
        }

        if (errorMessage.includes('permission')) {
            recoveryActions.push({
                type: 'redirect',
                label: 'Enable Microphone',
                action: async () => {
                    // This would open device settings in a real implementation
                    console.log('Opening device settings for microphone permissions');
                }
            });
        }

        recoveryActions.push({
            type: 'fallback',
            label: 'Use Text Input',
            action: () => {
                console.log('Switching to text input mode');
            }
        });

        const userMessage = this.generateVoiceErrorMessage(error, canRetryVoice);

        return {
            canRetryVoice,
            shouldFallbackToText,
            userMessage,
            recoveryActions
        };
    }

    /**
     * Handle image service errors with graceful degradation
     */
    async handleImageServiceError(
        error: Error,
        context: {
            recipeName?: string;
            imageSource?: string;
            retryAction?: () => Promise<void>;
        }
    ): Promise<{
        canRetryImage: boolean;
        shouldContinueWithoutImage: boolean;
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
    }> {
        const errorMessage = error.message.toLowerCase();

        const canRetryImage = !errorMessage.includes('rate limit') ||
            !errorMessage.includes('quota exceeded');

        const shouldContinueWithoutImage = true; // Always allow continuing without images

        const recoveryActions: ErrorRecoveryAction[] = [];

        if (canRetryImage && context.retryAction) {
            recoveryActions.push({
                type: 'retry',
                label: 'Retry Image Loading',
                action: context.retryAction
            });
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
            recoveryActions.push({
                type: 'fallback',
                label: 'Try Different Image Source',
                action: async () => {
                    // Switch to fallback image service
                    console.log('Switching to fallback image service');
                }
            });
        }

        recoveryActions.push({
            type: 'fallback',
            label: 'Continue Without Images',
            action: () => {
                console.log('Continuing recipe generation without images');
            }
        });

        if (errorMessage.includes('cache')) {
            recoveryActions.push({
                type: 'reset',
                label: 'Clear Image Cache',
                action: async () => {
                    await imageService.clearCache();
                }
            });
        }

        const userMessage = this.generateImageErrorMessage(error, canRetryImage);

        return {
            canRetryImage,
            shouldContinueWithoutImage,
            userMessage,
            recoveryActions
        };
    }

    /**
     * Handle subscription/premium feature errors
     */
    async handleSubscriptionError(
        error: Error,
        context: {
            featureName?: string;
            currentTier?: string;
            requiredTier?: string;
        }
    ): Promise<{
        canUpgrade: boolean;
        hasAlternative: boolean;
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
    }> {
        const canUpgrade = true; // Always allow upgrade option
        const hasAlternative = await this.checkFreeAlternatives(context.featureName);

        const recoveryActions: ErrorRecoveryAction[] = [];

        recoveryActions.push({
            type: 'redirect',
            label: 'Upgrade to Premium',
            action: async () => {
                const { router } = await import('expo-router');
                router.push('/(tabs)/settings');
            }
        });

        if (hasAlternative) {
            recoveryActions.push({
                type: 'fallback',
                label: 'Use Free Alternative',
                action: async () => {
                    await this.switchToFreeAlternative(context.featureName);
                }
            });
        }

        recoveryActions.push({
            type: 'fallback',
            label: 'Continue with Basic Features',
            action: async () => {
                const { router } = await import('expo-router');
                router.push('/(tabs)');
            }
        });

        const userMessage = this.generateSubscriptionErrorMessage(error, context);

        return {
            canUpgrade,
            hasAlternative,
            userMessage,
            recoveryActions
        };
    }

    /**
     * Analyze recipe generation error to determine retry strategy
     */
    private async analyzeRecipeGenerationError(
        error: Error,
        context: any
    ): Promise<{
        isRetryable: boolean;
        errorType: string;
        userMessage: string;
    }> {
        const message = error.message.toLowerCase();

        if (message.includes('rate limit') || message.includes('quota')) {
            return {
                isRetryable: false,
                errorType: 'rate_limit',
                userMessage: 'AI service rate limit reached. Please try using offline mode or wait a moment.'
            };
        }

        if (message.includes('api key') || message.includes('unauthorized')) {
            return {
                isRetryable: false,
                errorType: 'auth',
                userMessage: 'AI service authentication failed. Please check your API key in Settings.'
            };
        }

        if (message.includes('network') || message.includes('timeout')) {
            return {
                isRetryable: true,
                errorType: 'network',
                userMessage: 'Network connection issue. Please check your internet connection.'
            };
        }

        if (message.includes('invalid response') || message.includes('json')) {
            return {
                isRetryable: true,
                errorType: 'parsing',
                userMessage: 'AI service returned an unexpected response. Please try rephrasing your request.'
            };
        }

        return {
            isRetryable: true,
            errorType: 'unknown',
            userMessage: 'Recipe generation failed. Please try again or use a different approach.'
        };
    }

    /**
     * Check if fallback AI providers are available
     */
    private async checkFallbackOptions(currentProvider?: string): Promise<boolean> {
        const config = this.aiRouter.getConfig();
        if (!config) return false;

        // Check if local AI is available as fallback
        if (config.localModelReady && currentProvider !== 'local') {
            return true;
        }

        // Check if other cloud providers are available
        if (config.isOnline && currentProvider !== 'openai') {
            return true;
        }

        return false;
    }

    /**
     * Determine the best fallback provider
     */
    private async determineFallbackProvider(currentProvider?: string): Promise<string> {
        const config = this.aiRouter.getConfig();

        if (config?.localModelReady && currentProvider !== 'local') {
            return 'Local AI';
        }

        if (config?.isOnline) {
            if (currentProvider === 'openai') {
                return 'Gemini AI';
            } else {
                return 'OpenAI';
            }
        }

        return 'Alternative AI';
    }

    /**
     * Switch to fallback AI provider
     */
    private async switchToFallbackProvider(provider: string): Promise<void> {
        // This would implement the actual provider switching logic
        console.log(`Switching to fallback provider: ${provider}`);
        await this.aiRouter.refreshConfig();
    }

    /**
     * Generate user-friendly chat error message
     */
    private generateChatErrorMessage(error: Error, canRecover: boolean): string {
        const message = error.message.toLowerCase();

        if (message.includes('session')) {
            return canRecover
                ? 'Chat session had an issue. You can retry your message or start a new conversation.'
                : 'Chat session expired. Please start a new conversation to continue.';
        }

        if (message.includes('context')) {
            return 'Chat context was lost. Please provide more details in your next message.';
        }

        if (message.includes('modification') || message.includes('variation')) {
            return 'Recipe modification failed. Please try a simpler change or create a new recipe.';
        }

        return 'Chat service encountered an issue. Please try again or start a new conversation.';
    }

    /**
     * Generate user-friendly voice error message
     */
    private generateVoiceErrorMessage(error: Error, canRetry: boolean): string {
        const message = error.message.toLowerCase();

        if (message.includes('permission')) {
            return 'Microphone permission is required for voice input. Please enable it in your device settings.';
        }

        if (message.includes('not supported')) {
            return 'Voice input is not supported on this device. Please use text input instead.';
        }

        if (message.includes('transcription')) {
            return canRetry
                ? 'Voice transcription failed. Please try speaking more clearly or use text input.'
                : 'Voice transcription is not available. Please use text input.';
        }

        return canRetry
            ? 'Voice input had an issue. Please try again or use text input.'
            : 'Voice input is not available. Please use text input instead.';
    }

    /**
     * Generate user-friendly image error message
     */
    private generateImageErrorMessage(error: Error, canRetry: boolean): string {
        const message = error.message.toLowerCase();

        if (message.includes('rate limit') || message.includes('quota')) {
            return 'Image service rate limit reached. Images will be available again soon, but recipes will still work.';
        }

        if (message.includes('cache')) {
            return 'Image cache issue detected. Images may load slower than usual.';
        }

        return canRetry
            ? 'Image loading failed. You can retry or continue without images.'
            : 'Images are temporarily unavailable, but your recipes will still work perfectly.';
    }

    /**
     * Generate subscription error message
     */
    private generateSubscriptionErrorMessage(
        error: Error,
        context: { featureName?: string; currentTier?: string; requiredTier?: string }
    ): string {
        const featureName = context.featureName || 'this feature';
        const requiredTier = context.requiredTier || 'premium';

        return `${featureName} requires a ${requiredTier} subscription. You can upgrade to access advanced AI features or continue with the free features available.`;
    }

    /**
     * Check if free alternatives exist for premium features
     */
    private async checkFreeAlternatives(featureName?: string): Promise<boolean> {
        const freeAlternatives: Record<string, boolean> = {
            'advanced_ai': true, // Basic AI is available
            'unlimited_images': false, // Limited images only
            'recipe_variations': true, // Basic variations available
            'detailed_nutrition': false, // Basic nutrition only
            'cooking_tips': true, // Basic tips available
            'complex_recipes': true, // Simple recipes available
        };

        return freeAlternatives[featureName || ''] || true;
    }

    /**
     * Switch to free alternative for premium feature
     */
    private async switchToFreeAlternative(featureName?: string): Promise<void> {
        console.log(`Switching to free alternative for: ${featureName}`);
        // This would implement the actual switching logic
    }

    /**
     * Create comprehensive error context for AI operations
     */
    createAIErrorContext(
        operation: 'recipe_generation' | 'chat' | 'voice' | 'image' | 'subscription',
        additionalContext: Record<string, any> = {}
    ): Record<string, any> {
        const baseContext = {
            timestamp: new Date().toISOString(),
            operation,
            aiRouterConfig: this.aiRouter.getConfig(),
            ...additionalContext
        };

        return baseContext;
    }

    /**
     * Log AI-specific error for monitoring
     */
    async logAIError(
        error: Error,
        operation: string,
        context: Record<string, any>
    ): Promise<void> {
        const enhancedContext = {
            ...context,
            operation,
            aiSpecific: true,
            userAgent: 'AI Recipe App',
            timestamp: new Date().toISOString()
        };

        await errorHandlingService.handleError(error, enhancedContext);
    }
}

// Export singleton instance
export const aiErrorHandler = AIErrorHandler.getInstance();