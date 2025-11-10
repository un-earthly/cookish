import { supabase } from '@/lib/supabase';
import {
    ChatSession,
    ChatMessage,
    Recipe,
    RecipeRequest,
    ProcessingState
} from '@/types/recipe';
import { AIRouterService } from '@/services/aiRouterService';
import { generateChatRecipe } from '@/services/recipeService';

export class ChatService {
    private static instance: ChatService;
    private aiRouter: AIRouterService;
    private currentSession: ChatSession | null = null;

    private constructor() {
        this.aiRouter = AIRouterService.getInstance();
    }

    static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    /**
     * Create a new chat session
     */
    async createSession(): Promise<ChatSession> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
            .from('chat_sessions')
            .insert({
                user_id: user.id,
                started_at: new Date().toISOString(),
                last_activity: new Date().toISOString(),
                message_count: 0,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        this.currentSession = data;
        return data;
    }

    /**
     * Get existing chat sessions for the user
     */
    async getUserSessions(limit: number = 20): Promise<ChatSession[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('last_activity', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Get messages for a specific session
     */
    async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('chat_messages')
            .select(`
        *,
        recipe:recipe_id (*)
      `)
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Add a message to the current session
     */
    async addMessage(
        sessionId: string,
        role: 'user' | 'assistant',
        content: string,
        voiceInput: boolean = false,
        recipeId?: string
    ): Promise<ChatMessage> {
        const startTime = Date.now();

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                session_id: sessionId,
                role,
                content,
                voice_input: voiceInput,
                recipe_id: recipeId,
                processing_time: role === 'assistant' ? Date.now() - startTime : null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Update session activity (this will be handled by the database trigger)
        return data;
    }

    /**
     * Process user message and generate AI response
     */
    async processUserMessage(
        sessionId: string,
        userMessage: string,
        voiceInput: boolean = false,
        onProgress?: (state: ProcessingState) => void
    ): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
        // Add user message first
        const userMsg = await this.addMessage(sessionId, 'user', userMessage, voiceInput);

        try {
            // Initialize AI router
            await this.aiRouter.initialize();

            // Update progress
            onProgress?.({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Analyzing your request...'
            });

            // Check request type and route accordingly
            const requestType = this.analyzeRequestType(userMessage);

            switch (requestType.type) {
                case 'recipe_modification':
                    return await this.processRecipeModification(
                        sessionId,
                        userMessage,
                        requestType.targetRecipeId,
                        onProgress
                    );

                case 'recipe_generation':
                    return await this.handleRecipeRequest(sessionId, userMessage, onProgress);

                case 'general_chat':
                default:
                    return await this.handleGeneralChat(sessionId, userMessage, userMsg, onProgress);
            }

        } catch (error) {
            console.error('Failed to process user message:', error);

            const errorMsg = await this.addMessage(
                sessionId,
                'assistant',
                "I'm sorry, I encountered an error while processing your request. Please try again or rephrase your question."
            );

            return { userMsg, assistantMsg: errorMsg };
        }
    }

    /**
     * Analyze user message to determine request type
     */
    private analyzeRequestType(message: string): {
        type: 'recipe_generation' | 'recipe_modification' | 'general_chat';
        targetRecipeId?: string;
        confidence: number;
    } {
        const lowerMessage = message.toLowerCase();

        // Check for modification keywords
        const modificationKeywords = [
            'modify', 'change', 'update', 'edit', 'alter', 'adjust',
            'make it', 'can you make', 'substitute', 'replace',
            'add more', 'less', 'remove', 'without', 'instead of',
            'spicier', 'milder', 'healthier', 'vegan', 'gluten-free'
        ];

        const hasModificationKeywords = modificationKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );

        // Check for recipe generation keywords
        const recipeKeywords = [
            'recipe', 'cook', 'make', 'prepare', 'ingredients', 'dish', 'meal',
            'breakfast', 'lunch', 'dinner', 'snack', 'bake', 'fry', 'grill',
            'how to make', 'want to cook', 'something with', 'using', 'have'
        ];

        const hasRecipeKeywords = recipeKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );

        // Determine request type based on context and keywords
        if (hasModificationKeywords && hasRecipeKeywords) {
            return {
                type: 'recipe_modification',
                confidence: 0.9
            };
        } else if (hasModificationKeywords) {
            return {
                type: 'recipe_modification',
                confidence: 0.7
            };
        } else if (hasRecipeKeywords) {
            return {
                type: 'recipe_generation',
                confidence: 0.8
            };
        } else {
            return {
                type: 'general_chat',
                confidence: 0.6
            };
        }
    }

    /**
     * Handle recipe generation requests
     */
    private async handleRecipeRequest(
        sessionId: string,
        userMessage: string,
        onProgress?: (state: ProcessingState) => void
    ): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
        onProgress?.({
            isListening: false,
            isTranscribing: false,
            isGenerating: true,
            currentStep: 'Creating your recipe...'
        });

        // Build recipe request
        const request: RecipeRequest = {
            prompt: userMessage,
            sessionId: sessionId
        };

