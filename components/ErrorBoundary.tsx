import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';
import { router } from 'expo-router';
import { errorHandlingService } from '@/services/errorHandlingService';
import { ErrorRecoveryModal } from '@/components/ErrorRecoveryModal';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    errorId: string;
    errorAnalysis: {
        category: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        userMessage: string;
        recoveryActions: any[];
    } | null;
    showRecoveryModal: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
            errorAnalysis: null,
            showRecoveryModal: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            error,
            errorInfo
        });

        // Log error for monitoring
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // Use error handling service for analysis and reporting
        try {
            const errorAnalysis = await errorHandlingService.handleError(error, {
                componentStack: errorInfo.componentStack || undefined
            });

            this.setState({
                errorAnalysis,
                showRecoveryModal: errorAnalysis.severity === 'high' || errorAnalysis.severity === 'critical'
            });

        } catch (handlingError) {
            console.error('Failed to analyze error:', handlingError);
        }
    }

    private reportError = async (error: Error, errorInfo: React.ErrorInfo) => {
        try {
            // TODO: Implement error reporting to analytics service
            const errorReport = {
                id: this.state.errorId,
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: 'React Native App',
                url: 'app://recipe-app'
            };

            console.log('Error report:', errorReport);

            // In a real app, you would send this to your error tracking service
            // await errorTrackingService.report(errorReport);

        } catch (reportingError) {
            console.error('Failed to report error:', reportingError);
        }
    };

    private handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorId: '',
            errorAnalysis: null,
            showRecoveryModal: false
        });
    };

    private handleRecoveryAction = async (action: any) => {
        try {
            await action.action();
            this.handleRetry();
        } catch (actionError) {
            console.error('Recovery action failed:', actionError);
        }
    };

    private handleCloseRecoveryModal = () => {
        this.setState({ showRecoveryModal: false });
    };

    private handleGoHome = () => {
        this.handleRetry();
        router.replace('/(tabs)');
    };

    private getErrorCategory = (error: Error): string => {
        const message = error.message.toLowerCase();
        const stack = error.stack?.toLowerCase() || '';

        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return 'Network Error';
        }
        if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
            return 'Authentication Error';
        }
        if (message.includes('api') || message.includes('server') || stack.includes('supabase')) {
            return 'API Error';
        }
        if (message.includes('voice') || message.includes('microphone') || message.includes('recording')) {
            return 'Voice Input Error';
        }
        if (message.includes('image') || message.includes('photo')) {
            return 'Image Service Error';
        }
        if (stack.includes('chat') || stack.includes('message')) {
            return 'Chat Error';
        }
        if (stack.includes('recipe') || stack.includes('generation')) {
            return 'Recipe Generation Error';
        }
        return 'Application Error';
    };

    private getErrorSuggestions = (error: Error): string[] => {
        const category = this.getErrorCategory(error);
        const suggestions: string[] = [];

        switch (category) {
            case 'Network Error':
                suggestions.push('Check your internet connection');
                suggestions.push('Try switching between WiFi and mobile data');
                suggestions.push('Wait a moment and try again');
                break;
            case 'Authentication Error':
                suggestions.push('Try logging out and back in');
                suggestions.push('Check your account credentials');
                suggestions.push('Contact support if the issue persists');
                break;
            case 'API Error':
                suggestions.push('Check your API key configuration in Settings');
                suggestions.push('Verify your subscription status');
                suggestions.push('Try again in a few minutes');
                break;
            case 'Voice Input Error':
                suggestions.push('Check microphone permissions');
                suggestions.push('Try using text input instead');
                suggestions.push('Restart the app and try again');
                break;
            case 'Image Service Error':
                suggestions.push('Images may be temporarily unavailable');
                suggestions.push('Recipes will still work without images');
                suggestions.push('Try refreshing the recipe');
                break;
            default:
                suggestions.push('Try refreshing the page');
                suggestions.push('Restart the app if the problem continues');
                suggestions.push('Contact support if you need help');
        }

        return suggestions;
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const errorCategory = this.state.errorAnalysis?.category || this.getErrorCategory(this.state.error!);
            const userMessage = this.state.errorAnalysis?.userMessage || this.state.error!.message;
            const suggestions = this.state.errorAnalysis ?
                this.state.errorAnalysis.recoveryActions.map(action => action.label) :
                this.getErrorSuggestions(this.state.error!);

            return (
                <LinearGradient
                    colors={gradientColors}
                    locations={gradientLocations}
                    style={styles.container}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <BlurView intensity={30} tint="light" style={styles.errorCard}>
                            {/* Error Icon */}
                            <View style={styles.iconContainer}>
                                <AlertTriangle size={48} color={colors.error} />
                            </View>

                            {/* Error Title */}
                            <Text style={styles.errorTitle}>
                                Oops! Something went wrong
                            </Text>

                            {/* Error Category */}
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>
                                    {errorCategory}
                                </Text>
                            </View>

                            {/* Error Message */}
                            <Text style={styles.errorMessage}>
                                {userMessage}
                            </Text>

                            {/* Suggestions */}
                            <View style={styles.suggestionsContainer}>
                                <Text style={styles.suggestionsTitle}>
                                    Here's what you can try:
                                </Text>
                                {suggestions.map((suggestion, index) => (
                                    <View key={index} style={styles.suggestionItem}>
                                        <Text style={styles.suggestionBullet}>•</Text>
                                        <Text style={styles.suggestionText}>
                                            {suggestion}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.actionContainer}>
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={this.handleRetry}
                                >
                                    <RefreshCw size={20} color="#fff" />
                                    <Text style={styles.retryButtonText}>
                                        Try Again
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.homeButton}
                                    onPress={this.handleGoHome}
                                >
                                    <Home size={20} color={colors.primary} />
                                    <Text style={styles.homeButtonText}>
                                        Go Home
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Error ID for support */}
                            <View style={styles.errorIdContainer}>
                                <Bug size={14} color={colors.textSecondary} />
                                <Text style={styles.errorIdText}>
                                    Error ID: {this.state.errorId}
                                </Text>
                            </View>

                            {/* Debug Info (only in development) */}
                            {__DEV__ && this.state.error && (
                                <View style={styles.debugContainer}>
                                    <Text style={styles.debugTitle}>
                                        Debug Information:
                                    </Text>
                                    <ScrollView
                                        style={styles.debugScroll}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                    >
                                        <Text style={styles.debugText}>
                                            {this.state.error.stack}
                                        </Text>
                                    </ScrollView>
                                </View>
                            )}
                        </BlurView>
                    </ScrollView>

                    {/* Recovery Modal */}
                    {this.state.errorAnalysis && (
                        <ErrorRecoveryModal
                            visible={this.state.showRecoveryModal}
                            onClose={this.handleCloseRecoveryModal}
                            error={this.state.errorAnalysis}
                            onActionSelect={this.handleRecoveryAction}
                        />
                    )}
                </LinearGradient>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    errorCard: {
        ...glassStyles.glassCard,
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
    },
    categoryBadge: {
        backgroundColor: colors.error,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    categoryText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    errorMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    suggestionsContainer: {
        width: '100%',
        marginBottom: 24,
    },
    suggestionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    suggestionBullet: {
        fontSize: 16,
        color: colors.primary,
        marginRight: 8,
        marginTop: 2,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        gap: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    homeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glassLight,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.primary,
        gap: 8,
    },
    homeButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    errorIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    errorIdText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontFamily: 'monospace',
    },
    debugContainer: {
        width: '100%',
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 8,
    },
    debugTitle: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: 8,
    },
    debugScroll: {
        maxHeight: 100,
    },
    debugText: {
        fontSize: 10,
        color: colors.textSecondary,
        fontFamily: 'monospace',
        lineHeight: 14,
    },
});