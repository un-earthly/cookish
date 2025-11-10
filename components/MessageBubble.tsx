import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { ChatMessage, Recipe } from '@/types/recipe';
import { ChatRecipeCard } from '@/components/ChatRecipeCard';
import { User, Bot, Mic } from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';

interface MessageBubbleProps {
    message: ChatMessage;
    isLast: boolean;
    onSaveRecipe?: (recipe: Recipe) => void;
    onModifyRecipe?: (recipe: Recipe, request: string) => void;
    sessionId?: string;
}

export function MessageBubble({ message, isLast, onSaveRecipe, onModifyRecipe, sessionId }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <View style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.assistantMessageContainer
        ]}>
            {/* Avatar */}
            <View style={[
                styles.avatar,
                isUser ? styles.userAvatar : styles.assistantAvatar
            ]}>
                {isUser ? (
                    <User size={16} color="#fff" />
                ) : (
                    <Bot size={16} color="#fff" />
                )}
            </View>

            {/* Message Content */}
            <View style={styles.messageContent}>
                <BlurView
                    intensity={20}
                    tint="light"
                    style={[
                        styles.messageBubble,
                        isUser ? styles.userBubble : styles.assistantBubble
                    ]}
                >
                    {/* Voice indicator */}
                    {message.voice_input && (
                        <View style={styles.voiceIndicator}>
                            <Mic size={12} color={colors.textSecondary} />
                            <Text style={styles.voiceText}>Voice message</Text>
                        </View>
                    )}

                    {/* Message text */}
                    <Text style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.assistantMessageText
                    ]}>
                        {message.content}
                    </Text>

                    {/* Recipe card if message contains recipe */}
                    {message.recipe && (
                        <View style={styles.recipeContainer}>
                            <ChatRecipeCard
                                recipe={message.recipe}
                                onSave={() => onSaveRecipe?.(message.recipe!)}
                                onModify={(request) => onModifyRecipe?.(message.recipe!, request)}
                                sessionId={sessionId}
                                showVariationOptions={true}
                            />
                        </View>
                    )}

                    {/* Timestamp */}
                    <Text style={styles.timestamp}>
                        {formatTime(message.created_at)}
                    </Text>
                </BlurView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        justifyContent: 'flex-end',
    },
    assistantMessageContainer: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    userAvatar: {
        backgroundColor: colors.primary,
    },
    assistantAvatar: {
        backgroundColor: colors.secondary,
    },
    messageContent: {
        flex: 1,
        maxWidth: '80%',
    },
    messageBubble: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    userBubble: {
        backgroundColor: 'rgba(46, 196, 182, 0.2)',
        marginLeft: 40,
    },
    assistantBubble: {
        backgroundColor: colors.glassMedium,
        marginRight: 40,
    },
    voiceIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    },
    voiceText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userMessageText: {
        color: colors.textPrimary,
    },
    assistantMessageText: {
        color: colors.textPrimary,
    },
    recipeContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    timestamp: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: 'right',
    },
});