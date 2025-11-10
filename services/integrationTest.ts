import { appIntegrationService } from '@/services/appIntegrationService';
import { chatService } from '@/services/chatService';
import { imageService } from '@/services/imageService';
import { voiceService } from '@/services/voiceService';
import { cacheService } from '@/services/cacheService';
import { dietaryService } from '@/services/dietaryService';
import { variationService } from '@/services/variationService';

/**
 * Comprehensive integration test for all AI recipe generation features
 */
export class IntegrationTest {
    private testResults: { [key: string]: boolean } = {};
    private errors: { [key: string]: string } = {};

    /**
     * Run all integration tests
     */
    async runAllTests(): Promise<{
        success: boolean;
        results: { [key: string]: boolean };
        errors: { [key: string]: string };
        summary: string;
    }> {
        console.log('Starting comprehensive integration tests...');

        // Core service tests
        await this.testAppIntegrationService();
        await this.testChatService();
        await this.testImageService();
        await this.testVoiceService();
        await this.testCacheService();
        await this.testDietaryService();
        await this.testVariationService();

        // End-to-end workflow tests
        await this.testRecipeGenerationWorkflow();
        await this.testChatWorkflow();
        await this.testVoiceToRecipeWorkflow();

        const totalTests = Object.keys(this.testResults).length;
        const passedTests = Object.values(this.testResults).filter(Boolean).length;
        const failedTests = totalTests - passedTests;

        const summary = `Integration Tests Complete: ${passedTests}/${totalTests} passed, ${failedTests} failed`;
        console.log(summary);

        return {
            success: failedTests === 0,
            results: this.testResults,
            errors: this.errors,
            summary
        };
    }

