import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AIProvider } from '@/contexts/AIContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { View, ActivityIndicator, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { initializeCache } from '@/services/cacheInitializer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAppIntegration } from '@/hooks/useAppIntegration';
import { useErrorHandling } from '@/hooks/useErrorHandling';
import { colors, gradientColors, gradientLocations } from '@/styles/theme';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const {
    initialize,
    isInitialized,
    isInitializing,
    error: integrationError,
    serviceHealth,
    clearError
  } = useAppIntegration();

  const {
    handleError,
    errorState,
    clearError: clearHandlingError,
    createErrorBoundaryHandler
  } = useErrorHandling();

  // Handle navigation based on auth state
  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [user, loading]);

  // Initialize services when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      const initializeServices = async () => {
        try {
          // Initialize legacy cache service
          await initializeCache();

          // Initialize integrated services
          await initialize();
        } catch (error) {
          console.error('Failed to initialize services:', error);
          await handleError(error as Error, {
            screen: 'App Initialization',
            action: 'service_initialization'
          });
        }
      };

      initializeServices();
    }
  }, [user, loading, initialize, handleError]);

  // Handle integration errors
  useEffect(() => {
    if (integrationError && !errorState) {
      handleError(new Error(integrationError), {
        screen: 'App Integration',
        action: 'service_integration'
      });
    }
  }, [integrationError, errorState, handleError]);

  // Show loading screen during initialization
  if (loading || (user && isInitializing)) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{
          marginTop: 16,
          fontSize: 16,
          color: '#fff',
          fontWeight: '600'
        }}>
          {isInitializing ? 'Initializing AI services...' : 'Loading...'}
        </Text>
        {serviceHealth && (
          <Text style={{
            marginTop: 8,
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.8)'
          }}>
            {serviceHealth.overall === 'healthy' ? 'All systems ready' :
              serviceHealth.overall === 'degraded' ? 'Limited functionality' :
                'Checking services...'}
          </Text>
        )}
      </LinearGradient>
    );
  }

  return (
    <ErrorBoundary
      onError={createErrorBoundaryHandler('Root Layout', async () => {
        // Retry initialization
        if (user) {
          await initialize();
        }
      })}
    >
      <AppStateProvider>
        <NavigationProvider>
          <AIProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </AIProvider>
        </NavigationProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
