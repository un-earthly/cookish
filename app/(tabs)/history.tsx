import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Recipe } from '@/types/recipe';
import { RecipeCard } from '@/components/RecipeCard';
import { getRecentRecipes, toggleFavorite } from '@/services/recipeService';
import { Calendar } from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';

export default function HistoryScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    try {
      setError('');
      const recentRecipes = await getRecentRecipes(7);
      setRecipes(recentRecipes);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
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
    loadHistory();
  }, []);

  const groupRecipesByDate = () => {
    const grouped: { [key: string]: Recipe[] } = {};
    recipes.forEach((recipe) => {
      const date = recipe.recipe_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(recipe);
    });
    return grouped;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) {
      return 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <BlurView intensity={30} tint="light" style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadHistory}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </LinearGradient>
    );
  }

  const groupedRecipes = groupRecipesByDate();
  const dates = Object.keys(groupedRecipes).sort().reverse();

  if (dates.length === 0) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <BlurView intensity={30} tint="light" style={styles.header}>
          <Calendar size={32} color="#fff" />
          <Text style={styles.title}>Recipe History</Text>
        </BlurView>
        <View style={styles.centerContainer}>
          <Calendar size={64} color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.emptyTitle}>No Recipe History</Text>
          <Text style={styles.emptyText}>
            Your past recipes will appear here
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      style={styles.container}
    >
      <BlurView intensity={30} tint="light" style={styles.header}>
        <Calendar size={32} color="#fff" />
        <Text style={styles.title}>Recipe History</Text>
      </BlurView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
      >
        {dates.map((date) => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeader}>{formatDate(date)}</Text>
            {groupedRecipes[date].map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onToggleFavorite={() => handleToggleFavorite(recipe.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </LinearGradient>
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
  header: {
    ...glassStyles.glassHeader,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  retryButton: {
    ...glassStyles.glassButton,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
});
