import { supabase } from '@/lib/supabase';

export interface ErrorReport {
    id: string;
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: string;
    userId?: string;
    context: {
        screen?: string;
        action?: string;
        userAgent: string;
        appVersion: string;
        platform: string;
    };
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    metadata?: Record<string, any>;
}

export interface ErrorRecoveryAction {
    type: 'retry' | 'fallback' | 'redirect' | 'reset' | 'ignore';
    label: string;
    action: () => Promise<void> | void;
}

/**
 * Centralized error handling and recovery service
 */
export class ErrorHandlingService {
    private static instance: ErrorHandlingService;
    private errorQueue: ErrorReport[] = [];
    private isReporting = false;

    private constructor() { }

    static getInstance(): ErrorHandlingService {
        if (!ErrorHandlingService.instance) {
            ErrorHandlingService.instance = new ErrorHandlingService();
        }
        return ErrorHandlingService.instance;
    }

    /**
     * Handle and categorize errors
     */
    async handleError(
        error: Error,
        context: {
            screen?: string;
            action?: string;
            componentStack?: string;
            userId?: string;
        } = {}
    ): Promise<{
        category: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
        shouldReport: boolean;
    }> {
        const category = this.categorizeError(error);
        const severity = this.determineSeverity(error, category);
        const userMessage = this.generateUserMessage(error, category);
        const recoveryActions = this.generateRecoveryActions(error, category, context);
        const shouldReport = this.shouldReportError(error, category, severity);

        // Create error report
        const errorReport: ErrorReport = {
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            message: error.message,
            stack: error.stack,
            componentStack: context.componentStack,
            timestamp: new Date().toISOString(),
            userId: context.userId,
            context: {
                screen: context.screen,
                action: context.action,
                userAgent: 'React Native App',
                appVersion: '1.0.0', // TODO: Get from app config
                platform: 'mobile'
            },
            severity,
            category,
            metadata: {
                errorName: error.name,
                errorConstructor: error.constructor.name
            }
        };

        // Report error if needed
        if (shouldReport) {
            await this.reportError(errorReport);
        }

        // Log error locally
        this.logError(errorReport);

        return {
            category,
            severity,
            userMessage,
            recoveryActions,
            shouldReport
        };
    }

    /**
     * Categorize error based on message and stack trace
     */
    private categorizeError(error: Error): string {
        const message = error.message.toLowerCase();
        const stack = error.stack?.toLowerCase() || '';

        // Network errors
        if (message.includes('network') || message.includes('fetch') ||
            message.includes('connection') || message.includes('timeout')) {
            return 'Network Error';
        }

        // Authentication errors
        if (message.includes('auth') || message.includes('permission') ||
            message.includes('unauthorized') || message.includes('token')) {
            return 'Authentication Error';
        }

        // API errors
        if (message.includes('api') || message.includes('server') ||
            stack.includes('supabase') || message.includes('400') ||
            message.includes('500') || message.includes('404')) {
            return 'API Error';
        }

        // AI Service errors (enhanced for AI processing)
        if (message.includes('recipe') || message.includes('generation') ||
            message.includes('ai') || message.includes('openai') ||
            message.includes('claude') || message.includes('gemini') ||
            message.includes('model') || message.includes('prompt') ||
            message.includes('completion') || message.includes('inference') ||
            stack.includes('aiRouter') || stack.includes('recipeGenerator') ||
            message.includes('rate limit') || message.includes('quota') ||
            message.includes('api key') || message.includes('invalid response') ||
            message.includes('json') || message.includes('parsing')) {
            return 'AI Service Error';
        }

        // Local AI errors (new category for offline AI)
        if (message.includes('local ai') || message.includes('llama') ||
            message.includes('model download') || message.includes('model loading') ||
            message.includes('inference') || message.includes('quantization') ||
            stack.includes('localAI') || message.includes('onnx') ||
            message.includes('model not found') || message.includes('model initialization')) {
            return 'Local AI Error';
        }

        // Voice input errors
        if (message.includes('voice') || message.includes('microphone') ||
            message.includes('recording') || message.includes('speech') ||
            message.includes('transcription') || message.includes('audio') ||
            stack.includes('voiceService') || message.includes('permission denied')) {
            return 'Voice Input Error';
        }

        // Image service errors
        if (message.includes('image') || message.includes('photo') ||
            message.includes('unsplash') || message.includes('pexels') ||
            stack.includes('imageService') || message.includes('image loading') ||
            message.includes('image cache') || message.includes('image download')) {
            return 'Image Service Error';
        }

        // Chat errors (enhanced for conversational AI)
        if (stack.includes('chat') || stack.includes('message') ||
            message.includes('conversation') || stack.includes('chatService') ||
            message.includes('session') || message.includes('context') ||
            message.includes('modification') || message.includes('variation')) {
            return 'Chat Error';
        }

        // Storage/Cache errors
        if (message.includes('storage') || message.includes('cache') ||
            message.includes('database') || message.includes('sqlite') ||
            stack.includes('cacheService') || message.includes('sync')) {
            return 'Storage Error';
        }

        // Subscription/Premium errors (new category)
        if (message.includes('subscription') || message.includes('premium') ||
            message.includes('tier') || message.includes('feature not available') ||
            message.includes('upgrade required') || stack.includes('subscription')) {
            return 'Subscription Error';
        }

        // UI/Component errors
        if (stack.includes('component') || stack.includes('render') ||
            message.includes('ui') || message.includes('view')) {
            return 'UI Error';
        }

        return 'Application Error';
    }

