import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Recipe } from '@/types/recipe';
import { Clock, DollarSign, Users, Heart } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, glassStyles } from '@/styles/theme';

interface RecipeCardProps {
  recipe: Recipe;
  onToggleFavorite?: () => void;
}

export function RecipeCard({ recipe, onToggleFavorite }: RecipeCardProps) {
  const totalTime = recipe.prep_time + recipe.cook_time;

  const getMealTypeColor = () => {
    switch (recipe.meal_type) {
      case 'breakfast':
        return '#f59e0b';
      case 'lunch':
        return '#10b981';
      case 'dinner':
        return '#6366f1';
      default:
        return '#3b82f6';
    }
  };

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/(tabs)/recipe-detail',
          params: { id: recipe.id },
        })
      }
      activeOpacity={0.8}
    >
      <BlurView intensity={20} tint="light" style={styles.card}>
        <View style={styles.header}>
          <View
            style={[
              styles.mealTypeBadge,
              { backgroundColor: getMealTypeColor() },
            ]}
          >
            <Text style={styles.mealTypeText}>
              {recipe.meal_type.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={24}
              color={recipe.is_favorite ? '#ef4444' : colors.textSecondary}
              fill={recipe.is_favorite ? '#ef4444' : 'none'}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{recipe.recipe_name}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Clock size={16} color={colors.primary} />
            <Text style={styles.infoText}>{totalTime} min</Text>
          </View>
          <View style={styles.infoItem}>
            <Users size={16} color={colors.primary} />
            <Text style={styles.infoText}>{recipe.servings} servings</Text>
          </View>
          <View style={styles.infoItem}>
            <DollarSign size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              ${recipe.estimated_cost?.toFixed(2)}
            </Text>
          </View>
        </View>

        {recipe.season && (
          <View style={styles.seasonBadge}>
            <Text style={styles.seasonText}>{recipe.season}</Text>
          </View>
        )}
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassStyles.glassCard,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  mealTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  seasonBadge: {
    position: 'absolute',
    top: 16,
    right: 56,
    backgroundColor: colors.glassLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  seasonText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