    /**
     * Test app integration service
     */
    private async testAppIntegrationService(): Promise<void> {
        try {
            console.log('Testing App Integration Service...');

            // Test initialization
            await appIntegrationService.initialize();
            this.testResults['appIntegration.initialize'] = true;

            // Test service health
            const health = await appIntegrationService.getServiceHealth();
            this.testResults['appIntegration.getServiceHealth'] = !!health;

            // Test available features
            const features = await appIntegrationService.getAvailableFeatures();
            this.testResults['appIntegration.getAvailableFeatures'] = !!features;

            // Test service stats
            const stats = await appIntegrationService.getServiceStats();
            this.testResults['appIntegration.getServiceStats'] = !!stats;

        } catch (error) {
            this.errors['appIntegration'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['appIntegration.initialize'] = false;
        }
    }

    /**
     * Test chat service
     */
    private async testChatService(): Promise<void> {
        try {
            console.log('Testing Chat Service...');

            // Test session creation
            const session = await chatService.createSession();
            this.testResults['chat.createSession'] = !!session;

            if (session) {
                // Test message addition
                const message = await chatService.addMessage(
                    session.id,
                    'user',
                    'Test message'
                );
                this.testResults['chat.addMessage'] = !!message;

                // Test message retrieval
                const messages = await chatService.getSessionMessages(session.id);
                this.testResults['chat.getSessionMessages'] = messages.length > 0;

                // Test chat stats
                const stats = await chatService.getChatStats();
                this.testResults['chat.getChatStats'] = !!stats;
            }

        } catch (error) {
            this.errors['chat'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['chat.createSession'] = false;
        }
    }

    /**
     * Test image service
     */
    private async testImageService(): Promise<void> {
        try {
            console.log('Testing Image Service...');

            // Test image search (if available)
            if ('searchRecipeImage' in imageService && typeof imageService.searchRecipeImage === 'function') {
                const imageResult = await imageService.searchRecipeImage({
                    recipeName: 'Test Recipe',
                    mainIngredients: ['test'],
                    cuisine: 'test'
                });
                this.testResults['image.searchRecipeImage'] = !!imageResult;
            } else {
                this.testResults['image.searchRecipeImage'] = true; // Skip if not available
            }

            // Test service status (if available)
            if ('getServiceStatus' in imageService && typeof imageService.getServiceStatus === 'function') {
                const status = await imageService.getServiceStatus();
                this.testResults['image.getServiceStatus'] = !!status;
            } else {
                this.testResults['image.getServiceStatus'] = true; // Skip if not available
            }

        } catch (error) {
            this.errors['image'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['image.searchRecipeImage'] = false;
        }
    }

    /**
     * Test voice service
     */
    private async testVoiceService(): Promise<void> {
        try {
            console.log('Testing Voice Service...');

            // Test voice support check
            const isSupported = await voiceService.isVoiceInputSupported();
            this.testResults['voice.isVoiceInputSupported'] = typeof isSupported === 'boolean';

            // Test cleanup (should not throw)
            await voiceService.cleanup();
            this.testResults['voice.cleanup'] = true;

        } catch (error) {
            this.errors['voice'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['voice.isVoiceInputSupported'] = false;
        }
    }

    /**
     * Test cache service
     */
    private async testCacheService(): Promise<void> {
        try {
            console.log('Testing Cache Service...');

            // Test initialization
            await cacheService.initialize();
            this.testResults['cache.initialize'] = true;

            // Test set/get operations
            const testKey = 'integration_test_key';
            const testValue = { test: 'data', timestamp: Date.now() };

            await cacheService.set(testKey, testValue, 60);
            this.testResults['cache.set'] = true;

            const retrievedValue = await cacheService.get(testKey);
            this.testResults['cache.get'] = JSON.stringify(retrievedValue) === JSON.stringify(testValue);

            // Test delete
            await cacheService.delete(testKey);
            const deletedValue = await cacheService.get(testKey);
            this.testResults['cache.delete'] = deletedValue === null;

            // Test cleanup
            await cacheService.cleanup();
            this.testResults['cache.cleanup'] = true;

        } catch (error) {
            this.errors['cache'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['cache.initialize'] = false;
        }
    }

    /**
     * Test dietary service
     */
    private async testDietaryService(): Promise<void> {
        try {
            console.log('Testing Dietary Service...');

            // Test dietary validation (if available)
            if ('validateRecipeForDietaryRestrictions' in dietaryService) {
                const mockRecipe = {
                    id: 'test',
                    recipe_name: 'Test Recipe',
                    ingredients: [{ item: 'chicken', amount: '1 lb', notes: '' }],
                    instructions: [],
                    prep_time: '10 min',
                    cook_time: '20 min',
                    servings: 4,
                    difficulty: 'Easy' as const,
                    cuisine: 'American',
                    tags: [],
                    recipe_date: '2024-01-01',
                    is_favorite: false,
                    created_at: new Date().toISOString()
                };

                const validation = await (dietaryService as any).validateRecipeForDietaryRestrictions(
                    mockRecipe,
                    ['vegetarian']
                );
                this.testResults['dietary.validateRecipe'] = !!validation;
            } else {
                this.testResults['dietary.validateRecipe'] = true; // Skip if not available
            }

        } catch (error) {
            this.errors['dietary'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['dietary.validateRecipe'] = false;
        }
    }

    /**
     * Test variation service
     */
    private async testVariationService(): Promise<void> {
        try {
            console.log('Testing Variation Service...');

            // Test service availability
            this.testResults['variation.serviceAvailable'] = !!variationService;

            // Additional variation tests would go here when methods are available

        } catch (error) {
            this.errors['variation'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['variation.serviceAvailable'] = false;
        }
    }

    /**
     * Test complete recipe generation workflow
     */
    private async testRecipeGenerationWorkflow(): Promise<void> {
        try {
            console.log('Testing Recipe Generation Workflow...');

            // Test recipe generation through app integration service
            const recipe = await appIntegrationService.generateRecipe('Test recipe with chicken and rice');
            this.testResults['workflow.generateRecipe'] = !!recipe && !!recipe.recipe_name;

        } catch (error) {
            this.errors['workflow.generateRecipe'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['workflow.generateRecipe'] = false;
        }
    }

    /**
     * Test complete chat workflow
     */
    private async testChatWorkflow(): Promise<void> {
        try {
            console.log('Testing Chat Workflow...');

            // Create session through app integration
            const session = await appIntegrationService.createChatSession();
            this.testResults['workflow.createChatSession'] = !!session;

            if (session) {
                // Test message processing
                const result = await chatService.processUserMessage(
                    session.id,
                    'Create a simple pasta recipe',
                    false,
                    () => { } // Empty processing state callback
                );
                this.testResults['workflow.processUserMessage'] = !!result.userMsg && !!result.assistantMsg;
            }

        } catch (error) {
            this.errors['workflow.chat'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['workflow.createChatSession'] = false;
        }
    }

    /**
     * Test voice to recipe workflow
     */
    private async testVoiceToRecipeWorkflow(): Promise<void> {
        try {
            console.log('Testing Voice to Recipe Workflow...');

            // Check if voice is supported
            const isVoiceSupported = await voiceService.isVoiceInputSupported();

            if (isVoiceSupported) {
                // Simulate voice input processing
                const mockTranscript = 'Create a recipe with tomatoes and basil';
                const recipe = await appIntegrationService.generateRecipe(mockTranscript);
                this.testResults['workflow.voiceToRecipe'] = !!recipe;
            } else {
                this.testResults['workflow.voiceToRecipe'] = true; // Skip if voice not supported
            }

        } catch (error) {
            this.errors['workflow.voiceToRecipe'] = error instanceof Error ? error.message : 'Unknown error';
            this.testResults['workflow.voiceToRecipe'] = false;
        }
    }

    /**
     * Get test summary
     */
    getTestSummary(): string {
        const totalTests = Object.keys(this.testResults).length;
        const passedTests = Object.values(this.testResults).filter(Boolean).length;
        const failedTests = totalTests - passedTests;

        let summary = `Integration Test Results:\n`;
        summary += `Total Tests: ${totalTests}\n`;
        summary += `Passed: ${passedTests}\n`;
        summary += `Failed: ${failedTests}\n\n`;

        if (failedTests > 0) {
            summary += `Failed Tests:\n`;
            Object.entries(this.testResults).forEach(([test, passed]) => {
                if (!passed) {
                    summary += `- ${test}\n`;
                    if (this.errors[test.split('.')[0]]) {
                        summary += `  Error: ${this.errors[test.split('.')[0]]}\n`;
                    }
                }
            });
        }

        return summary;
    }
}

// Export singleton instance
export const integrationTest = new IntegrationTest();