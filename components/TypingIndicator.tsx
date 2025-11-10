import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { ProcessingState } from '@/types/recipe';
import { Bot, Loader } from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';

interface TypingIndicatorProps {
    processingState: ProcessingState;
}

export function TypingIndicator({ processingState }: TypingIndicatorProps) {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDots = () => {
            const createAnimation = (dot: Animated.Value, delay: number) => {
                return Animated.loop(
                    Animated.sequence([
                        Animated.delay(delay),
                        Animated.timing(dot, {
                            toValue: 1,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(dot, {
                            toValue: 0,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                    ])
                );
            };

            Animated.parallel([
                createAnimation(dot1, 0),
                createAnimation(dot2, 200),
                createAnimation(dot3, 400),
            ]).start();
        };

        animateDots();
    }, []);

    const getStatusMessage = () => {
        if (processingState.isListening) {
            return 'Listening...';
        }
        if (processingState.isTranscribing) {
            return 'Processing voice...';
        }
        if (processingState.isGenerating) {
            return processingState.currentStep || 'Generating recipe...';
        }
        return 'Thinking...';
    };

    const getProgressBar = () => {
        if (processingState.progress !== undefined) {
            return (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${processingState.progress}%` }
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>
                        {Math.round(processingState.progress)}%
                    </Text>
                </View>
            );
        }
        return null;
    };

    return (
        <View style={styles.container}>
            {/* Avatar */}
            <View style={styles.avatar}>
                <Bot size={16} color="#fff" />
            </View>

            {/* Typing Bubble */}
            <View style={styles.messageContent}>
                <BlurView intensity={20} tint="light" style={styles.typingBubble}>
                    <View style={styles.header}>
                        <Loader size={14} color={colors.primary} />
                        <Text style={styles.statusText}>
                            {getStatusMessage()}
                        </Text>
                    </View>

                    {/* Progress bar if available */}
                    {getProgressBar()}

                    {/* Animated dots */}
                    <View style={styles.dotsContainer}>
                        <Animated.View
                            style={[
                                styles.dot,
                                {
                                    opacity: dot1,
                                    transform: [
                                        {
                                            scale: dot1.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.2],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                {
                                    opacity: dot2,
                                    transform: [
                                        {
                                            scale: dot2.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.2],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                {
                                    opacity: dot3,
                                    transform: [
                                        {
                                            scale: dot3.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [1, 1.2],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    </View>

                    {/* Estimated time if available */}
                    {processingState.estimatedTime && (
                        <Text style={styles.estimatedTime}>
                            ~{Math.round(processingState.estimatedTime)}s remaining
                        </Text>
                    )}
                </BlurView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    messageContent: {
        flex: 1,
        maxWidth: '80%',
        marginRight: 40,
    },
    typingBubble: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        backgroundColor: colors.glassMedium,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    statusText: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    progressContainer: {
        marginBottom: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        color: colors.textSecondary,
        textAlign: 'right',
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    estimatedTime: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});