import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useCallback,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useAppIntegration } from '@/hooks/useAppIntegration';

interface AppStateContextType {
    // App State
    appState: AppStateStatus;
    isAppActive: boolean;
    isAppInBackground: boolean;

    // Initialization State
    isAppReady: boolean;
    initializationProgress: number;
    initializationStep: string;

    // Feature Flags
    features: {
        aiChat: boolean;
        voiceInput: boolean;
        imageGeneration: boolean;
        offlineMode: boolean;
        premiumFeatures: boolean;
        recipeModification: boolean;
        recipeComparison: boolean;
        recipeHistory: boolean;
    };

    // Performance Metrics
    metrics: {
        appStartTime: number;
        lastActiveTime: number;
        sessionDuration: number;
        backgroundTime: number;
    };

    // Actions
    refreshFeatures: () => Promise<void>;
    recordUserActivity: (activity: string) => void;
    getPerformanceMetrics: () => any;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const {
        isInitialized,
        availableFeatures,
        refreshServiceStatus,
        getServiceStats
    } = useAppIntegration();

    // State
    const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
    const [isAppReady, setIsAppReady] = useState(false);
    const [initializationProgress, setInitializationProgress] = useState(0);
    const [initializationStep, setInitializationStep] = useState('Starting...');
    const [features, setFeatures] = useState({
        aiChat: false,
        voiceInput: false,
        imageGeneration: false,
        offlineMode: false,
        premiumFeatures: false,
        recipeModification: false,
        recipeComparison: false,
        recipeHistory: false,
    });
    const [metrics, setMetrics] = useState({
        appStartTime: Date.now(),
        lastActiveTime: Date.now(),
        sessionDuration: 0,
        backgroundTime: 0,
    });

    // Computed values
    const isAppActive = appState === 'active';
    const isAppInBackground = appState === 'background';

    // Handle app state changes
    const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
        const now = Date.now();

        setMetrics(prev => {
            const newMetrics = { ...prev };

            if (appState === 'active' && nextAppState === 'background') {
                // App going to background
                newMetrics.sessionDuration += now - prev.lastActiveTime;
            } else if (appState === 'background' && nextAppState === 'active') {
                // App coming to foreground
                newMetrics.backgroundTime += now - prev.lastActiveTime;
                newMetrics.lastActiveTime = now;
            }

            return newMetrics;
        });

        setAppState(nextAppState);
    }, [appState]);

    // Initialize app state tracking
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [handleAppStateChange]);

    // Track initialization progress
    useEffect(() => {
        if (!user) {
            setInitializationProgress(0);
            setInitializationStep('Waiting for authentication...');
            setIsAppReady(false);
            return;
        }

        if (!isInitialized) {
            setInitializationProgress(50);
            setInitializationStep('Initializing services...');
            setIsAppReady(false);
            return;
        }

        setInitializationProgress(100);
        setInitializationStep('Ready');
        setIsAppReady(true);
    }, [user, isInitialized]);

    // Update features based on available services
    const refreshFeatures = useCallback(async () => {
        try {
            await refreshServiceStatus();

            if (availableFeatures) {
                setFeatures({
                    aiChat: availableFeatures.recipeGeneration,
                    voiceInput: availableFeatures.voiceInput,
                    imageGeneration: availableFeatures.imageGeneration,
                    offlineMode: availableFeatures.offlineAccess,
                    premiumFeatures: availableFeatures.premiumFeatures,
                    recipeModification: availableFeatures.recipeModification,
                    recipeComparison: true, // Always available
                    recipeHistory: true, // Always available
                });
            }
        } catch (error) {
            console.error('Failed to refresh features:', error);
        }
    }, [availableFeatures, refreshServiceStatus]);

    // Update features when available features change
    useEffect(() => {
        refreshFeatures();
    }, [refreshFeatures]);

    // Record user activity
    const recordUserActivity = useCallback((activity: string) => {
        const now = Date.now();
        setMetrics(prev => ({
            ...prev,
            lastActiveTime: now,
        }));

        // Log activity for analytics (in a real app)
        console.log(`User activity: ${activity} at ${new Date(now).toISOString()}`);
    }, []);

    // Get performance metrics
    const getPerformanceMetrics = useCallback(async () => {
        try {
            const serviceStats = await getServiceStats();
            const now = Date.now();

            return {
                ...metrics,
                currentSessionDuration: now - metrics.lastActiveTime,
                totalAppTime: now - metrics.appStartTime,
                serviceStats,
                features,
                appState,
                isAppReady,
            };
        } catch (error) {
            console.error('Failed to get performance metrics:', error);
            return {
                ...metrics,
                error: 'Failed to collect metrics',
            };
        }
    }, [metrics, features, appState, isAppReady, getServiceStats]);

    // Update session duration periodically when app is active
    useEffect(() => {
        if (!isAppActive) return;

        const interval = setInterval(() => {
            setMetrics(prev => ({
                ...prev,
                sessionDuration: Date.now() - prev.lastActiveTime,
            }));
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [isAppActive]);

    const contextValue: AppStateContextType = {
        // App State
        appState,
        isAppActive,
        isAppInBackground,

        // Initialization State
        isAppReady,
        initializationProgress,
        initializationStep,

        // Feature Flags
        features,

        // Performance Metrics
        metrics,

        // Actions
        refreshFeatures,
        recordUserActivity,
        getPerformanceMetrics,
    };

    return (
        <AppStateContext.Provider value={contextValue}>
            {children}
        </AppStateContext.Provider>
    );
}

export function useAppState() {
    const context = useContext(AppStateContext);
    if (!context) {
        throw new Error('useAppState must be used within AppStateProvider');
    }
    return context;
}