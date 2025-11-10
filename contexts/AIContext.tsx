import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useCallback,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppIntegration } from '@/hooks/useAppIntegration';
import { ChatSession, Recipe, ProcessingState } from '@/types/recipe';
import { chatService } from '@/services/chatService';

interface AIContextType {
    // Chat State
    currentSession: ChatSession | null;
    isProcessing: boolean;
    processingState: ProcessingState;

    // AI Capabilities
    canGenerateRecipes: boolean;
    canUseVoice: boolean;
    canUseImages: boolean;
    canModifyRecipes: boolean;
    hasOfflineAccess: boolean;
    hasPremiumFeatures: boolean;

    // Service Status
    isAIReady: boolean;
    aiError: string | null;

    // Actions
    createNewSession: () => Promise<ChatSession | null>;
    generateRecipe: (prompt: string, sessionId?: string) => Promise<Recipe | null>;
    processVoiceInput: (transcript: string, sessionId?: string) => Promise<void>;
    clearAIError: () => void;

    // Processing State Management
    setProcessingState: (state: ProcessingState) => void;
    setIsProcessing: (processing: boolean) => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const {
        isInitialized,
        canGenerateRecipes,
        canUseVoice,
        canUseImages,
        canModifyRecipes,
        hasOfflineAccess,
        hasPremiumFeatures,
        serviceHealth,
        error: integrationError,
        clearError,
        createChatSession,
        generateRecipe: integratedGenerateRecipe
    } = useAppIntegration();

    // Local state
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingState, setProcessingState] = useState<ProcessingState>({
        isListening: false,
        isTranscribing: false,
        isGenerating: false,
        currentStep: ''
    });
    const [aiError, setAIError] = useState<string | null>(null);

    // Computed values
    const isAIReady = isInitialized && canGenerateRecipes && !integrationError;

    // Sync integration error with local AI error
    useEffect(() => {
        if (integrationError) {
            setAIError(integrationError);
        }
    }, [integrationError]);

    // Create new chat session
    const createNewSession = useCallback(async (): Promise<ChatSession | null> => {
        if (!isAIReady) {
            setAIError('AI services are not ready. Please check your connection and settings.');
            return null;
        }

        try {
            setAIError(null);
            const session = await createChatSession();
            if (session) {
                setCurrentSession(session);
            }
            return session;
        } catch (error) {
            console.error('Failed to create chat session:', error);
            setAIError(error instanceof Error ? error.message : 'Failed to create chat session');
            return null;
        }
    }, [isAIReady, createChatSession]);

    // Generate recipe with integrated service
    const generateRecipe = useCallback(async (
        prompt: string,
        sessionId?: string
    ): Promise<Recipe | null> => {
        if (!isAIReady) {
            setAIError('Recipe generation is not available. Please check your settings.');
            return null;
        }

        try {
            setAIError(null);
            setIsProcessing(true);
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Generating recipe...'
            });

            const recipe = await integratedGenerateRecipe(prompt, sessionId);
            return recipe;

        } catch (error) {
            console.error('Failed to generate recipe:', error);
            setAIError(error instanceof Error ? error.message : 'Failed to generate recipe');
            return null;
        } finally {
            setIsProcessing(false);
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: false,
                currentStep: ''
            });
        }
    }, [isAIReady, integratedGenerateRecipe]);

    // Process voice input
    const processVoiceInput = useCallback(async (
        transcript: string,
        sessionId?: string
    ): Promise<void> => {
        if (!canUseVoice) {
            setAIError('Voice input is not available on this device.');
            return;
        }

        if (!transcript.trim()) {
            setAIError('No speech was detected. Please try again.');
            return;
        }

        try {
            setAIError(null);
            setProcessingState({
                isListening: false,
                isTranscribing: true,
                isGenerating: false,
                currentStep: 'Processing voice input...'
            });

            // Use the current session or create a new one
            const targetSessionId = sessionId || currentSession?.id;
            if (!targetSessionId) {
                const newSession = await createNewSession();
                if (!newSession) {
                    throw new Error('Failed to create chat session for voice input');
                }
            }

            // Generate recipe from voice transcript
            await generateRecipe(transcript, targetSessionId);

        } catch (error) {
            console.error('Failed to process voice input:', error);
            setAIError(error instanceof Error ? error.message : 'Failed to process voice input');
        } finally {
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: false,
                currentStep: ''
            });
        }
    }, [canUseVoice, currentSession, createNewSession, generateRecipe]);

    // Clear AI error
    const clearAIError = useCallback(() => {
        setAIError(null);
        clearError(); // Also clear integration error
    }, [clearError]);

    // Initialize session when user is authenticated and AI is ready
    useEffect(() => {
        if (user && isAIReady && !currentSession) {
            createNewSession().catch(console.error);
        }
    }, [user, isAIReady, currentSession, createNewSession]);

    // Clean up session when user logs out
    useEffect(() => {
        if (!user) {
            setCurrentSession(null);
            setIsProcessing(false);
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: false,
                currentStep: ''
            });
            setAIError(null);
        }
    }, [user]);

    const contextValue: AIContextType = {
        // Chat State
        currentSession,
        isProcessing,
        processingState,

        // AI Capabilities
        canGenerateRecipes,
        canUseVoice,
        canUseImages,
        canModifyRecipes,
        hasOfflineAccess,
        hasPremiumFeatures,

        // Service Status
        isAIReady,
        aiError,

        // Actions
        createNewSession,
        generateRecipe,
        processVoiceInput,
        clearAIError,

        // Processing State Management
        setProcessingState,
        setIsProcessing,
    };

    return (
        <AIContext.Provider value={contextValue}>
            {children}
        </AIContext.Provider>
    );
}

export function useAI() {
    const context = useContext(AIContext);
    if (!context) {
        throw new Error('useAI must be used within AIProvider');
    }
    return context;
}