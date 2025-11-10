import { useState, useCallback } from 'react';
import { errorHandlingService, ErrorRecoveryAction } from '@/services/errorHandlingService';

interface ErrorState {
    hasError: boolean;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userMessage: string;
    recoveryActions: ErrorRecoveryAction[];
    errorId: string;
}

export function useErrorHandling() {
    const [errorState, setErrorState] = useState<ErrorState | null>(null);
    const [isHandlingError, setIsHandlingError] = useState(false);

    /**
     * Handle an error with automatic categorization and recovery options
     */
    const handleError = useCallback(async (
        error: Error,
        context: {
            screen?: string;
            action?: string;
            componentStack?: string;
            userId?: string;
            retryAction?: () => Promise<void>;
        } = {}
    ) => {
        setIsHandlingError(true);

        try {
            const errorAnalysis = await errorHandlingService.handleError(error, context);

            setErrorState({
                hasError: true,
                category: errorAnalysis.category,
                severity: errorAnalysis.severity,
                userMessage: errorAnalysis.userMessage,
                recoveryActions: errorAnalysis.recoveryActions,
                errorId: `error_${Date.now()}`
            });

            return errorAnalysis;

        } catch (handlingError) {
            console.error('Failed to handle error:', handlingError);

            // Fallback error state
            setErrorState({
                hasError: true,
                category: 'Application Error',
                severity: 'medium',
                userMessage: 'An unexpected error occurred. Please try again.',
                recoveryActions: [{
                    type: 'retry',
                    label: 'Try Again',
                    action: context.retryAction || (() => { })
                }],
                errorId: `fallback_${Date.now()}`
            });

        } finally {
            setIsHandlingError(false);
        }
    }, []);

    /**
     * Clear the current error state
     */
    const clearError = useCallback(() => {
        setErrorState(null);
    }, []);

    /**
     * Handle recovery action selection
     */
    const handleRecoveryAction = useCallback(async (action: ErrorRecoveryAction) => {
        try {
            await action.action();
            clearError();
        } catch (actionError) {
            console.error('Recovery action failed:', actionError);
            // Don't clear error state if recovery action fails
        }
    }, [clearError]);

    /**
     * Create an error boundary handler
     */
    const createErrorBoundaryHandler = useCallback((
        screen: string,
        retryAction?: () => Promise<void>
    ) => {
        return (error: Error, errorInfo: React.ErrorInfo) => {
            handleError(error, {
                screen,
                componentStack: errorInfo.componentStack,
                retryAction
            });
        };
    }, [handleError]);

    /**
     * Create a try-catch wrapper with automatic error handling
     */
    const withErrorHandling = useCallback(<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context: {
            screen?: string;
            action?: string;
            fallbackValue?: R;
        } = {}
    ) => {
        return async (...args: T): Promise<R | undefined> => {
            try {
                return await fn(...args);
            } catch (error) {
                await handleError(error as Error, {
                    screen: context.screen,
                    action: context.action,
                    retryAction: () => fn(...args)
                });
                return context.fallbackValue;
            }
        };
    }, [handleError]);

    /**
     * Create a safe async function that won't throw
     */
    const safeAsync = useCallback(<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        options: {
            screen?: string;
            action?: string;
            fallbackValue?: R;
            silent?: boolean; // Don't show error UI
        } = {}
    ) => {
        return async (...args: T): Promise<R | undefined> => {
            try {
                return await fn(...args);
            } catch (error) {
                if (!options.silent) {
                    await handleError(error as Error, {
                        screen: options.screen,
                        action: options.action,
                        retryAction: () => fn(...args)
                    });
                } else {
                    console.error('Silent error:', error);
                }
                return options.fallbackValue;
            }
        };
    }, [handleError]);

    /**
     * Report an error without showing UI
     */
    const reportError = useCallback(async (
        error: Error,
        context: {
            screen?: string;
            action?: string;
            userId?: string;
        } = {}
    ) => {
        try {
            await errorHandlingService.handleError(error, context);
        } catch (reportingError) {
            console.error('Failed to report error:', reportingError);
        }
    }, []);

    /**
     * Check if a specific error category is currently active
     */
    const hasErrorCategory = useCallback((category: string): boolean => {
        return errorState?.category === category;
    }, [errorState]);

    /**
     * Check if error severity meets threshold
     */
    const hasErrorSeverity = useCallback((
        minSeverity: 'low' | 'medium' | 'high' | 'critical'
    ): boolean => {
        if (!errorState) return false;

        const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
        const currentLevel = severityLevels[errorState.severity];
        const minLevel = severityLevels[minSeverity];

        return currentLevel >= minLevel;
    }, [errorState]);

    return {
        // State
        errorState,
        hasError: !!errorState,
        isHandlingError,

        // Actions
        handleError,
        clearError,
        handleRecoveryAction,
        reportError,

        // Utilities
        createErrorBoundaryHandler,
        withErrorHandling,
        safeAsync,
        hasErrorCategory,
        hasErrorSeverity,

        // Computed values
        shouldShowErrorModal: errorState?.severity === 'high' || errorState?.severity === 'critical',
        shouldShowErrorBanner: errorState?.severity === 'medium',
        canRetry: errorState?.recoveryActions.some(action => action.type === 'retry') ?? false,
        canFallback: errorState?.recoveryActions.some(action => action.type === 'fallback') ?? false
    };
}