        // Generate recipe using AI router
        const recipeData = await this.aiRouter.generateRecipe(request);

        onProgress?.({
            isListening: false,
            isTranscribing: false,
            isGenerating: true,
            currentStep: 'Saving recipe and fetching image...'
        });

        // Save recipe to database using existing service
        const recipe = await generateChatRecipe(userMessage, sessionId);

        // Create response message
        const responseText = this.buildRecipeResponseText(recipe, userMessage);

        const assistantMsg = await this.addMessage(
            sessionId,
            'assistant',
            responseText,
            false,
            recipe.id
        );

        // Attach recipe to message for UI
        assistantMsg.recipe = recipe;

        const userMsg = await this.getLastUserMessage(sessionId);
        return { userMsg, assistantMsg };
    }

    /**
     * Handle general chat (non-recipe requests)
     */
    private async handleGeneralChat(
        sessionId: string,
        userMessage: string,
        userMsg: ChatMessage,
        onProgress?: (state: ProcessingState) => void
    ): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
        onProgress?.({
            isListening: false,
            isTranscribing: false,
            isGenerating: true,
            currentStep: 'Thinking about your question...'
        });

        // Generate contextual response
        const response = await this.generateChatResponse(userMessage, sessionId);

        const assistantMsg = await this.addMessage(sessionId, 'assistant', response);

        return { userMsg, assistantMsg };
    }

    /**
     * Determine if user message is requesting a recipe
     */
    private isRecipeRequest(message: string): boolean {
        const recipeKeywords = [
            'recipe', 'cook', 'make', 'prepare', 'ingredients', 'dish', 'meal',
            'breakfast', 'lunch', 'dinner', 'snack', 'bake', 'fry', 'grill',
            'how to make', 'want to cook', 'something with', 'using', 'have'
        ];

        const lowerMessage = message.toLowerCase();
        return recipeKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Generate contextual chat response
     */
    private async generateChatResponse(message: string, sessionId: string): Promise<string> {
        // Get recent conversation context
        const recentMessages = await this.getRecentMessages(sessionId, 5);

        // Simple rule-based responses for common queries
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            return "Hello! I'm your AI cooking assistant. I can help you create recipes, suggest meals based on ingredients you have, or answer cooking questions. What would you like to cook today?";
        }

        if (lowerMessage.includes('help')) {
            return "I can help you with:\n• Creating recipes from ingredients you have\n• Suggesting meals for specific dietary needs\n• Cooking tips and techniques\n• Meal planning ideas\n\nJust tell me what ingredients you have or what you're craving!";
        }

        if (lowerMessage.includes('thank')) {
            return "You're welcome! I'm here whenever you need cooking inspiration. Feel free to ask me about any recipes or cooking questions!";
        }

        // Default response encouraging recipe creation
        return "I'd love to help you with cooking! Try telling me what ingredients you have available, or describe what kind of meal you're in the mood for, and I'll create a personalized recipe for you.";
    }

    /**
     * Get recent messages for context
     */
    private async getRecentMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return (data || []).reverse(); // Return in chronological order
    }

    /**
     * Get the last user message from session
     */
    private async getLastUserMessage(sessionId: string): Promise<ChatMessage> {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Build response text for recipe generation
     */
    private buildRecipeResponseText(recipe: Recipe, originalRequest: string): string {
        const responses = [
            `Perfect! I've created "${recipe.recipe_name}" based on your request. This ${recipe.difficulty?.toLowerCase() || 'delicious'} recipe serves ${recipe.servings} and takes about ${recipe.prep_time + recipe.cook_time} minutes total.`,

            `Great choice! Here's "${recipe.recipe_name}" - a ${recipe.cuisine_type?.toLowerCase() || 'tasty'} dish that's perfect for what you described. It's ${recipe.difficulty?.toLowerCase() || 'easy'} to make and serves ${recipe.servings}.`,

            `I've got just the thing! "${recipe.recipe_name}" is exactly what you're looking for. This ${recipe.difficulty?.toLowerCase() || 'wonderful'} recipe will be ready in ${recipe.prep_time + recipe.cook_time} minutes.`
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        let additionalInfo = '';

        if (recipe.tags && recipe.tags.length > 0) {
            additionalInfo += ` It's ${recipe.tags.slice(0, 2).join(' and ')}.`;
        }

        if (recipe.estimated_cost) {
            additionalInfo += ` Estimated cost: $${recipe.estimated_cost.toFixed(2)}.`;
        }

        return randomResponse + additionalInfo + "\n\nWould you like me to modify anything about this recipe or create something different?";
    }

    /**
     * Modify an existing recipe based on user feedback with context awareness
     */
    async modifyRecipe(
        sessionId: string,
        originalRecipe: Recipe,
        modificationRequest: string,
        onProgress?: (state: ProcessingState) => void
    ): Promise<ChatMessage> {
        try {
            onProgress?.({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Analyzing your modification request...'
            });

            // Import variation service
            const { variationService } = await import('@/services/variationService');

            // Check if this is a context-aware modification request
            const contextualRequest = await this.buildContextualModificationRequest(
                sessionId,
                originalRecipe,
                modificationRequest
            );

            onProgress?.({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Creating recipe variation...'
            });

            // Create recipe variation with explanation
            const { variation, explanation } = await variationService.createRecipeVariation(
                originalRecipe.id,
                contextualRequest,
                sessionId
            );

            onProgress?.({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Preparing response...'
            });

            // Build comprehensive response with explanation
            const responseText = this.buildModificationResponseText(
                originalRecipe,
                variation,
                explanation,
                modificationRequest
            );

            // Save the modified recipe as a new recipe entry for easy access
            const modifiedRecipe = await this.saveVariationAsNewRecipe(variation);

            const assistantMsg = await this.addMessage(
                sessionId,
                'assistant',
                responseText,
                false,
                modifiedRecipe.id
            );

            // Attach the modified recipe to the message for UI display
            assistantMsg.recipe = modifiedRecipe;

            return assistantMsg;

        } catch (error) {
            console.error('Failed to modify recipe:', error);

            return await this.addMessage(
                sessionId,
                'assistant',
                "I'm sorry, I couldn't modify the recipe right now. Could you try rephrasing your request or ask me to create a new recipe instead?"
            );
        }
    }

    /**
     * Process conversational recipe modification with enhanced context awareness
     */
    async processRecipeModification(
        sessionId: string,
        userMessage: string,
        targetRecipeId?: string,
        onProgress?: (state: ProcessingState) => void
    ): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
        // Add user message first
        const userMsg = await this.addMessage(sessionId, 'user', userMessage, false);

        try {
            onProgress?.({
                isListening: false,
                isTranscribing: false,
                isGenerating: true,
                currentStep: 'Understanding your modification request...'
            });

            // Determine which recipe to modify
            const targetRecipe = await this.identifyTargetRecipe(sessionId, targetRecipeId, userMessage);

            if (!targetRecipe) {
                const errorMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "I couldn't identify which recipe you'd like to modify. Could you please specify the recipe name or ask me to create a new recipe instead?"
                );
                return { userMsg, assistantMsg: errorMsg };
            }

            // Check if this is a simple modification or requires confirmation
            const modificationAnalysis = await this.analyzeModificationRequest(
                userMessage,
                targetRecipe,
                sessionId
            );

            if (modificationAnalysis.requiresConfirmation) {
                const confirmationMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    modificationAnalysis.confirmationMessage
                );
                return { userMsg, assistantMsg: confirmationMsg };
            }

            // Process the modification
            const assistantMsg = await this.modifyRecipe(
                sessionId,
                targetRecipe,
                userMessage,
                onProgress
            );

            return { userMsg, assistantMsg };

        } catch (error) {
            console.error('Failed to process recipe modification:', error);

            const errorMsg = await this.addMessage(
                sessionId,
                'assistant',
                "I encountered an error while processing your modification request. Please try again or rephrase your request."
            );

            return { userMsg, assistantMsg: errorMsg };
        }
    }

    /**
     * Identify which recipe the user wants to modify based on context
     */
    private async identifyTargetRecipe(
        sessionId: string,
        explicitRecipeId?: string,
        userMessage?: string
    ): Promise<Recipe | null> {
        // If explicit recipe ID provided, use that
        if (explicitRecipeId) {
            const { data: recipe } = await supabase
                .from('daily_recipes')
                .select('*')
                .eq('id', explicitRecipeId)
                .single();
            return recipe;
        }

        // Get recent messages to find the most recent recipe
        const recentMessages = await this.getRecentMessages(sessionId, 10);

        // Look for the most recent message with a recipe
        for (let i = recentMessages.length - 1; i >= 0; i--) {
            const message = recentMessages[i];
            if (message.recipe_id) {
                const { data: recipe } = await supabase
                    .from('daily_recipes')
                    .select('*')
                    .eq('id', message.recipe_id)
                    .single();
                if (recipe) return recipe;
            }
        }

        // If user message contains recipe name, try to find it
        if (userMessage) {
            const recipeName = this.extractRecipeNameFromMessage(userMessage);
            if (recipeName) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: recipes } = await supabase
                        .from('daily_recipes')
                        .select('*')
                        .eq('user_id', user.id)
                        .ilike('recipe_name', `%${recipeName}%`)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (recipes && recipes.length > 0) {
                        return recipes[0];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Extract recipe name from user message
     */
    private extractRecipeNameFromMessage(message: string): string | null {
        const lowerMessage = message.toLowerCase();

        // Look for patterns like "modify the chicken curry" or "change the pasta recipe"
        const patterns = [
            /modify (?:the )?(.+?)(?:\s|$)/i,
            /change (?:the )?(.+?)(?:\s|$)/i,
            /update (?:the )?(.+?)(?:\s|$)/i,
            /edit (?:the )?(.+?)(?:\s|$)/i,
            /for (?:the )?(.+?)(?:\s|,|$)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                const recipeName = match[1].trim();
                // Filter out common words that aren't recipe names
                const stopWords = ['recipe', 'dish', 'meal', 'food', 'it', 'this', 'that'];
                if (!stopWords.includes(recipeName.toLowerCase()) && recipeName.length > 2) {
                    return recipeName;
                }
            }
        }

        return null;
    }

    /**
     * Analyze modification request to determine if confirmation is needed
     */
    private async analyzeModificationRequest(
        userMessage: string,
        targetRecipe: Recipe,
        sessionId: string
    ): Promise<{
        requiresConfirmation: boolean;
        confirmationMessage: string;
        modificationComplexity: 'simple' | 'moderate' | 'complex';
    }> {
        const lowerMessage = userMessage.toLowerCase();

        // Check for major changes that might require confirmation
        const majorChangeKeywords = [
            'completely different', 'totally change', 'make it into',
            'change the cuisine', 'different protein', 'different cooking method'
        ];

        const hasMajorChanges = majorChangeKeywords.some(keyword =>
            lowerMessage.includes(keyword)
        );

        // Check for dietary restriction changes
        const dietaryChanges = [
            'make it vegan', 'make it vegetarian', 'remove dairy', 'gluten-free',
            'make it keto', 'low-carb', 'dairy-free'
        ];

        const hasDietaryChanges = dietaryChanges.some(change =>
            lowerMessage.includes(change)
        );

        // Check for ingredient substitutions
        const hasSubstitutions = lowerMessage.includes('substitute') ||
            lowerMessage.includes('replace') ||
            lowerMessage.includes('instead of');

        let modificationComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
        let requiresConfirmation = false;
        let confirmationMessage = '';

        if (hasMajorChanges) {
            modificationComplexity = 'complex';
            requiresConfirmation = true;
            confirmationMessage = `I understand you want to make significant changes to "${targetRecipe.recipe_name}". This might result in a very different recipe. Would you like me to proceed with these major modifications, or would you prefer I create a new recipe inspired by your request?`;
        } else if (hasDietaryChanges) {
            modificationComplexity = 'moderate';
            // Don't require confirmation for dietary changes, but note them
        } else if (hasSubstitutions) {
            modificationComplexity = 'moderate';
        }

        return {
            requiresConfirmation,
            confirmationMessage,
            modificationComplexity
        };
    }

    /**
     * Build contextual modification request using conversation history
     */
    private async buildContextualModificationRequest(
        sessionId: string,
        originalRecipe: Recipe,
        modificationRequest: string
    ): Promise<string> {
        // Get recent conversation context
        const recentMessages = await this.getRecentMessages(sessionId, 15);

        // Analyze conversation context
        const conversationContext = this.analyzeConversationContext(recentMessages);

        // Get user preferences for additional context
        const { data: { user } } = await supabase.auth.getUser();
        let userPreferences = null;
        if (user) {
            const { data } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
            userPreferences = data;
        }

        // Build comprehensive contextual request
        let contextualRequest = modificationRequest;

        // Add conversation context
        if (conversationContext.dietaryMentions.length > 0) {
            contextualRequest += `\n\nDietary Context: During our conversation, you've mentioned: ${conversationContext.dietaryMentions.join(', ')}. Please ensure the modification respects these preferences.`;
        }

        if (conversationContext.cookingPreferences.length > 0) {
            contextualRequest += `\n\nCooking Preferences: You've expressed preferences for: ${conversationContext.cookingPreferences.join(', ')}.`;
        }

        if (conversationContext.previousModifications.length > 0) {
            contextualRequest += `\n\nModification History: This is part of an ongoing conversation where you've made these changes: ${conversationContext.previousModifications.slice(-3).join('; ')}.`;
        }

        if (conversationContext.ingredientPreferences.length > 0) {
            contextualRequest += `\n\nIngredient Preferences: You've mentioned liking/disliking: ${conversationContext.ingredientPreferences.join(', ')}.`;
        }

        // Add user profile context if available
        if (userPreferences) {
            if (userPreferences.dietary_restrictions && userPreferences.dietary_restrictions.length > 0) {
                contextualRequest += `\n\nUser Profile: Your dietary restrictions include ${userPreferences.dietary_restrictions.join(', ')}.`;
            }

            if (userPreferences.cooking_skill_level) {
                contextualRequest += ` Your cooking skill level is ${userPreferences.cooking_skill_level}.`;
            }

            if (userPreferences.preferred_cuisines && userPreferences.preferred_cuisines.length > 0) {
                contextualRequest += ` You prefer ${userPreferences.preferred_cuisines.join(', ')} cuisines.`;
            }
        }

        // Add recipe context
        contextualRequest += `\n\nOriginal Recipe Context: "${originalRecipe.recipe_name}" is a ${originalRecipe.difficulty || 'medium'} difficulty ${originalRecipe.cuisine_type || 'recipe'} that serves ${originalRecipe.servings} and takes ${(originalRecipe.prep_time || 0) + (originalRecipe.cook_time || 0)} minutes total.`;

        return contextualRequest;
    }

    /**
     * Analyze conversation context to extract relevant information
     */
    private analyzeConversationContext(messages: ChatMessage[]): {
        dietaryMentions: string[];
        cookingPreferences: string[];
        previousModifications: string[];
        ingredientPreferences: string[];
        spicePreferences: string[];
        timeConstraints: string[];
    } {
        const context = {
            dietaryMentions: [] as string[],
            cookingPreferences: [] as string[],
            previousModifications: [] as string[],
            ingredientPreferences: [] as string[],
            spicePreferences: [] as string[],
            timeConstraints: [] as string[]
        };

        messages.forEach(message => {
            const content = message.content.toLowerCase();

            // Extract dietary restrictions
            const dietaryPatterns = [
                { pattern: /\b(vegan|plant.based)\b/i, mention: 'vegan preferences' },
                { pattern: /\bvegetarian\b/i, mention: 'vegetarian preferences' },
                { pattern: /\bgluten.free\b/i, mention: 'gluten-free requirement' },
                { pattern: /\bdairy.free\b/i, mention: 'dairy-free requirement' },
                { pattern: /\bnut.free\b/i, mention: 'nut-free requirement' },
                { pattern: /\bketo\b/i, mention: 'keto diet' },
                { pattern: /\bpaleo\b/i, mention: 'paleo diet' },
                { pattern: /\blow.carb\b/i, mention: 'low-carb preference' },
                { pattern: /\blow.sodium\b/i, mention: 'low-sodium requirement' }
            ];

            dietaryPatterns.forEach(({ pattern, mention }) => {
                if (pattern.test(content) && !context.dietaryMentions.includes(mention)) {
                    context.dietaryMentions.push(mention);
                }
            });

            // Extract cooking preferences
            const cookingPatterns = [
                { pattern: /\bquick\b|\bfast\b|\beasy\b/i, preference: 'quick and easy cooking' },
                { pattern: /\bhealthy\b|\bnutritious\b/i, preference: 'healthy cooking' },
                { pattern: /\bcomfort.food\b/i, preference: 'comfort food' },
                { pattern: /\bfresh\b|\bseasonal\b/i, preference: 'fresh/seasonal ingredients' },
                { pattern: /\bbudget\b|\bcheap\b|\binexpensive\b/i, preference: 'budget-friendly' }
            ];

            cookingPatterns.forEach(({ pattern, preference }) => {
                if (pattern.test(content) && !context.cookingPreferences.includes(preference)) {
                    context.cookingPreferences.push(preference);
                }
            });

            // Extract spice preferences
            const spicePatterns = [
                { pattern: /\bspicy\b|\bhot\b|\bspicier\b/i, preference: 'likes spicy food' },
                { pattern: /\bmild\b|\bless.spicy\b|\bnot.spicy\b/i, preference: 'prefers mild flavors' }
            ];

            spicePatterns.forEach(({ pattern, preference }) => {
                if (pattern.test(content) && !context.spicePreferences.includes(preference)) {
                    context.spicePreferences.push(preference);
                }
            });

            // Extract time constraints
            const timePatterns = [
                { pattern: /\b15.min\b|\bfifteen.minutes\b/i, constraint: '15-minute meals' },
                { pattern: /\b30.min\b|\bthirty.minutes\b|\bhalf.hour\b/i, constraint: '30-minute meals' },
                { pattern: /\bno.time\b|\bin.a.hurry\b|\bquickly\b/i, constraint: 'time-pressed cooking' }
            ];

            timePatterns.forEach(({ pattern, constraint }) => {
                if (pattern.test(content) && !context.timeConstraints.includes(constraint)) {
                    context.timeConstraints.push(constraint);
                }
            });

            // Track previous modifications (user messages only)
            if (message.role === 'user') {
                const modificationPatterns = [
                    /modify.*?to (.*?)(?:\.|$)/i,
                    /change.*?to (.*?)(?:\.|$)/i,
                    /make it (.*?)(?:\.|$)/i,
                    /substitute.*?with (.*?)(?:\.|$)/i,
                    /replace.*?with (.*?)(?:\.|$)/i
                ];

                modificationPatterns.forEach(pattern => {
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        const modification = match[1].trim();
                        if (modification.length > 2 && !context.previousModifications.includes(modification)) {
                            context.previousModifications.push(modification);
                        }
                    }
                });
            }

            // Extract ingredient preferences
            const ingredientPatterns = [
                /love (.*?)(?:\s|,|\.)/i,
                /like (.*?)(?:\s|,|\.)/i,
                /hate (.*?)(?:\s|,|\.)/i,
                /don't like (.*?)(?:\s|,|\.)/i,
                /allergic to (.*?)(?:\s|,|\.)/i
            ];

            ingredientPatterns.forEach(pattern => {
                const match = content.match(pattern);
                if (match && match[1]) {
                    const ingredient = match[1].trim();
                    if (ingredient.length > 2 && !context.ingredientPreferences.includes(ingredient)) {
                        context.ingredientPreferences.push(ingredient);
                    }
                }
            });
        });

        return context;
    }

    /**
     * Build comprehensive response text for recipe modification
     */
    private buildModificationResponseText(
        originalRecipe: Recipe,
        variation: any,
        explanation: any,
        originalRequest: string
    ): string {
        const modifiedRecipe = variation.recipe_data;

        let response = `Great! I've successfully modified "${originalRecipe.recipe_name}" based on your request.\n\n`;

        response += `**🍽️ ${variation.variation_name}**\n\n`;

        // Add a summary of what changed
        response += `**📝 What I Changed:**\n`;
        if (explanation.changes_made && explanation.changes_made.length > 0) {
            explanation.changes_made.forEach((change: string, index: number) => {
                response += `${index + 1}. ${change}\n`;
            });
        } else {
            response += `Applied your requested modifications to create this variation.\n`;
        }
        response += '\n';

        // Add reasoning with better formatting
        if (explanation.reasoning && explanation.reasoning.length > 0) {
            response += `**🧠 Why These Changes Work:**\n`;
            explanation.reasoning.forEach((reason: string) => {
                response += `• ${reason}\n`;
            });
            response += '\n';
        }

        // Add impact information with emojis for better readability
        const impacts = [];

        if (explanation.impact_on_nutrition) {
            impacts.push(`**🥗 Nutrition:** ${explanation.impact_on_nutrition}`);
        }

        if (explanation.impact_on_cooking_time) {
            impacts.push(`**⏱️ Timing:** ${explanation.impact_on_cooking_time}`);
        }

        if (explanation.impact_on_difficulty) {
            impacts.push(`**👨‍🍳 Difficulty:** ${explanation.impact_on_difficulty}`);
        }

        if (impacts.length > 0) {
            response += `**📊 Impact Summary:**\n`;
            impacts.forEach(impact => {
                response += `${impact}\n`;
            });
            response += '\n';
        }

        // Add recipe summary
        const totalTime = (modifiedRecipe.prep_time || 0) + (modifiedRecipe.cook_time || 0);
        response += `**📋 Recipe Summary:**\n`;
        response += `• Serves: ${modifiedRecipe.servings} people\n`;
        response += `• Total time: ${totalTime} minutes\n`;
        response += `• Difficulty: ${modifiedRecipe.difficulty || 'Medium'}\n`;

        if (modifiedRecipe.estimated_cost) {
            response += `• Estimated cost: $${modifiedRecipe.estimated_cost.toFixed(2)}\n`;
        }
        response += '\n';

        // Add helpful suggestions
        if (explanation.suggestions && explanation.suggestions.length > 0) {
            response += `**💡 Pro Tips:**\n`;
            explanation.suggestions.forEach((suggestion: string) => {
                response += `• ${suggestion}\n`;
            });
            response += '\n';
        }

        // Add contextual follow-up options
        response += `**What's Next?**\n`;
        response += `• Say "save this recipe" to add it to your collection\n`;
        response += `• Ask me to modify it further (e.g., "make it spicier")\n`;
        response += `• Request variations (e.g., "show me a vegetarian version")\n`;
        response += `• Ask "compare versions" to see differences from the original\n\n`;

        response += `Is there anything else you'd like me to adjust about this recipe?`;

        return response;
    }

    /**
     * Generate confirmation message for complex modifications
     */
    private generateModificationConfirmation(
        originalRecipe: Recipe,
        modificationRequest: string,
        analysisResult: any
    ): string {
        let confirmation = `I understand you want to modify "${originalRecipe.recipe_name}". `;

        if (analysisResult.modificationComplexity === 'complex') {
            confirmation += `This appears to be a significant change that might result in a quite different recipe. `;
        }

        confirmation += `Here's what I plan to do:\n\n`;

        // Add predicted changes based on the request
        const predictedChanges = this.predictModificationChanges(modificationRequest);
        predictedChanges.forEach((change, index) => {
            confirmation += `${index + 1}. ${change}\n`;
        });

        confirmation += `\nWould you like me to proceed with these modifications, or would you prefer me to:\n`;
        confirmation += `• Make smaller, incremental changes\n`;
        confirmation += `• Create a completely new recipe inspired by your request\n`;
        confirmation += `• Suggest alternative approaches\n\n`;
        confirmation += `Just let me know how you'd like to proceed!`;

        return confirmation;
    }

    /**
     * Predict what changes will be made based on modification request
     */
    private predictModificationChanges(modificationRequest: string): string[] {
        const lowerRequest = modificationRequest.toLowerCase();
        const changes: string[] = [];

        // Predict dietary changes
        if (lowerRequest.includes('vegan')) {
            changes.push('Replace all animal products with plant-based alternatives');
        }
        if (lowerRequest.includes('gluten-free')) {
            changes.push('Substitute gluten-containing ingredients with gluten-free options');
        }
        if (lowerRequest.includes('dairy-free')) {
            changes.push('Remove dairy products and suggest non-dairy substitutes');
        }

        // Predict spice level changes
        if (lowerRequest.includes('spicier') || lowerRequest.includes('more spicy')) {
            changes.push('Increase spice levels and add heat-generating ingredients');
        }
        if (lowerRequest.includes('milder') || lowerRequest.includes('less spicy')) {
            changes.push('Reduce or remove spicy ingredients');
        }

        // Predict ingredient substitutions
        if (lowerRequest.includes('substitute') || lowerRequest.includes('replace')) {
            changes.push('Make the requested ingredient substitutions');
        }

        // Predict cooking method changes
        if (lowerRequest.includes('bake') || lowerRequest.includes('oven')) {
            changes.push('Adapt cooking method for oven/baking');
        }
        if (lowerRequest.includes('grill')) {
            changes.push('Modify recipe for grilling');
        }

        // Predict health modifications
        if (lowerRequest.includes('healthy') || lowerRequest.includes('lighter')) {
            changes.push('Reduce calories and increase nutritional value');
        }

        // Default prediction if no specific patterns found
        if (changes.length === 0) {
            changes.push('Apply your requested modifications while maintaining recipe integrity');
            changes.push('Adjust cooking times and techniques as needed');
        }

        return changes;
    }

    /**
     * Save variation as a new recipe for easy access
     */
    private async saveVariationAsNewRecipe(variation: any): Promise<Recipe> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const recipeData = variation.recipe_data;

        const { data: newRecipe, error } = await supabase
            .from('daily_recipes')
            .insert({
                user_id: user.id,
                recipe_date: new Date().toISOString().split('T')[0],
                meal_type: 'dinner', // Default meal type
                ...recipeData,
                created_via: 'chat',
                chat_session_id: variation.chat_session_id
            })
            .select()
            .single();

        if (error) throw error;
        return newRecipe;
    }

    /**
     * Update session title based on conversation
     */
    async updateSessionTitle(sessionId: string, title: string): Promise<void> {
        const { error } = await supabase
            .from('chat_sessions')
            .update({ title })
            .eq('id', sessionId);

        if (error) throw error;
    }

    /**
     * Mark session as inactive
     */
    async endSession(sessionId: string): Promise<void> {
        const { error } = await supabase
            .from('chat_sessions')
            .update({
                is_active: false,
                last_activity: new Date().toISOString()
            })
            .eq('id', sessionId);

        if (error) throw error;
    }

    /**
     * Delete a chat session and all its messages
     */
    async deleteSession(sessionId: string): Promise<void> {
        // Messages will be deleted automatically due to CASCADE
        const { error } = await supabase
            .from('chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) throw error;
    }

    /**
     * Get current session
     */
    getCurrentSession(): ChatSession | null {
        return this.currentSession;
    }

    /**
     * Set current session
     */
    setCurrentSession(session: ChatSession): void {
        this.currentSession = session;
    }

    /**
     * Search messages across all sessions
     */
    async searchMessages(query: string, limit: number = 50): Promise<ChatMessage[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('chat_messages')
            .select(`
        *,
        chat_sessions!inner (user_id)
      `)
            .eq('chat_sessions.user_id', user.id)
            .ilike('content', `%${query}%`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return data || [];
    }

    /**
     * Handle confirmation responses for recipe modifications
     */
    async handleModificationConfirmation(
        sessionId: string,
        userResponse: string,
        onProgress?: (state: ProcessingState) => void
    ): Promise<{ userMsg: ChatMessage; assistantMsg: ChatMessage }> {
        const userMsg = await this.addMessage(sessionId, 'user', userResponse, false);

        try {
            const lowerResponse = userResponse.toLowerCase();

            // Check if user confirmed the modification
            const confirmationKeywords = ['yes', 'proceed', 'go ahead', 'continue', 'do it', 'sure', 'okay', 'ok'];
            const rejectionKeywords = ['no', 'cancel', 'stop', 'different', 'new recipe', 'alternative'];

            const isConfirmed = confirmationKeywords.some(keyword => lowerResponse.includes(keyword));
            const isRejected = rejectionKeywords.some(keyword => lowerResponse.includes(keyword));

            if (isConfirmed) {
                // User confirmed - proceed with the modification
                const targetRecipe = await this.identifyTargetRecipe(sessionId);
                if (targetRecipe) {
                    // Get the original modification request from recent messages
                    const recentMessages = await this.getRecentMessages(sessionId, 5);
                    const originalRequest = this.extractOriginalModificationRequest(recentMessages);

                    if (originalRequest) {
                        const assistantMsg = await this.modifyRecipe(
                            sessionId,
                            targetRecipe,
                            originalRequest,
                            onProgress
                        );
                        return { userMsg, assistantMsg };
                    }
                }

                const errorMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "I'm sorry, I couldn't find the original modification request. Could you please repeat what you'd like me to change?"
                );
                return { userMsg, assistantMsg: errorMsg };

            } else if (isRejected || lowerResponse.includes('new recipe')) {
                // User wants a new recipe instead
                const assistantMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "No problem! I'll create a completely new recipe for you instead. What kind of dish are you in the mood for?"
                );
                return { userMsg, assistantMsg: assistantMsg };

            } else if (lowerResponse.includes('smaller') || lowerResponse.includes('incremental')) {
                // User wants smaller changes
                const assistantMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "Got it! I'll make smaller, more conservative changes. What specific aspect would you like me to modify first? For example, just the spice level, or just one ingredient substitution?"
                );
                return { userMsg, assistantMsg: assistantMsg };

            } else if (lowerResponse.includes('alternative') || lowerResponse.includes('suggest')) {
                // User wants alternative approaches
                const assistantMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "Here are some alternative approaches I can take:\n\n• **Gradual modification**: Make one change at a time so you can approve each step\n• **Create variations**: Make 2-3 different versions with different approaches\n• **Ingredient focus**: Focus only on ingredient substitutions without changing cooking methods\n• **Technique focus**: Keep ingredients similar but change cooking techniques\n\nWhich approach sounds most appealing to you?"
                );
                return { userMsg, assistantMsg: assistantMsg };

            } else {
                // Unclear response - ask for clarification
                const assistantMsg = await this.addMessage(
                    sessionId,
                    'assistant',
                    "I want to make sure I understand correctly. Would you like me to:\n\n• **Proceed** with the modifications as planned\n• **Create a new recipe** instead\n• **Make smaller changes** step by step\n• **Try a different approach**\n\nJust let me know which option you prefer!"
                );
                return { userMsg, assistantMsg: assistantMsg };
            }

        } catch (error) {
            console.error('Failed to handle modification confirmation:', error);

            const errorMsg = await this.addMessage(
                sessionId,
                'assistant',
                "I encountered an error processing your response. Could you please let me know if you'd like me to proceed with the recipe modification or try a different approach?"
            );

            return { userMsg, assistantMsg: errorMsg };
        }
    }

    /**
     * Extract the original modification request from recent messages
     */
    private extractOriginalModificationRequest(messages: ChatMessage[]): string | null {
        // Look for the user message that triggered the confirmation
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'user') {
                const content = message.content.toLowerCase();
                const modificationKeywords = ['modify', 'change', 'make it', 'substitute', 'replace'];

                if (modificationKeywords.some(keyword => content.includes(keyword))) {
                    return message.content;
                }
            }
        }
        return null;
    }

    /**
     * Get chat statistics for user
     */
    async getChatStats(): Promise<{
        totalSessions: number;
        totalMessages: number;
        recipesGenerated: number;
        averageSessionLength: number;
    }> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return {
                totalSessions: 0,
                totalMessages: 0,
                recipesGenerated: 0,
                averageSessionLength: 0
            };
        }

        // Get session count
        const { count: sessionCount } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        // Get message count
        const { count: messageCount } = await supabase
            .from('chat_messages')
            .select('chat_sessions!inner(*)', { count: 'exact', head: true })
            .eq('chat_sessions.user_id', user.id);

        // Get recipes generated via chat
        const { count: recipeCount } = await supabase
            .from('daily_recipes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('created_via', 'chat');

        return {
            totalSessions: sessionCount || 0,
            totalMessages: messageCount || 0,
            recipesGenerated: recipeCount || 0,
            averageSessionLength: sessionCount ? Math.round((messageCount || 0) / sessionCount) : 0
        };
    }

    /**
     * Get recipe variations for a recipe with enhanced context
     */
    async getRecipeVariationsForChat(recipeId: string): Promise<{
        hasVariations: boolean;
        variationCount: number;
        canCompare: boolean;
        canRollback: boolean;
        latestVariation?: any;
    }> {
        const { variationService } = await import('@/services/variationService');

        try {
            const variations = await variationService.getRecipeVariations(recipeId);

            return {
                hasVariations: variations.length > 0,
                variationCount: variations.length,
                canCompare: variations.length > 0,
                canRollback: variations.length > 0,
                latestVariation: variations.length > 0 ? variations[0] : undefined
            };
        } catch (error) {
            console.error('Failed to get recipe variations:', error);
            return {
                hasVariations: false,
                variationCount: 0,
                canCompare: false,
                canRollback: false
            };
        }
    }

    /**
     * Generate contextual suggestions for recipe actions
     */
    async generateRecipeActionSuggestions(recipeId: string): Promise<string[]> {
        const suggestions: string[] = [];

        try {
            const variationInfo = await this.getRecipeVariationsForChat(recipeId);

            // Base suggestions
            suggestions.push('Modify this recipe');
            suggestions.push('Make it healthier');
            suggestions.push('Add more spice');
            suggestions.push('Make it vegetarian');

            // Variation-based suggestions
            if (variationInfo.hasVariations) {
                suggestions.push('Compare versions');
                suggestions.push('View recipe history');
                suggestions.push('Rollback to original');
            }

            // Context-based suggestions
            suggestions.push('Create a variation for special diet');
            suggestions.push('Adjust for different serving size');

        } catch (error) {
            console.error('Failed to generate action suggestions:', error);
        }

        return suggestions.slice(0, 6); // Limit to 6 suggestions
    }
}

// Export singleton instance
export const chatService = ChatService.getInstance();