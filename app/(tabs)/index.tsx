import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Recipe } from '@/types/recipe';
import { RecipeCard } from '@/components/RecipeCard';
import { ServiceStatusIndicator } from '@/components/ServiceStatusIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  generateDailyRecipes,
  getRecipesForDate,
  toggleFavorite,
} from '@/services/recipeService';
import { useRecipeRefresh } from '@/hooks/useRecipeRefresh';
import { useAppIntegration } from '@/hooks/useAppIntegration';
import { useAI } from '@/contexts/AIContext';
import { RefreshCw, ChefHat, AlertTriangle } from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';

export default function HomeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const {
    isInitialized,
    serviceHealth,
    error: integrationError,
    clearError
  } = useAppIntegration();

  const { 
    canGenerateRecipes,
    isAIReady
  } = useAI();

  const today = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const loadRecipes = async () => {
    try {
      setError('');

      // Clear any integration errors
      if (integrationError) {
        clearError();
      }

      const existingRecipes = await getRecipesForDate(today);

      if (existingRecipes.length === 3) {
        setRecipes(existingRecipes);
      } else {
        // Check if we can generate recipes
        if (!canGenerateRecipes) {
          setError('Recipe generation is currently unavailable. Please check your settings or try again later.');
          setRecipes(existingRecipes); // Show any existing recipes
          return;
        }

        setGenerating(true);
        const newRecipes = await generateDailyRecipes(false);
        setRecipes(newRecipes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
      setGenerating(false); 
    }
  };

  useRecipeRefresh(loadRecipes, isAIReady);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecipes();
    setRefreshing(false);
  };

  const handleRegenerate = async () => {
    // Check if we can generate recipes
    if (!canGenerateRecipes) {
      setError('Recipe generation is currently unavailable. Please check your settings or try again later.');
      return;
    }

    setGenerating(true);
    setError('');
    try {
      const newRecipes = await generateDailyRecipes(true);
      setRecipes(newRecipes);
    } catch (err: any) {
      setError(err.message || 'Failed to generate recipes');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async (recipeId: string) => {
    try {
      await toggleFavorite(recipeId);
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, is_favorite: !r.is_favorite } : r
        )
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update favorite');
    }
  };

  useEffect(() => {
    // Only load recipes after services are initialized and AI is ready
    if (isInitialized && isAIReady) {
      loadRecipes();
    }
  }, [isInitialized, isAIReady]);

  if (loading) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading your recipes...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error && recipes.length === 0) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <BlurView intensity={30} tint="light" style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadRecipes}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </LinearGradient>
    );
  }

  return (
    <ErrorBoundary>
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
        >
          <BlurView intensity={30} tint="light" style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <ChefHat size={32} color="#fff" />
                <Text style={styles.title}>Today's Menu</Text>
              </View>
              <Text style={styles.date}>{todayFormatted}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={handleRegenerate}
                disabled={generating || !canGenerateRecipes}
                style={[
                  styles.regenerateButton,
                  (!canGenerateRecipes) && styles.regenerateButtonDisabled
                ]}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RefreshCw size={24} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Service Status */}
          {serviceHealth && serviceHealth.overall !== 'healthy' && (
            <ServiceStatusIndicator showDetails />
          )}

          {/* Integration Error */}
          {integrationError && (
            <BlurView intensity={20} tint="light" style={styles.errorBanner}>
              <AlertTriangle size={16} color={colors.error} />
              <Text style={styles.errorBannerText}>{integrationError}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </BlurView>
          )}

          {error && (
            <BlurView intensity={20} tint="light" style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </BlurView>
          )}

          {generating && recipes.length === 0 ? (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.generatingText}>
                Generating your personalized recipes...
              </Text>
              <Text style={styles.generatingSubtext}>
                This may take a moment
              </Text>
            </View>
          ) : (
            <View style={styles.recipesContainer}>
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onToggleFavorite={() => handleToggleFavorite(recipe.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    ...glassStyles.glassCard,
    alignItems: 'center',
    padding: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    ...glassStyles.glassContainer,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 20,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  date: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regenerateButton: {
    ...glassStyles.glassButton,
    padding: 12,
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
  },
  dismissText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  recipesContainer: {
    gap: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  errorBanner: {
    ...glassStyles.glassCard,
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorBannerText: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    ...glassStyles.glassButton,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  generatingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  generatingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  generatingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
});
