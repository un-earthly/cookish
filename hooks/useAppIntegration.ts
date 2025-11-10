import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { appIntegrationService } from '@/services/appIntegrationService';
import { UserPreferences, ChatSession, Recipe } from '@/types/recipe';

interface AppIntegrationState {
    isInitialized: boolean;
    isInitializing: boolean;
    error: string | null;
    serviceHealth: {
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
    } | null;
    availableFeatures: {
        recipeGeneration: boolean;
        voiceInput: boolean;
        imageGeneration: boolean;
        recipeModification: boolean;
        offlineAccess: boolean;
        premiumFeatures: boolean;
    } | null;
}

export function useAppIntegration() {
    const [state, setState] = useState<AppIntegrationState>({
        isInitialized: false,
        isInitializing: false,
        error: null,
        serviceHealth: null,
        availableFeatures: null
    });

    // Initialize services
    const initialize = useCallback(async () => {
        if (state.isInitializing || state.isInitialized) {
            return;
        }

        setState(prev => ({ ...prev, isInitializing: true, error: null }));

        try {
            await appIntegrationService.initialize();

            // Get initial service health and features
            const [health, features] = await Promise.all([
                appIntegrationService.getServiceHealth(),
                appIntegrationService.getAvailableFeatures()
            ]);

            setState(prev => ({
                ...prev,
                isInitialized: true,
                isInitializing: false,
                serviceHealth: health,
                availableFeatures: features
            }));

        } catch (error) {
            console.error('Failed to initialize app integration:', error);
            setState(prev => ({
                ...prev,
                isInitializing: false,
                error: error instanceof Error ? error.message : 'Failed to initialize services'
            }));
        }
    }, [state.isInitializing, state.isInitialized]);

    // Refresh service status
    const refreshServiceStatus = useCallback(async () => {
        try {
            const [health, features] = await Promise.all([
                appIntegrationService.getServiceHealth(),
                appIntegrationService.getAvailableFeatures()
            ]);

            setState(prev => ({
                ...prev,
                serviceHealth: health,
                availableFeatures: features
            }));

        } catch (error) {
            console.error('Failed to refresh service status:', error);
        }
    }, []);

    // Handle app state changes
    const handleAppStateChange = useCallback(async (nextAppState: AppStateStatus) => {
        try {
            await appIntegrationService.handleAppStateChange(nextAppState);

            // Refresh status when app becomes active
            if (nextAppState === 'active') {
                await refreshServiceStatus();
            }
        } catch (error) {
            console.error('Failed to handle app state change:', error);
        }
    }, [refreshServiceStatus]);

    // Create chat session
    const createChatSession = useCallback(async (): Promise<ChatSession | null> => {
        try {
            return await appIntegrationService.createChatSession();
        } catch (error) {
            console.error('Failed to create chat session:', error);
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to create chat session'
            }));
            return null;
        }
    }, []);

    // Generate recipe
    const generateRecipe = useCallback(async (prompt: string, sessionId?: string): Promise<Recipe | null> => {
        try {
            return await appIntegrationService.generateRecipe(prompt, sessionId);
        } catch (error) {
            console.error('Failed to generate recipe:', error);
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to generate recipe'
            }));
            return null;
        }
    }, []);

    // Get user preferences
    const getUserPreferences = useCallback(async (): Promise<UserPreferences | null> => {
        try {
            return await appIntegrationService.getUserPreferences();
        } catch (error) {
            console.error('Failed to get user preferences:', error);
            return null;
        }
    }, []);

    // Update user preferences
    const updateUserPreferences = useCallback(async (preferences: Partial<UserPreferences>): Promise<boolean> => {
        try {
            await appIntegrationService.updateUserPreferences(preferences);
            await refreshServiceStatus(); // Refresh after preferences change
            return true;
        } catch (error) {
            console.error('Failed to update user preferences:', error);
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Failed to update preferences'
            }));
            return false;
        }
    }, [refreshServiceStatus]);

    // Reset services
    const resetServices = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, isInitializing: true, error: null }));

        try {
            await appIntegrationService.resetServices();
            await refreshServiceStatus();

            setState(prev => ({ ...prev, isInitializing: false }));
            return true;

        } catch (error) {
            console.error('Failed to reset services:', error);
            setState(prev => ({
                ...prev,
                isInitializing: false,
                error: error instanceof Error ? error.message : 'Failed to reset services'
            }));
            return false;
        }
    }, [refreshServiceStatus]);

    // Clear error
    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    // Get service statistics
    const getServiceStats = useCallback(async () => {
        try {
            return await appIntegrationService.getServiceStats();
        } catch (error) {
            console.error('Failed to get service stats:', error);
            return null;
        }
    }, []);

    // Handle network changes
    const handleNetworkChange = useCallback(async (isConnected: boolean) => {
        try {
            await appIntegrationService.handleNetworkChange(isConnected);
            await refreshServiceStatus();
        } catch (error) {
            console.error('Failed to handle network change:', error);
        }
    }, [refreshServiceStatus]);

    // Initialize on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // Listen to app state changes
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [handleAppStateChange]);

    // Auto-refresh service status periodically
    useEffect(() => {
        if (!state.isInitialized) return;

        const interval = setInterval(refreshServiceStatus, 60000); // Every minute
        return () => clearInterval(interval);
    }, [state.isInitialized, refreshServiceStatus]);

    return {
        // State
        isInitialized: state.isInitialized,
        isInitializing: state.isInitializing,
        error: state.error,
        serviceHealth: state.serviceHealth,
        availableFeatures: state.availableFeatures,

        // Actions
        initialize,
        refreshServiceStatus,
        createChatSession,
        generateRecipe,
        getUserPreferences,
        updateUserPreferences,
        resetServices,
        clearError,
        getServiceStats,
        handleNetworkChange,

        // Computed values
        isHealthy: state.serviceHealth?.overall === 'healthy',
        isDegraded: state.serviceHealth?.overall === 'degraded',
        isUnhealthy: state.serviceHealth?.overall === 'unhealthy',
        hasError: !!state.error,
        canGenerateRecipes: state.availableFeatures?.recipeGeneration ?? false,
        canUseVoice: state.availableFeatures?.voiceInput ?? false,
        canUseImages: state.availableFeatures?.imageGeneration ?? false,
        canModifyRecipes: state.availableFeatures?.recipeModification ?? false,
        hasOfflineAccess: state.availableFeatures?.offlineAccess ?? false,
        hasPremiumFeatures: state.availableFeatures?.premiumFeatures ?? false
    };
}