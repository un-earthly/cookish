import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';
import { ChatMessage, Recipe } from '@/types/recipe';
import { ChatInterface } from '@/components/ChatInterface';
import { ChatComposer } from '@/components/ChatComposer';
import { ServiceStatusIndicator } from '@/components/ServiceStatusIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { chatService } from '@/services/chatService';
import { llamaService, LlamaModel } from '@/services/llamaService';
import { useAI } from '@/contexts/AIContext';
import { useNavigation } from '@/contexts/NavigationContext';

export default function ChatScreen() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedModel, setSelectedModel] = useState<LlamaModel | null>(null);
    const [isModelReady, setIsModelReady] = useState(false);
    const [useOfflineMode, setUseOfflineMode] = useState(false);
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
        setProcessingState,
        setIsProcessing
    } = useAI();

    const { setChatBadgeCount } = useNavigation();

    // Initialize model when selected
    useEffect(() => {
        if (selectedModel && !isModelReady) {
            initializeModel(selectedModel);
        }
    }, [selectedModel]);

    const initializeModel = async (model: LlamaModel) => {
        try {
            setIsProcessing(true);
            const success = await llamaService.initialize(model);
            setIsModelReady(success);

            if (success) {
                setUseOfflineMode(true);
                Alert.alert(
                    'Model Ready',
                    `${model.displayName} is now ready for offline use!`,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    'Model Error',
                    'Failed to initialize the model. Please try again.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Failed to initialize model:', error);
            Alert.alert('Error', 'Failed to initialize the model');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleModelSelect = async (model: LlamaModel) => {
        // Check if model is downloaded
        const isDownloaded = await llamaService.isModelDownloaded(model);

        if (!isDownloaded) {
            Alert.alert(
                'Model Not Downloaded',
                'Please download this model first before selecting it.',
                [{ text: 'OK' }]
            );
            return;
        }

        // If switching models, cleanup old one first
        if (selectedModel && selectedModel.id !== model.id) {
            await llamaService.cleanup();
            setIsModelReady(false);
        }

        setSelectedModel(model);
    };

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

    const handleSendMessage = async (messageText: string) => {
        if (!messageText || isProcessing || !currentSession) return;

        // Determine if using offline or online mode
        const useOffline = useOfflineMode && isModelReady && selectedModel;

        // Check if we can generate recipes (online mode)
        if (!useOffline && !canGenerateRecipes) {
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "I'm sorry, recipe generation is currently unavailable. Please select an offline model or check your settings.",
                voice_input: false,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
            return;
        }

        try {
            // Add user message
            const userMsg = await chatService.addMessage(
                currentSession.id,
                'user',
                messageText
            );
            setMessages(prev => [...prev, userMsg]);

            setIsProcessing(true);
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: useOffline ? 'Processing with offline model...' : 'Generating recipe...'
            });

            let responseText: string;

            if (useOffline) {
                // Use offline LLM
                responseText = await llamaService.streamCompletion(
                    [
                        {
                            role: 'system',
                            content: 'You are a helpful cooking assistant. Create recipes based on user requests. Be concise and friendly.'
                        },
                        {
                            role: 'user',
                            content: messageText
                        }
                    ],
                    (token) => {
                        // Stream tokens in real-time
                        console.log('Token:', token);
                    }
                );
            } else {
                // Use online service through chat service
                const { assistantMsg } = await chatService.processUserMessage(
                    currentSession.id,
                    messageText,
                    false,
                    (state) => setProcessingState(state)
                );
                responseText = assistantMsg.content;
            }

            // Add assistant message
            const assistantMsg = await chatService.addMessage(
                currentSession.id,
                'assistant',
                responseText
            );

            setMessages(prev => [...prev, assistantMsg]);

            // Clear chat badge since user is actively using chat
            setChatBadgeCount(0);

        } catch (error) {
            console.error('Failed to process message:', error);

            // Add error message
            const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}`,
                session_id: currentSession.id,
                role: 'assistant',
                content: "I'm sorry, I encountered an error while processing your request. Please try again.",
                voice_input: false,
                created_at: new Date().toISOString()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
            setProcessingState({
                isListening: false,
                isTranscribing: false,
                isGenerating: false,
                currentStep: ''
            });
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

                    {/* Mode Indicator */}
                    {useOfflineMode && isModelReady && (
                        <BlurView intensity={20} tint="light" style={styles.modeBanner}>
                            <WifiOff size={16} color={colors.primary} />
                            <Text style={styles.modeBannerText}>
                                Offline Mode: {selectedModel?.displayName}
                            </Text>
                        </BlurView>
                    )}

                    {!useOfflineMode && isAIReady && (
                        <BlurView intensity={20} tint="light" style={styles.modeBanner}>
                            <Wifi size={16} color={colors.primary} />
                            <Text style={styles.modeBannerText}>Online Mode</Text>
                        </BlurView>
                    )}

                    {/* Chat Messages */}
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

                    {/* Chat Composer */}
                    <ChatComposer
                        onSend={handleSendMessage}
                        onVoicePress={canUseVoice ? () => handleVoiceInput('') : undefined}
                        selectedModel={selectedModel}
                        onModelSelect={handleModelSelect}
                        disabled={isProcessing}
                        showVoiceButton={canUseVoice}
                        showModelSelector={true}
                        placeholder={
                            useOfflineMode
                                ? 'Chat with offline AI...'
                                : 'Ask me to create a recipe...'
                        }
                    />
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
    modeBanner: {
        ...glassStyles.glassCard,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 8,
        padding: 10,
    },
    modeBannerText: {
        flex: 1,
        color: colors.primary,
        fontSize: 13,
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
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 8,
    },
});