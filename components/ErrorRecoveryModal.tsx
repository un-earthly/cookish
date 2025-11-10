import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { AlertTriangle, RefreshCw, Home, Settings, X } from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';
import { ErrorRecoveryAction } from '@/services/errorHandlingService';

interface ErrorRecoveryModalProps {
    visible: boolean;
    onClose: () => void;
    error: {
        category: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        userMessage: string;
        recoveryActions: ErrorRecoveryAction[];
    };
    onActionSelect: (action: ErrorRecoveryAction) => void;
}

export function ErrorRecoveryModal({
    visible,
    onClose,
    error,
    onActionSelect
}: ErrorRecoveryModalProps) {
    const getSeverityColor = () => {
        switch (error.severity) {
            case 'critical':
                return colors.error;
            case 'high':
                return colors.error;
            case 'medium':
                return colors.warning;
            case 'low':
                return colors.info;
            default:
                return colors.textSecondary;
        }
    };

    const getSeverityIcon = () => {
        switch (error.severity) {
            case 'critical':
            case 'high':
                return <AlertTriangle size={24} color={getSeverityColor()} />;
            case 'medium':
                return <AlertTriangle size={24} color={getSeverityColor()} />;
            case 'low':
                return <AlertTriangle size={24} color={getSeverityColor()} />;
            default:
                return <AlertTriangle size={24} color={getSeverityColor()} />;
        }
    };

    const getActionIcon = (actionType: string) => {
        switch (actionType) {
            case 'retry':
                return <RefreshCw size={16} color={colors.primary} />;
            case 'redirect':
                return <Home size={16} color={colors.primary} />;
            case 'fallback':
                return <Settings size={16} color={colors.secondary} />;
            case 'reset':
                return <RefreshCw size={16} color={colors.warning} />;
            default:
                return <RefreshCw size={16} color={colors.primary} />;
        }
    };

    const handleActionPress = async (action: ErrorRecoveryAction) => {
        try {
            await action.action();
            onActionSelect(action);
            onClose();
        } catch (actionError) {
            console.error('Failed to execute recovery action:', actionError);
            // Could show another error modal here, but let's avoid infinite loops
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <BlurView intensity={20} tint="dark" style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                {getSeverityIcon()}
                                <View>
                                    <Text style={styles.title}>
                                        {error.category}
                                    </Text>
                                    <View style={[
                                        styles.severityBadge,
                                        { backgroundColor: getSeverityColor() }
                                    ]}>
                                        <Text style={styles.severityText}>
                                            {error.severity.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                            >
                                <X size={24} color={colors.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {/* Error Message */}
                        <View style={styles.messageContainer}>
                            <Text style={styles.message}>
                                {error.userMessage}
                            </Text>
                        </View>

                        {/* Recovery Actions */}
                        <View style={styles.actionsContainer}>
                            <Text style={styles.actionsTitle}>
                                What would you like to do?
                            </Text>

                            <ScrollView
                                style={styles.actionsList}
                                showsVerticalScrollIndicator={false}
                            >
                                {error.recoveryActions.map((action, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.actionButton,
                                            action.type === 'retry' && styles.primaryAction
                                        ]}
                                        onPress={() => handleActionPress(action)}
                                    >
                                        <View style={styles.actionContent}>
                                            {getActionIcon(action.type)}
                                            <Text style={[
                                                styles.actionText,
                                                action.type === 'retry' && styles.primaryActionText
                                            ]}>
                                                {action.label}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Additional Help */}
                        <View style={styles.helpContainer}>
                            <Text style={styles.helpText}>
                                If the problem persists, try restarting the app or contact support.
                            </Text>
                        </View>
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalContent: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    severityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    severityText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    closeButton: {
        padding: 4,
    },
    messageContainer: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: colors.glassLight,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    message: {
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
        textAlign: 'center',
    },
    actionsContainer: {
        marginBottom: 20,
    },
    actionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    actionsList: {
        maxHeight: 200,
    },
    actionButton: {
        backgroundColor: colors.glassLight,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: 8,
        overflow: 'hidden',
    },
    primaryAction: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    primaryActionText: {
        color: '#fff',
    },
    helpContainer: {
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    helpText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 16,
    },
});