import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, router } from 'expo-router';
import { Recipe, Ingredient } from '@/types/recipe';
import { supabase } from '@/lib/supabase';
import {
  Clock,
  Users,
  DollarSign,
  ChevronLeft,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_recipes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setRecipe(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
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
        </View>
      </LinearGradient>
    );
  }

  if (!recipe) {
    return (
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        style={styles.container}
      >
        <View style={styles.centerContainer}>
          <BlurView intensity={30} tint="light" style={styles.errorContainer}>
            <Text style={styles.errorText}>Recipe not found</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </LinearGradient>
    );
  }

  const totalTime = recipe.prep_time + recipe.cook_time;

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      style={styles.container}
    >
      <BlurView intensity={30} tint="light" style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backIconButton}
        >
          <ChevronLeft size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe Details</Text>
        <View style={{ width: 28 }} />
      </BlurView>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>{recipe.recipe_name}</Text>

          <BlurView intensity={20} tint="light" style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={20} color="#fff" />
              <View>
                <Text style={styles.metaLabel}>Total Time</Text>
                <Text style={styles.metaValue}>{totalTime} min</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Users size={20} color="#fff" />
              <View>
                <Text style={styles.metaLabel}>Servings</Text>
                <Text style={styles.metaValue}>{recipe.servings}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <DollarSign size={20} color="#fff" />
              <View>
                <Text style={styles.metaLabel}>Cost</Text>
                <Text style={styles.metaValue}>
                  ${recipe.estimated_cost?.toFixed(2)}
                </Text>
              </View>
            </View>
          </BlurView>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient: Ingredient, index: number) => (
              <TouchableOpacity
                key={index}
                onPress={() => toggleIngredient(index)}
                activeOpacity={0.7}
              >
                <BlurView intensity={20} tint="light" style={styles.ingredientItem}>
                  {checkedIngredients.has(index) ? (
                    <CheckCircle2 size={24} color={colors.success} />
                  ) : (
                    <Circle size={24} color="rgba(255, 255, 255, 0.6)" />
                  )}
                  <Text
                    style={[
                      styles.ingredientText,
                      checkedIngredients.has(index) &&
                        styles.ingredientTextChecked,
                    ]}
                  >
                    {ingredient.quantity} {ingredient.name}
                  </Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <BlurView intensity={20} tint="light" style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>{recipe.instructions}</Text>
            </BlurView>
          </View>

          {recipe.nutritional_info?.highlights && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutritional Info</Text>
              <BlurView intensity={20} tint="light" style={styles.nutritionCard}>
                <Text style={styles.nutritionText}>
                  {recipe.nutritional_info.highlights}
                </Text>
                {recipe.nutritional_info.calories && (
                  <Text style={styles.nutritionDetail}>
                    {recipe.nutritional_info.calories} calories per serving
                  </Text>
                )}
              </BlurView>
            </View>
          )}
        </View>
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
  headerBar: {
    ...glassStyles.glassHeader,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  backIconButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metaRow: {
    ...glassStyles.glassCard,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    overflow: 'hidden',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  ingredientItem: {
    ...glassStyles.glassCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  instructionsContainer: {
    ...glassStyles.glassCard,
    overflow: 'hidden',
  },
  instructionsText: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  nutritionCard: {
    ...glassStyles.glassCard,
    overflow: 'hidden',
  },
  nutritionText: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  nutritionDetail: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    marginTop: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '600',
  },
  backButton: {
    ...glassStyles.glassButton,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
