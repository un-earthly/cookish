/**
 * Simple integration test to verify all components work together
 */

// Test imports
import { appIntegrationService } from './services/appIntegrationService';
import { chatService } from './services/chatService';
import { imageService } from './services/imageService';
import { voiceService } from './services/voiceService';
import { cacheService } from './services/cacheService';

console.log('Testing integration imports...');

// Test service availability
const services = {
    appIntegration: !!appIntegrationService,
    chat: !!chatService,
    image: !!imageService,
    voice: !!voiceService,
    cache: !!cacheService,
};

console.log('Service availability:', services);

// Test basic functionality
async function testBasicIntegration() {
    try {
        console.log('Testing basic integration...');

        // Test app integration service
        const isInitialized = appIntegrationService.isServicesInitialized();
        console.log('App integration initialized:', isInitialized);

        // Test voice service
        const isVoiceSupported = await voiceService.isVoiceInputSupported();
        console.log('Voice input supported:', isVoiceSupported);

        // Test cache service
        await cacheService.initialize();
        console.log('Cache service initialized');

        console.log('Basic integration test completed successfully');
        return true;

    } catch (error) {
        console.error('Integration test failed:', error);
        return false;
    }
}

// Export test function
export { testBasicIntegration };

console.log('Integration test module loaded successfully');