import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
    ArrowLeft,
    ArrowRight,
    TrendingUp,
    TrendingDown,
    Minus,
    Clock,
    DollarSign,
    Users,
    ChefHat,
    Heart,
    RotateCcw,
    CheckCircle,
    XCircle,
    AlertTriangle
} from 'lucide-react-native';
import { Recipe } from '@/types/recipe';
import { variationService } from '@/services/variationService';
import { colors, glassStyles } from '@/styles/theme';

interface RecipeComparisonProps {
    originalRecipeId: string;
    variationId?: string;
    onClose: () => void;
    onRollback?: (recipeId: string) => void;
}

interface ComparisonData {
    original: Recipe;
    comparison_target: any;
    detailed_differences: any;
    recommendation: any;
}

export function RecipeComparison({
    originalRecipeId,
    variationId,
    onClose,
    onRollback
}: RecipeComparisonProps) {
    const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'ingredients' | 'nutrition' | 'timing'>('overview');

    useEffect(() => {
        loadComparison();
    }, [originalRecipeId, variationId]);

    const loadComparison = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await variationService.getDetailedRecipeComparison(originalRecipeId, variationId);
            setComparisonData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load comparison');
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        if (!comparisonData) return;

        Alert.alert(
            'Rollback Recipe',
            'Are you sure you want to rollback to this version? This will create a new recipe with the selected version\'s settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Rollback',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await variationService.rollbackToVersion(
                                originalRecipeId,
                                variationId,
                                'User requested rollback from comparison interface'
                            );
                            Alert.alert('Success', 'Recipe has been rolled back successfully!');
                            onRollback?.(result.rolled_back_recipe.id);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to rollback recipe');
                        }
                    }
                }
            ]
        );
    };

    const renderChangeIndicator = (change: number, type: 'positive' | 'negative' | 'neutral' = 'neutral') => {
        if (change === 0) {
            return <Minus size={16} color={colors.textSecondary} />;
        }

        const isPositive = change > 0;
        const color = type === 'positive'
            ? (isPositive ? colors.success : colors.error)
            : type === 'negative'
                ? (isPositive ? colors.error : colors.success)
                : (isPositive ? colors.primary : colors.warning);

        return isPositive
            ? <TrendingUp size={16} color={color} />
            : <TrendingDown size={16} color={color} />;
    };

    const renderOverviewTab = () => {
        if (!comparisonData) return null;

        const { detailed_differences, recommendation } = comparisonData;
        const targetRecipe = 'recipe_data' in comparisonData.comparison_target
            ? comparisonData.comparison_target.recipe_data
            : comparisonData.comparison_target;

        return (
            <ScrollView style={styles.tabContent}>
                {/* Recommendation Card */}
                <BlurView intensity={20} tint="light" style={styles.recommendationCard}>
                    <View style={styles.recommendationHeader}>
                        <CheckCircle size={24} color={colors.success} />
                        <Text style={styles.recommendationTitle}>Recommendation</Text>
                    </View>
                    <Text style={styles.recommendationText}>
                        We recommend the {recommendation.preferred_version} version
                    </Text>
                    {recommendation.reasoning.map((reason: string, index: number) => (
                        <Text key={index} style={styles.reasonText}>• {reason}</Text>
                    ))}
                </BlurView>

                {/* Quick Stats Comparison */}
                <BlurView intensity={20} tint="light" style={styles.statsCard}>
                    <Text style={styles.sectionTitle}>Quick Comparison</Text>

                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <Clock size={20} color={colors.primary} />
                            <Text style={styles.statLabel}>Total Time</Text>
                            <View style={styles.statComparison}>
                                <Text style={styles.statValue}>
                                    {comparisonData.original.prep_time + comparisonData.original.cook_time} min
                                </Text>
                                {renderChangeIndicator(detailed_differences.timing.total_time_change, 'negative')}
                                <Text style={styles.statValue}>
                                    {(targetRecipe.prep_time || 0) + (targetRecipe.cook_time || 0)} min
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <DollarSign size={20} color={colors.primary} />
                            <Text style={styles.statLabel}>Cost</Text>
                            <View style={styles.statComparison}>
                                <Text style={styles.statValue}>
                                    ${detailed_differences.cost.original.toFixed(2)}
                                </Text>
                                {renderChangeIndicator(detailed_differences.cost.change, 'negative')}
                                <Text style={styles.statValue}>
                                    ${detailed_differences.cost.new.toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <Heart size={20} color={colors.primary} />
                            <Text style={styles.statLabel}>Calories</Text>
                            <View style={styles.statComparison}>
                                <Text style={styles.statValue}>
                                    {detailed_differences.nutritional.calories.original}
                                </Text>
                                {renderChangeIndicator(detailed_differences.nutritional.calories.change, 'negative')}
                                <Text style={styles.statValue}>
                                    {detailed_differences.nutritional.calories.new}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statRow}>
                        <View style={styles.statItem}>
                            <ChefHat size={20} color={colors.primary} />
                            <Text style={styles.statLabel}>Difficulty</Text>
                            <View style={styles.statComparison}>
                                <Text style={styles.statValue}>
                                    {detailed_differences.difficulty.original}
                                </Text>
                                <ArrowRight size={16} color={colors.textSecondary} />
                                <Text style={styles.statValue}>
                                    {detailed_differences.difficulty.new}
                                </Text>
                            </View>
                        </View>
                    </View>
                </BlurView>

                {/* Use Cases */}
                <BlurView intensity={20} tint="light" style={styles.useCasesCard}>
                    <Text style={styles.sectionTitle}>When to Use Each Version</Text>

                    <View style={styles.useCaseSection}>
                        <Text style={styles.useCaseTitle}>Original Recipe</Text>
                        {recommendation.use_cases.original.map((useCase: string, index: number) => (
                            <Text key={index} style={styles.useCaseText}>• {useCase}</Text>
                        ))}
                    </View>

                    <View style={styles.useCaseSection}>
                        <Text style={styles.useCaseTitle}>Variation</Text>
                        {recommendation.use_cases.variation.map((useCase: string, index: number) => (
                            <Text key={index} style={styles.useCaseText}>• {useCase}</Text>
                        ))}
                    </View>
                </BlurView>
            </ScrollView>
        );
    };

    const renderIngredientsTab = () => {
        if (!comparisonData) return null;

        const { ingredients } = comparisonData.detailed_differences;

        return (
            <ScrollView style={styles.tabContent}>
                {/* Added Ingredients */}
                {ingredients.added.length > 0 && (
                    <BlurView intensity={20} tint="light" style={styles.ingredientSection}>
                        <View style={styles.ingredientHeader}>
                            <CheckCircle size={20} color={colors.success} />
                            <Text style={styles.ingredientSectionTitle}>Added Ingredients</Text>
                        </View>
                        {ingredients.added.map((ingredient: any, index: number) => (
                            <View key={index} style={styles.ingredientItem}>
                                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                                <Text style={styles.ingredientQuantity}>{ingredient.quantity}</Text>
                                <Text style={styles.ingredientImpact}>{ingredient.impact}</Text>
                            </View>
                        ))}
                    </BlurView>
                )}

                {/* Removed Ingredients */}
                {ingredients.removed.length > 0 && (
                    <BlurView intensity={20} tint="light" style={styles.ingredientSection}>
                        <View style={styles.ingredientHeader}>
                            <XCircle size={20} color={colors.error} />
                            <Text style={styles.ingredientSectionTitle}>Removed Ingredients</Text>
                        </View>
                        {ingredients.removed.map((ingredient: any, index: number) => (
                            <View key={index} style={styles.ingredientItem}>
                                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                                <Text style={styles.ingredientQuantity}>{ingredient.quantity}</Text>
                                <Text style={styles.ingredientImpact}>{ingredient.impact}</Text>
                            </View>
                        ))}
                    </BlurView>
                )}

                {/* Modified Ingredients */}
                {ingredients.modified.length > 0 && (
                    <BlurView intensity={20} tint="light" style={styles.ingredientSection}>
                        <View style={styles.ingredientHeader}>
                            <AlertTriangle size={20} color={colors.warning} />
                            <Text style={styles.ingredientSectionTitle}>Modified Ingredients</Text>
                        </View>
                        {ingredients.modified.map((ingredient: any, index: number) => (
                            <View key={index} style={styles.ingredientItem}>
                                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                                <View style={styles.quantityComparison}>
                                    <Text style={styles.originalQuantity}>{ingredient.original_quantity}</Text>
                                    <ArrowRight size={14} color={colors.textSecondary} />
                                    <Text style={styles.newQuantity}>{ingredient.new_quantity}</Text>
                                </View>
                                <Text style={styles.ingredientImpact}>{ingredient.impact}</Text>
                            </View>
                        ))}
                    </BlurView>
                )}

                {/* Unchanged Ingredients */}
                {ingredients.unchanged.length > 0 && (
                    <BlurView intensity={20} tint="light" style={styles.ingredientSection}>
                        <View style={styles.ingredientHeader}>
                            <Minus size={20} color={colors.textSecondary} />
                            <Text style={styles.ingredientSectionTitle}>Unchanged Ingredients</Text>
                        </View>
                        <Text style={styles.unchangedCount}>
                            {ingredients.unchanged.length} ingredients remain the same
                        </Text>
                    </BlurView>
                )}
            </ScrollView>
        );
    };

    const renderNutritionTab = () => {
        if (!comparisonData) return null;

        const { nutritional } = comparisonData.detailed_differences;

        return (
            <ScrollView style={styles.tabContent}>
                <BlurView intensity={20} tint="light" style={styles.nutritionCard}>
                    <Text style={styles.sectionTitle}>Nutritional Comparison</Text>

                    {/* Overall Health Impact */}
                    <View style={styles.healthImpactSection}>
                        <Text style={styles.healthImpactTitle}>Overall Health Impact</Text>
                        <View style={[
                            styles.healthImpactBadge,
                            {
                                backgroundColor:
                                    nutritional.overall_health_impact === 'improved' ? colors.success :
                                        nutritional.overall_health_impact === 'decreased' ? colors.error :
                                            colors.textSecondary
                            }
                        ]}>
                            <Text style={styles.healthImpactText}>
                                {nutritional.overall_health_impact.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Detailed Nutrition */}
                    <View style={styles.nutritionDetails}>
                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>Calories</Text>
                            <View style={styles.nutritionComparison}>
                                <Text style={styles.nutritionValue}>{nutritional.calories.original}</Text>
                                {renderChangeIndicator(nutritional.calories.change, 'negative')}
                                <Text style={styles.nutritionValue}>{nutritional.calories.new}</Text>
                                <Text style={styles.nutritionPercentage}>
                                    ({nutritional.calories.percentage > 0 ? '+' : ''}{nutritional.calories.percentage}%)
                                </Text>
                            </View>
                        </View>

                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>Protein</Text>
                            <View style={styles.nutritionComparison}>
                                <Text style={styles.nutritionValue}>{nutritional.protein.original}</Text>
                                <ArrowRight size={14} color={colors.textSecondary} />
                                <Text style={styles.nutritionValue}>{nutritional.protein.new}</Text>
                            </View>
                            <Text style={styles.nutritionImpact}>{nutritional.protein.impact}</Text>
                        </View>

                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>Carbs</Text>
                            <View style={styles.nutritionComparison}>
                                <Text style={styles.nutritionValue}>{nutritional.carbs.original}</Text>
                                <ArrowRight size={14} color={colors.textSecondary} />
                                <Text style={styles.nutritionValue}>{nutritional.carbs.new}</Text>
                            </View>
                            <Text style={styles.nutritionImpact}>{nutritional.carbs.impact}</Text>
                        </View>

                        <View style={styles.nutritionRow}>
                            <Text style={styles.nutritionLabel}>Fats</Text>
                            <View style={styles.nutritionComparison}>
                                <Text style={styles.nutritionValue}>{nutritional.fats.original}</Text>
                                <ArrowRight size={14} color={colors.textSecondary} />
                                <Text style={styles.nutritionValue}>{nutritional.fats.new}</Text>
                            </View>
                            <Text style={styles.nutritionImpact}>{nutritional.fats.impact}</Text>
                        </View>
                    </View>
                </BlurView>
            </ScrollView>
        );
    };

    const renderTimingTab = () => {
        if (!comparisonData) return null;

        const { timing, difficulty } = comparisonData.detailed_differences;

        return (
            <ScrollView style={styles.tabContent}>
                <BlurView intensity={20} tint="light" style={styles.timingCard}>
                    <Text style={styles.sectionTitle}>Timing & Difficulty</Text>

                    {/* Timing Comparison */}
                    <View style={styles.timingSection}>
                        <Text style={styles.timingSubtitle}>Preparation Time</Text>
                        <View style={styles.timingComparison}>
                            <Text style={styles.timingValue}>{timing.prep_time.original} min</Text>
                            {renderChangeIndicator(timing.prep_time.change, 'negative')}
                            <Text style={styles.timingValue}>{timing.prep_time.new} min</Text>
                        </View>
                    </View>

                    <View style={styles.timingSection}>
                        <Text style={styles.timingSubtitle}>Cooking Time</Text>
                        <View style={styles.timingComparison}>
                            <Text style={styles.timingValue}>{timing.cook_time.original} min</Text>
                            {renderChangeIndicator(timing.cook_time.change, 'negative')}
                            <Text style={styles.timingValue}>{timing.cook_time.new} min</Text>
                        </View>
                    </View>

                    <View style={styles.efficiencySection}>
                        <Text style={styles.efficiencyTitle}>Efficiency Impact</Text>
                        <Text style={styles.efficiencyText}>{timing.efficiency_impact}</Text>
                    </View>

                    {/* Difficulty Comparison */}
                    <View style={styles.difficultySection}>
                        <Text style={styles.difficultyTitle}>Difficulty Level</Text>
                        <View style={styles.difficultyComparison}>
                            <Text style={styles.difficultyValue}>{difficulty.original}</Text>
                            <ArrowRight size={16} color={colors.textSecondary} />
                            <Text style={styles.difficultyValue}>{difficulty.new}</Text>
                        </View>
                        <Text style={styles.difficultyReason}>{difficulty.change_reason}</Text>

                        <Text style={styles.skillRequirementsTitle}>Skill Requirements:</Text>
                        {difficulty.skill_requirements.map((skill: string, index: number) => (
                            <Text key={index} style={styles.skillRequirement}>• {skill}</Text>
                        ))}
                    </View>
                </BlurView>
            </ScrollView>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading comparison...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={loadComparison} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!comparisonData) {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <BlurView intensity={20} tint="light" style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recipe Comparison</Text>
                <TouchableOpacity onPress={handleRollback} style={styles.rollbackButton}>
                    <RotateCcw size={20} color={colors.primary} />
                    <Text style={styles.rollbackText}>Rollback</Text>
                </TouchableOpacity>
            </BlurView>

            {/* Tab Navigation */}
            <View style={styles.tabNavigation}>
                {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'ingredients', label: 'Ingredients' },
                    { key: 'nutrition', label: 'Nutrition' },
                    { key: 'timing', label: 'Timing' }
                ].map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key as any)}
                        style={[
                            styles.tabButton,
                            activeTab === tab.key && styles.activeTabButton
                        ]}
                    >
                        <Text style={[
                            styles.tabButtonText,
                            activeTab === tab.key && styles.activeTabButtonText
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab Content */}
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'ingredients' && renderIngredientsTab()}
            {activeTab === 'nutrition' && renderNutritionTab()}
            {activeTab === 'timing' && renderTimingTab()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: colors.error,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        ...glassStyles.glassCard,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 0,
        borderRadius: 0,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    rollbackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.glassLight,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    rollbackText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    tabNavigation: {
        flexDirection: 'row',
        backgroundColor: colors.glassLight,
        marginHorizontal: 20,
        marginVertical: 16,
        borderRadius: 12,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTabButton: {
        backgroundColor: colors.primary,
    },
    tabButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    activeTabButtonText: {
        color: '#fff',
    },
    tabContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    recommendationCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    recommendationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    recommendationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    recommendationText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    reasonText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    statsCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 16,
    },
    statRow: {
        marginBottom: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        flex: 1,
    },
    statComparison: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    useCasesCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    useCaseSection: {
        marginBottom: 16,
    },
    useCaseTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    useCaseText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    ingredientSection: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    ingredientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    ingredientSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    ingredientItem: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    ingredientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    ingredientQuantity: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    ingredientImpact: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    quantityComparison: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    originalQuantity: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    newQuantity: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    unchangedCount: {
        fontSize: 14,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    nutritionCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    healthImpactSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    healthImpactTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    healthImpactBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    healthImpactText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    nutritionDetails: {
        gap: 12,
    },
    nutritionRow: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    nutritionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    nutritionComparison: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    nutritionPercentage: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    nutritionImpact: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    timingCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
    },
    timingSection: {
        marginBottom: 16,
    },
    timingSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    timingComparison: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timingValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    efficiencySection: {
        marginBottom: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    efficiencyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    efficiencyText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    difficultySection: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    difficultyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    difficultyComparison: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    difficultyValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    difficultyReason: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 12,
    },
    skillRequirementsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    skillRequirement: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
});