    /**
     * Determine error severity
     */
    private determineSeverity(error: Error, category: string): 'low' | 'medium' | 'high' | 'critical' {
        const message = error.message.toLowerCase();

        // Critical errors that break core functionality
        if (category === 'Authentication Error' ||
            message.includes('crash') ||
            message.includes('fatal') ||
            message.includes('cannot read property') ||
            message.includes('undefined is not a function')) {
            return 'critical';
        }

        // High severity errors that significantly impact user experience
        if (category === 'AI Service Error' ||
            category === 'API Error' ||
            message.includes('failed to') ||
            message.includes('error generating')) {
            return 'high';
        }

        // Medium severity errors that limit functionality
        if (category === 'Voice Input Error' ||
            category === 'Image Service Error' ||
            category === 'Storage Error') {
            return 'medium';
        }

        // Low severity errors that don't significantly impact functionality
        return 'low';
    }

    /**
     * Generate user-friendly error message
     */
    private generateUserMessage(error: Error, category: string): string {
        const message = error.message.toLowerCase();

        switch (category) {
            case 'Network Error':
                return 'Connection issue detected. Please check your internet connection and try again.';

            case 'Authentication Error':
                return 'Authentication problem. Please try logging out and back in.';

            case 'API Error':
                if (message.includes('rate limit') || message.includes('quota')) {
                    return 'API rate limit reached. Please wait a moment before trying again or check your subscription.';
                }
                if (message.includes('api key')) {
                    return 'API configuration issue. Please check your API key settings.';
                }
                return 'Service temporarily unavailable. Please check your API settings or try again later.';

            case 'AI Service Error':
                if (message.includes('rate limit') || message.includes('quota')) {
                    return 'AI service rate limit reached. Please wait a moment or try using offline mode.';
                }
                if (message.includes('api key')) {
                    return 'AI service not configured. Please add your API key in Settings.';
                }
                if (message.includes('invalid response') || message.includes('json')) {
                    return 'AI service returned an unexpected response. Please try rephrasing your request.';
                }
                if (message.includes('model')) {
                    return 'AI model is having issues. Please try a different request or switch to offline mode.';
                }
                return 'Recipe generation is having issues. Please check your settings or try a different request.';

            case 'Local AI Error':
                if (message.includes('model not found') || message.includes('model loading')) {
                    return 'Local AI model needs to be downloaded. Please go to Settings to download the offline model.';
                }
                if (message.includes('model download')) {
                    return 'Model download failed. Please check your internet connection and try again.';
                }
                if (message.includes('inference') || message.includes('initialization')) {
                    return 'Local AI is having trouble processing. Please restart the app or try cloud mode.';
                }
                return 'Offline AI is not available. Please download the model in Settings or use online mode.';

            case 'Voice Input Error':
                if (message.includes('permission')) {
                    return 'Microphone permission required. Please enable microphone access in your device settings.';
                }
                if (message.includes('transcription')) {
                    return 'Voice transcription failed. Please try speaking more clearly or use text input.';
                }
                return 'Voice input is having issues. Please check microphone permissions or try typing instead.';

            case 'Image Service Error':
                if (message.includes('rate limit') || message.includes('quota')) {
                    return 'Image service rate limit reached. Images will be available again soon.';
                }
                if (message.includes('cache')) {
                    return 'Image cache issue detected. Images may load slower than usual.';
                }
                return 'Images are temporarily unavailable. Recipes will still work without images.';

            case 'Chat Error':
                if (message.includes('session')) {
                    return 'Chat session expired. Please start a new conversation.';
                }
                if (message.includes('context')) {
                    return 'Chat context lost. Please provide more details in your next message.';
                }
                if (message.includes('modification') || message.includes('variation')) {
                    return 'Recipe modification failed. Please try a simpler change or create a new recipe.';
                }
                return 'Chat service is experiencing issues. Please try refreshing or starting a new conversation.';

            case 'Storage Error':
                if (message.includes('cache')) {
                    return 'Cache storage issue. Some features may be slower until resolved.';
                }
                if (message.includes('sync')) {
                    return 'Data sync issue detected. Your recipes are safe but may not sync until resolved.';
                }
                return 'Local storage issue detected. Some features may be limited until resolved.';

            case 'Subscription Error':
                if (message.includes('upgrade required')) {
                    return 'This feature requires a premium subscription. Please upgrade to access advanced AI features.';
                }
                if (message.includes('feature not available')) {
                    return 'This feature is not available in your current plan. Consider upgrading for more features.';
                }
                return 'Subscription issue detected. Please check your account status or contact support.';

            case 'UI Error':
                return 'Display issue encountered. Please try refreshing the screen.';

            default:
                return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
        }
    }

