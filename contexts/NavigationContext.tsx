import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useCallback,
} from 'react';
import { router, usePathname } from 'expo-router';
import { Recipe } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';

interface NavigationContextType {
    // Current State
    currentRoute: string;
    isTabScreen: boolean;
    canGoBack: boolean;

    // Navigation Actions
    navigateToRecipe: (recipe: Recipe) => void;
    navigateToChat: (sessionId?: string) => void;
    navigateToHistory: () => void;
    navigateToSettings: () => void;
    navigateHome: () => void;
    goBack: () => void;

    // Deep Link Handling
    handleDeepLink: (url: string) => void;

    // Tab Badge Management
    chatBadgeCount: number;
    historyBadgeCount: number;
    setChatBadgeCount: (count: number) => void;
    setHistoryBadgeCount: (count: number) => void;

    // Navigation State
    navigationReady: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();

    // State
    const [navigationReady, setNavigationReady] = useState(false);
    const [chatBadgeCount, setChatBadgeCount] = useState(0);
    const [historyBadgeCount, setHistoryBadgeCount] = useState(0);

    // Computed values
    const currentRoute = pathname;
    const isTabScreen = pathname.startsWith('/(tabs)');
    const canGoBack = router.canGoBack();

    // Initialize navigation
    useEffect(() => {
        setNavigationReady(true);
    }, []);

    // Navigation actions
    const navigateToRecipe = useCallback((recipe: Recipe) => {
        router.push({
            pathname: '/(tabs)/recipe-detail',
            params: {
                recipeId: recipe.id,
                recipeName: recipe.recipe_name
            }
        });
    }, []);

    const navigateToChat = useCallback((sessionId?: string) => {
        if (sessionId) {
            router.push({
                pathname: '/(tabs)/chat',
                params: { sessionId }
            });
        } else {
            router.push('/(tabs)/chat');
        }
    }, []);

    const navigateToHistory = useCallback(() => {
        router.push('/(tabs)/history');
    }, []);

    const navigateToSettings = useCallback(() => {
        router.push('/(tabs)/settings');
    }, []);

    const navigateHome = useCallback(() => {
        router.push('/(tabs)');
    }, []);

    const goBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            navigateHome();
        }
    }, [navigateHome]);

    // Deep link handling
    const handleDeepLink = useCallback((url: string) => {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            const params = Object.fromEntries(urlObj.searchParams);

            switch (path) {
                case '/recipe':
                    if (params.id) {
                        router.push({
                            pathname: '/(tabs)/recipe-detail',
                            params: { recipeId: params.id }
                        });
                    }
                    break;
                case '/chat':
                    if (params.sessionId) {
                        navigateToChat(params.sessionId);
                    } else {
                        navigateToChat();
                    }
                    break;
                case '/history':
                    navigateToHistory();
                    break;
                case '/settings':
                    navigateToSettings();
                    break;
                default:
                    navigateHome();
            }
        } catch (error) {
            console.error('Failed to handle deep link:', error);
            navigateHome();
        }
    }, [navigateToChat, navigateToHistory, navigateToSettings, navigateHome]);

    // Handle authentication state changes
    useEffect(() => {
        if (!user) {
            // User logged out - redirect to auth
            router.replace('/(auth)/login');
        }
    }, [user]);

    // Badge management
    const updateChatBadge = useCallback((count: number) => {
        setChatBadgeCount(Math.max(0, count));
    }, []);

    const updateHistoryBadge = useCallback((count: number) => {
        setHistoryBadgeCount(Math.max(0, count));
    }, []);

    // Clear badges when visiting screens
    useEffect(() => {
        if (pathname === '/(tabs)/chat') {
            setChatBadgeCount(0);
        } else if (pathname === '/(tabs)/history') {
            setHistoryBadgeCount(0);
        }
    }, [pathname]);

    const contextValue: NavigationContextType = {
        // Current State
        currentRoute,
        isTabScreen,
        canGoBack,

        // Navigation Actions
        navigateToRecipe,
        navigateToChat,
        navigateToHistory,
        navigateToSettings,
        navigateHome,
        goBack,

        // Deep Link Handling
        handleDeepLink,

        // Tab Badge Management
        chatBadgeCount,
        historyBadgeCount,
        setChatBadgeCount: updateChatBadge,
        setHistoryBadgeCount: updateHistoryBadge,

        // Navigation State
        navigationReady,
    };

    return (
        <NavigationContext.Provider value={contextValue}>
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within NavigationProvider');
    }
    return context;
}