import React, { useState, useRef } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Send, Mic } from 'lucide-react-native';
import { ModelSelector } from '@/components/ModelSelector';
import { LlamaModel } from '@/services/llamaService';
import { colors, glassStyles } from '@/styles/theme';

interface ChatComposerProps {
    onSend: (message: string) => void;
    onVoicePress?: () => void;
    selectedModel: LlamaModel | null;
    onModelSelect: (model: LlamaModel) => void;
    disabled?: boolean;
    placeholder?: string;
    showVoiceButton?: boolean;
    showModelSelector?: boolean;
}

export function ChatComposer({
    onSend,
    onVoicePress,
    selectedModel,
    onModelSelect,
    disabled = false,
    placeholder = 'Ask about recipes or cooking...',
    showVoiceButton = true,
    showModelSelector = true,
}: ChatComposerProps) {
    const [message, setMessage] = useState('');
    const inputRef = useRef<TextInput>(null);

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSend(message.trim());
            setMessage('');
            inputRef.current?.focus();
        }
    };

    const canSend = message.trim().length > 0 && !disabled && selectedModel !== null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <BlurView intensity={40} tint="dark" style={styles.container}>
                {showModelSelector && (
                    <View style={styles.modelSelectorContainer}>
                        <ModelSelector
                            selectedModel={selectedModel}
                            onModelSelect={onModelSelect}
                            disabled={disabled}
                        />
                    </View>
                )}

                <View style={styles.inputContainer}>
                    {showVoiceButton && onVoicePress && (
                        <TouchableOpacity
                            style={[styles.voiceButton, disabled && styles.disabled]}
                            onPress={onVoicePress}
                            disabled={disabled}
                        >
                            <Mic size={22} color="#fff" />
                        </TouchableOpacity>
                    )}

                    <View style={styles.inputWrapper}>
                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            value={message}
                            onChangeText={setMessage}
                            placeholder={placeholder}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            multiline
                            maxLength={500}
                            editable={!disabled}
                            onSubmitEditing={handleSend}
                            blurOnSubmit={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            !canSend && styles.sendButtonDisabled,
                        ]}
                        onPress={handleSend}
                        disabled={!canSend}
                    >
                        {disabled ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Send
                                size={22}
                                color={canSend ? '#fff' : 'rgba(255, 255, 255, 0.3)'}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </BlurView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    modelSelectorContainer: {
        marginBottom: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    voiceButton: {
        ...glassStyles.glassButton,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
    inputWrapper: {
        flex: 1,
        ...glassStyles.glassContainer,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        maxHeight: 120,
    },
    input: {
        color: '#fff',
        fontSize: 16,
        lineHeight: 22,
        paddingVertical: 0,
    },
    sendButton: {
        ...glassStyles.glassButton,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
});
