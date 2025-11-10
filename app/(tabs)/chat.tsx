import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, MessageCircle, AlertTriangle } from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';
import { ChatMessage, Recipe } from '@/types/recipe';
import { ChatInterface } from '@/components/ChatInterface';
import { VoiceRecordButton } from '@/components/VoiceRecordButton';
import { ServiceStatusIndicator } from '@/components/ServiceStatusIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { chatService } from '@/services/chatService';
import { useAI } from '@/contexts/AIContext';
import { useNavigation } from '@/contexts/NavigationContext';

export default function ChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    const {
        currentSession,
        isProcessing,
        processingState,
        canGenerateRecipes,
        canUseVoice,
        isAIReady,
        aiError,
        clearAIError,
        processVoiceInput,
        setProcessingState
    } = useAI();

    const { setChatBadgeCount } = useNavigation();

    // Initialize chat session and load messages
    useEffect(() => {
        if (currentSession) {
            loadChatMessages();
        }
    }, [currentSession]);

    const loadChatMessages = async () => {
        if (!currentSession) return;

        try {
            const sessionMessages = await chatService.getSessionMessages(currentSession.id);

            // If no messages exist, add welcome message
            if (sessionMessages.length === 0) {
                const welcomeMessage = await chatService.addMessage(
                    currentSession.id,
                    'assistant',
                    "Hi! I'm your AI cooking assistant. Tell me what ingredients you have, what you're craving, or ask me to create a recipe for you!"
                );
                setMessages([welcomeMessage]);
            } else {
                setMessages(sessionMessages);
            }
        } catch (error) {
            console.error('Failed to load chat messages:', error);
            // Add fallback welcome message
            const fallbackMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "Hi! I'm your AI cooking assistant. Tell me what ingredients you have, what you're craving, or ask me to create a recipe for you!",
                voice_input: false,
                created_at: new Date().toISOString()
            };
            setMessages([fallbackMessage]);
        }
    };

    const handleSendMessage = async (text?: string, voiceInput: boolean = false) => {
        const messageText = text || inputText.trim();
        if (!messageText || isProcessing || !currentSession) return;

        // Check if we can generate recipes
        if (!canGenerateRecipes) {
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "I'm sorry, recipe generation is currently unavailable. Please check your settings or try again later.",
                voice_input: false,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
            return;
        }

        setInputText('');

        try {
            // Process message using chat service with AI context integration
            const { userMsg, assistantMsg } = await chatService.processUserMessage(
                currentSession.id,
                messageText,
                voiceInput,
                (state) => setProcessingState(state)
            );

            // Update messages
            setMessages(prev => [...prev, userMsg, assistantMsg]);

            // Clear chat badge since user is actively using chat
            setChatBadgeCount(0);

        } catch (error) {
            console.error('Failed to process message:', error);

            // Add error message manually if chat service fails
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "I'm sorry, I encountered an error while processing your request. Please try again.",
                voice_input: false,
                created_at: new Date().toISOString()
            };

            setMessages(prev => [...prev, errorMessage]);
        }
    };

    const handleVoiceInput = async (transcript: string) => {
        if (transcript.trim()) {
            await processVoiceInput(transcript, currentSession?.id);
            // Reload messages after voice processing
            await loadChatMessages();
        }
    };

    const handleSaveRecipe = async (recipe: Recipe) => {
        try {
            // Recipe is already saved in the database by the chat service
            // Just show a confirmation message
            const confirmationMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession?.id || '',
                role: 'assistant',
                content: `Great! I've saved "${recipe.recipe_name}" to your recipe collection. You can find it in your recipe history.`,
                voice_input: false,
                created_at: new Date().toISOString()
            };

            setMessages(prev => [...prev, confirmationMessage]);
        } catch (error) {
            console.error('Failed to save recipe:', error);
        }
    };

    const handleModifyRecipe = async (recipe: Recipe, modificationRequest: string) => {
        if (!currentSession || isProcessing) return;

        try {
            // Add user modification request
            const userMessage = await chatService.addMessage(
                currentSession.id,
                'user',
                `Please modify the recipe: ${modificationRequest}`
            );

            setMessages(prev => [...prev, userMessage]);

            // Process modification using AI context
            const assistantMessage = await chatService.modifyRecipe(
                currentSession.id,
                recipe,
                modificationRequest,
                (state) => setProcessingState(state)
            );

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Failed to modify recipe:', error);

            // Add error message
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "I'm sorry, I couldn't modify the recipe right now. Please try again.",
                voice_input: false,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        }
    };

    const scrollToBottom = () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <ErrorBoundary>
            <LinearGradient
                colors={gradientColors}
                locations={gradientLocations}
                style={styles.container}
            >
                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
                    <BlurView intensity={30} tint="light" style={styles.header}>
                        <View style={styles.headerContent}>
                            <MessageCircle size={28} color="#fff" />
                            <View style={styles.headerInfo}>
                                <Text style={styles.headerTitle}>
                                    {isAIReady ? 'AI Recipe Chat' : 'Recipe Chat (Limited)'}
                                </Text>
                                <Text style={styles.headerSubtitle}>
                                    {isProcessing ? processingState.currentStep :
                                        !isAIReady ? 'AI services unavailable' :
                                            !canGenerateRecipes ? 'Recipe generation unavailable' :
                                                'Ask me anything about cooking!'}
                                </Text>
                            </View>
                            <ServiceStatusIndicator compact />
                        </View>
                    </BlurView>

                    {/* AI Error */}
                    {aiError && (
                        <BlurView intensity={20} tint="light" style={styles.errorBanner}>
                            <AlertTriangle size={16} color={colors.error} />
                            <Text style={styles.errorBannerText}>{aiError}</Text>
                            <TouchableOpacity onPress={clearAIError}>
                                <Text style={styles.dismissText}>Dismiss</Text>
                            </TouchableOpacity>
                        </BlurView>
                    )}

                    {/* Chat Messages */}
                    <KeyboardAvoidingView
                        style={styles.chatContainer}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                    >
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.messagesContainer}
                            contentContainerStyle={styles.messagesContent}
                            showsVerticalScrollIndicator={false}
                        >
                            <ChatInterface
                                messages={messages}
                                isProcessing={isProcessing}
                                processingState={processingState}
                                onSaveRecipe={handleSaveRecipe}
                                onModifyRecipe={handleModifyRecipe}
                                sessionId={currentSession?.id}
                            />
                        </ScrollView>

                        {/* Input Area */}
                        <BlurView intensity={30} tint="light" style={styles.inputContainer}>
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={styles.textInput}
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder="Ask me to create a recipe..."
                                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                                    multiline
                                    maxLength={500}
                                    editable={!isProcessing}
                                />

                                <View style={styles.buttonRow}>
                                    <VoiceRecordButton
                                        onTranscript={handleVoiceInput}
                                        disabled={isProcessing || !canUseVoice || !canGenerateRecipes}
                                        processingState={processingState}
                                    />

                                    <TouchableOpacity
                                        style={[
                                            styles.sendButton,
                                            (!inputText.trim() || isProcessing) && styles.sendButtonDisabled
                                        ]}
                                        onPress={() => handleSendMessage()}
                                        disabled={!inputText.trim() || isProcessing || !canGenerateRecipes}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Send size={20} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </BlurView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </LinearGradient>
        </ErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        ...glassStyles.glassHeader,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'space-between',
        width: '100%',
    },
    headerInfo: {
        flex: 1,
    },
    errorBanner: {
        ...glassStyles.glassCard,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 12,
    },
    errorBannerText: {
        flex: 1,
        color: colors.error,
        fontSize: 14,
        fontWeight: '500',
    },
    dismissText: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    chatContainer: {
        flex: 1,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 8,
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
    },
    textInput: {
        flex: 1,
        ...glassStyles.glassInput,
        maxHeight: 100,
        minHeight: 44,
        textAlignVertical: 'top',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
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
        backgroundColor: colors.glassLight,
        opacity: 0.5,
    },
});