import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { 
    AlertTriangle, 
    RefreshCw, 
    Home, 
    Settings, 
    Wifi, 
    WifiOff,
    Cpu,
    MessageSquare,
    Mic,
    Image as ImageIcon
} from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';
import { router } from 'expo-router';
import { aiErrorHandler } from '@/services/aiErrorHandler';
import { ErrorRecoveryModal } from '@/components/ErrorRecoveryModal';

interface Props {
    children: ReactNode;
    operation?: 'recipe_generation' | 'chat' | 'voice' | 'image' | 'subscription';
    context?: Record<string, any>;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    errorId: string;
    operation: string;
    recoveryOptions: {
        canRecover: boolean;
        fallbackAvailable: boolean;
        userMessage: string;
        recoveryActions: any[];
        suggestedAction?: 'retry' | 'fallback' | 'manual';
    } | null;
    showRecoveryModal: boolean;
    isRecovering: boolean;
}

export class AIErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
            operation: props.operation || 'unknown',
            recoveryOptions: null,
            showRecoveryModal: false,
            isRecovering: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
            errorId: `ai_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            error,
            errorInfo
        });

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // Use AI-specific error handling
        try {
            const context = aiErrorHandler.createAIErrorContext(
                this.props.operation || 'unknown',
                {
                    ...this.props.context,
                    componentStack: errorInfo.componentStack,
                    errorBoundary: true
                }
            );

            // Log the AI error
            await aiErrorHandler.logAIError(error, this.state.operation, context);

            // Get recovery options based on operation type
            const recoveryOptions = await this.getRecoveryOptions(error, context);

            this.setState({
                recoveryOptions,
                showRecoveryModal: recoveryOptions.suggestedAction === 'fallback' || 
                                   recoveryOptions.suggestedAction === 'manual'
            });

        } catch (handlingError) {
            console.error('Failed to handle AI error:', handlingError);
            
            // Fallback error state
            this.setState({
                recoveryOptions: {
                    canRecover: true,
                    fallbackAvailable: false,
                    userMessage: 'An unexpected AI error occurred. Please try again.',
                    recoveryActions: [{
                        type: 'retry',
                        label: 'Try Again',
                        action: () => this.handleRetry()
                    }]
                }
            });
        }
    }

    /**
     * Get recovery options based on operation type
     */
    private async getRecoveryOptions(error: Error, context: any) {
        switch (this.props.operation) {
            case 'recipe_generation':
                return await aiErrorHandler.handleRecipeGenerationError(error, context);
            
            case 'chat':
                return await aiErrorHandler.handleChatError(error, context);
            
            case 'voice':
                return await aiErrorHandler.handleVoiceInputError(error, context);
            
            case 'image':
                return await ai