    /**
     * Generate recovery actions based on error type
     */
    private generateRecoveryActions(
        error: Error,
        category: string,
        context: any
    ): ErrorRecoveryAction[] {
        const actions: ErrorRecoveryAction[] = [];
        const message = error.message.toLowerCase();

        switch (category) {
            case 'Network Error':
                actions.push({
                    type: 'retry',
                    label: 'Retry Connection',
                    action: async () => {
                        if (context.retryAction) {
                            await context.retryAction();
                        }
                    }
                });
                actions.push({
                    type: 'fallback',
                    label: 'Use Offline Mode',
                    action: async () => {
                        const { AIRouterService } = await import('@/services/aiRouterService');
                        const aiRouter = AIRouterService.getInstance();
                        await aiRouter.refreshConfig();
                    }
                });
                break;

            case 'Authentication Error':
                actions.push({
                    type: 'redirect',
                    label: 'Re-login',
                    action: async () => {
                        const { router } = await import('expo-router');
                        router.replace('/(auth)/login');
                    }
                });
                actions.push({
                    type: 'retry',
                    label: 'Refresh Session',
                    action: async () => {
                        const { supabase } = await import('@/lib/supabase');
                        await supabase.auth.refreshSession();
                    }
                });
                break;

            case 'API Error':
                if (message.includes('rate limit') || message.includes('quota')) {
                    actions.push({
                        type: 'fallback',
                        label: 'Switch to Offline Mode',
                        action: async () => {
                            const { AIRouterService } = await import('@/services/aiRouterService');
                            const aiRouter = AIRouterService.getInstance();
                            await aiRouter.refreshConfig();
                        }
                    });
                    actions.push({
                        type: 'redirect',
                        label: 'Upgrade Subscription',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/settings');
                        }
                    });
                } else {
                    actions.push({
                        type: 'retry',
                        label: 'Try Again',
                        action: async () => {
                            if (context.retryAction) {
                                await context.retryAction();
                            }
                        }
                    });
                    actions.push({
                        type: 'redirect',
                        label: 'Check API Settings',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/settings');
                        }
                    });
                }
                break;

