import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ChatMessage, ProcessingState, Recipe } from '@/types/recipe';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingIndicator } from '@/components/TypingIndicator';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    isProcessing: boolean;
    processingState: ProcessingState;
    onSaveRecipe?: (recipe: Recipe) => void;
    onModifyRecipe?: (recipe: Recipe, request: string) => void;
    sessionId?: string;
}

export function ChatInterface({
    messages,
    isProcessing,
    processingState,
    onSaveRecipe,
    onModifyRecipe,
    sessionId
}: ChatInterfaceProps) {
    return (
        <View style={styles.container}>
            {messages.map((message, index) => (
                <MessageBubble
                    key={message.id}
                    message={message}
                    isLast={index === messages.length - 1}
                    onSaveRecipe={onSaveRecipe}
                    onModifyRecipe={onModifyRecipe}
                    sessionId={sessionId}
                />
            ))}

            {isProcessing && (
                <TypingIndicator processingState={processingState} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 12,
    },
});