            case 'AI Service Error':
                if (message.includes('api key')) {
                    actions.push({
                        type: 'redirect',
                        label: 'Configure API Key',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/settings');
                        }
                    });
                } else if (message.includes('rate limit')) {
                    actions.push({
                        type: 'fallback',
                        label: 'Use Local AI',
                        action: async () => {
                            const { AIRouterService } = await import('@/services/aiRouterService');
                            const aiRouter = AIRouterService.getInstance();
                            await aiRouter.refreshConfig();
                        }
                    });
                    actions.push({
                        type: 'redirect',
                        label: 'Upgrade Plan',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/settings');
                        }
                    });
                } else {
                    actions.push({
                        type: 'retry',
                        label: 'Try Different Prompt',
                        action: async () => {
                            if (context.retryAction) {
                                await context.retryAction();
                            }
                        }
                    });
                    actions.push({
                        type: 'fallback',
                        label: 'Browse Existing Recipes',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/history');
                        }
                    });
                }
                break;

            case 'Local AI Error':
                if (message.includes('model not found') || message.includes('model loading')) {
                    actions.push({
                        type: 'redirect',
                        label: 'Download AI Model',
                        action: async () => {
                            const { router } = await import('expo-router');
                            router.push('/(tabs)/settings');
                        }
                    });
                    actions.push({
                        type: 'fallback',
                        label: 'Use Cloud AI',
                        action: async () => {
                            const { AIRouterService } = await import('@/services/aiRouterService');
                            const aiRouter = AIRouterService.getInstance();
                            await aiRouter.refreshConfig();
                        }
                    });
                } else {
                    actions.push({
                        type: 'retry',
                        label: 'Restart Local AI',
                        action: async () => {
                            // This would restart the local AI service
                            console.log('Restarting local AI service');
                        }
                    });
                    actions.push({
                        type: 'fallback',
                        label: 'Switch to Cloud AI',
                        action: async () => {
                            const { AIRouterService } = await import('@/services/aiRouterService');
                            const aiRouter = AIRouterService.getInstance();
                            await aiRouter.refreshConfig();
                        }
                    });
                }
                break;

            case 'Voice Input Error':
                if (message.includes('permission')) {
                    actions.push({
                        type: 'redirect',
                        label: 'Open Settings',
                        action: async () => {
                            // This would open device settings
                            console.log('Opening device settings for microphone');
                        }
                    });
                }
                actions.push({
                    type: 'fallback',
                    label: 'Use Text Input',
                    action: () => {
                        console.log('Switching to text input mode');
                    }
                });
                actions.push({
                    type: 'retry',
                    label: 'Try Voice Again',
                    action: async () => {
                        if (context.retryAction) {
                            await context.retryAction();
                        }
                    }
                });
                break;

            case 'Image Service Error':
                actions.push({
                    type: 'retry',
                    label: 'Retry Image Loading',
                    action: async () => {
                        if (context.retryAction) {
                            await context.retryAction();
                        }
                    }
                });
                actions.push({
                    type: 'fallback',
                    label: 'Continue Without Images',
                    action: () => {
                        console.log('Continuing without images');
                    }
                });
                if (message.includes('cache')) {
                    actions.push({
                        type: 'reset',
                        label: 'Clear Image Cache',
                        action: async () => {
                            const { imageService } = await import('@/services/imageService');
                            await imageService.clearCache();
                        }
                    });
                }
                break;

            case 'Chat Error':
                if (message.includes('session')) {
                    actions.push({
                        type: 'reset',
                        label: 'Start New Chat',
                        action: async () => {
                            const { chatService } = await import('@/services/chatService');
                            await chatService.createSession();
                        }
                    });
                } else {
                    actions.push({
                        type: 'retry',
                        label: 'Retry Message',
                        action: async () => {
                            if (context.retryAction) {
                                await context.retryAction();
                            }
                        }
                    });
                }
                actions.push({
                    type: 'fallback',
                    label: 'Browse Recipes',
                    action: async () => {
                        const { router } = await import('expo-router');
                        router.push('/(tabs)/history');
                    }
                });
                break;

            case 'Storage Error':
                actions.push({
                    type: 'reset',
                    label: 'Clear Cache',
                    action: async () => {
                        const { cacheService } = await import('@/services/cacheService');
                        await cacheService.clearCache();
                    }
                });
                actions.push({
                    type: 'retry',
                    label: 'Retry Operation',
                    action: async () => {
                        if (context.retryAction) {
                            await context.retryAction();
                        }
                    }
                });
                break;

            case 'Subscription Error':
                actions.push({
                    type: 'redirect',
                    label: 'Upgrade Subscription',
                    action: async () => {
                        const { router } = await import('expo-router');
                        router.push('/(tabs)/settings');
                    }
                });
                actions.push({
                    type: 'fallback',
                    label: 'Use Free Features',
                    action: async () => {
                        const { router } = await import('expo-router');
                        router.push('/(tabs)');
                    }
                });
                break;

            default:
                actions.push({
                    type: 'retry',
                    label: 'Try Again',
                    action: async () => {
                        if (context.retryAction) {
                            await context.retryAction();
                        }
                    }
                });
                actions.push({
                    type: 'redirect',
                    label: 'Go Home',
                    action: async () => {
                        const { router } = await import('expo-router');
                        router.replace('/(tabs)');
                    }
                });
        }

        return actions;
    }

    /**
     * Determine if error should be reported
     */
    private shouldReportError(error: Error, category: string, severity: string): boolean {
        // Always report critical and high severity errors
        if (severity === 'critical' || severity === 'high') {
            return true;
        }

        // Report medium severity errors for certain categories
        if (severity === 'medium' &&
            ['AI Service Error', 'API Error', 'Storage Error'].includes(category)) {
            return true;
        }

        // Don't report low severity or common errors
        const commonErrors = [
            'network request failed',
            'timeout',
            'cancelled',
            'aborted'
        ];

        return !commonErrors.some(common =>
            error.message.toLowerCase().includes(common)
        );
    }

    /**
     * Report error to monitoring service
     */
    private async reportError(errorReport: ErrorReport): Promise<void> {
        try {
            // Add to queue for batch reporting
            this.errorQueue.push(errorReport);

            // Process queue if not already processing
            if (!this.isReporting) {
                await this.processErrorQueue();
            }

        } catch (reportingError) {
            console.error('Failed to report error:', reportingError);
            // Store locally for later retry
            this.storeErrorLocally(errorReport);
        }
    }

    /**
     * Process error reporting queue
     */
    private async processErrorQueue(): Promise<void> {
        if (this.isReporting || this.errorQueue.length === 0) {
            return;
        }

        this.isReporting = true;

        try {
            const errors = this.errorQueue.splice(0, 10); // Process up to 10 errors at once

            // In a real app, you would send to your error tracking service
            // For now, we'll store in Supabase for monitoring
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const errorRecords = errors.map(error => ({
                    id: error.id,
                    user_id: user.id,
                    message: error.message,
                    stack: error.stack,
                    category: error.category,
                    severity: error.severity,
                    context: error.context,
                    metadata: error.metadata,
                    created_at: error.timestamp
                }));

                // Store in a hypothetical error_logs table
                // const { error: insertError } = await supabase
                //     .from('error_logs')
                //     .insert(errorRecords);

                // For now, just log to console
                console.log('Error reports:', errorRecords);
            }

        } catch (error) {
            console.error('Failed to process error queue:', error);
            // Re-add errors to queue for retry
            this.errorQueue.unshift(...this.errorQueue);
        } finally {
            this.isReporting = false;

            // Process remaining errors if any
            if (this.errorQueue.length > 0) {
                setTimeout(() => this.processErrorQueue(), 5000);
            }
        }
    }

    /**
     * Store error locally for offline reporting
     */
    private storeErrorLocally(errorReport: ErrorReport): void {
        try {
            // Store in AsyncStorage for later retry
            // This would be implemented with actual AsyncStorage
            console.log('Storing error locally:', errorReport.id);
        } catch (error) {
            console.error('Failed to store error locally:', error);
        }
    }

    /**
     * Log error for debugging
     */
    private logError(errorReport: ErrorReport): void {
        const logLevel = errorReport.severity === 'critical' ? 'error' :
            errorReport.severity === 'high' ? 'error' :
                errorReport.severity === 'medium' ? 'warn' : 'info';

        console[logLevel](`[${errorReport.category}] ${errorReport.message}`, {
            id: errorReport.id,
            timestamp: errorReport.timestamp,
            context: errorReport.context,
            stack: errorReport.stack
        });
    }

    /**
     * Get error statistics
     */
    async getErrorStats(): Promise<{
        totalErrors: number;
        errorsByCategory: Record<string, number>;
        errorsBySeverity: Record<string, number>;
        recentErrors: ErrorReport[];
    }> {
        // This would typically query your error tracking service
        // For now, return mock data
        return {
            totalErrors: 0,
            errorsByCategory: {},
            errorsBySeverity: {},
            recentErrors: []
        };
    }

    /**
     * Clear error queue (for testing)
     */
    clearErrorQueue(): void {
        this.errorQueue = [];
    }
}

// Export singleton instance
export const errorHandlingService = ErrorHandlingService.getInstance();