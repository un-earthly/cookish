import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal, TextInput, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Recipe } from '@/types/recipe';
import { Clock, Users, DollarSign, ChefHat, Save, Edit3, GitBranch, History } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, glassStyles } from '@/styles/theme';
import { RecipeComparisonComponent } from './RecipeComparison';
import { RecipeHistory } from './RecipeHistory';

interface ChatRecipeCardProps {
    recipe: Recipe;
    onSave?: () => void;
    onModify?: (request: string) => void;
    sessionId?: string;
    showVariationOptions?: boolean;
}

export function ChatRecipeCard({
    recipe,
    onSave,
    onModify,
    sessionId,
    showVariationOptions = true
}: ChatRecipeCardProps) {
    const [showModifyModal, setShowModifyModal] = useState(false);
    const [showComparisonModal, setShowComparisonModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [modificationRequest, setModificationRequest] = useState('');

    const totalTime = recipe.prep_time + recipe.cook_time;

    const handleViewRecipe = () => {
        router.push({
            pathname: '/(tabs)/recipe-detail',
            params: { id: recipe.id },
        });
    };

    const handleModifyPress = () => {
        setShowModifyModal(true);
    };

    const handleSubmitModification = () => {
        if (modificationRequest.trim() && onModify) {
            onModify(modificationRequest.trim());
            setModificationRequest('');
            setShowModifyModal(false);
        } else {
            Alert.alert('Error', 'Please enter a modification request');
        }
    };

    const handleShowComparison = () => {
        setShowComparisonModal(true);
    };

    const handleShowHistory = () => {
        if (sessionId) {
            setShowHistoryModal(true);
        } else {
            Alert.alert('Info', 'Recipe history is only available for chat conversations');
        }
    };

    const getDifficultyColor = () => {
        switch (recipe.difficulty) {
            case 'Easy':
                return colors.success;
            case 'Medium':
                return colors.warning;
            case 'Hard':
                return colors.error;
            default:
                return colors.primary;
        }
    };

    return (
        <BlurView intensity={15} tint="light" style={styles.card}>
            {/* Recipe Image */}
            {recipe.image_url && (
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: recipe.image_url }}
                        style={styles.recipeImage}
                        resizeMode="cover"
                    />
                    <View style={styles.imageOverlay}>
                        {recipe.difficulty && (
                            <View style={[
                                styles.difficultyBadge,
                                { backgroundColor: getDifficultyColor() }
                            ]}>
                                <Text style={styles.difficultyText}>
                                    {recipe.difficulty}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Recipe Header */}
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <ChefHat size={20} color={colors.primary} />
                    <Text style={styles.title} numberOfLines={2}>
                        {recipe.recipe_name}
                    </Text>
                </View>

                {recipe.cuisine_type && (
                    <View style={styles.cuisineBadge}>
                        <Text style={styles.cuisineText}>
                            {recipe.cuisine_type}
                        </Text>
                    </View>
                )}
            </View>

            {/* Recipe Info */}
            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <Clock size={14} color={colors.primary} />
                    <Text style={styles.infoText}>{totalTime} min</Text>
                </View>
                <View style={styles.infoItem}>
                    <Users size={14} color={colors.primary} />
                    <Text style={styles.infoText}>{recipe.servings} servings</Text>
                </View>
                {recipe.estimated_cost && (
                    <View style={styles.infoItem}>
                        <DollarSign size={14} color={colors.primary} />
                        <Text style={styles.infoText}>
                            ${recipe.estimated_cost.toFixed(2)}
                        </Text>
                    </View>
                )}
            </View>

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                    {recipe.tags.slice(0, 3).map((tag, index) => (
                        <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                    {recipe.tags.length > 3 && (
                        <Text style={styles.moreTagsText}>
                            +{recipe.tags.length - 3} more
                        </Text>
                    )}
                </View>
            )}

            {/* Ingredients Preview */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
                <View style={styles.ingredientsPreview}>
                    <Text style={styles.ingredientsTitle}>Key Ingredients:</Text>
                    <Text style={styles.ingredientsText} numberOfLines={2}>
                        {recipe.ingredients
                            .slice(0, 4)
                            .map(ing => typeof ing === 'string' ? ing : ing.name)
                            .join(', ')}
                        {recipe.ingredients.length > 4 && '...'}
                    </Text>
                </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={onSave}
                >
                    <Save size={14} color={colors.primary} />
                    <Text style={styles.actionButtonText}>Save</Text>
                </TouchableOpacity>

                {onModify && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleModifyPress}
                    >
                        <Edit3 size={14} color={colors.secondary} />
                        <Text style={styles.actionButtonText}>Modify</Text>
                    </TouchableOpacity>
                )}

                {showVariationOptions && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleShowComparison}
                    >
                        <GitBranch size={14} color={colors.warning} />
                        <Text style={styles.actionButtonText}>Compare</Text>
                    </TouchableOpacity>
                )}

                {showVariationOptions && sessionId && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleShowHistory}
                    >
                        <History size={14} color={colors.info} />
                        <Text style={styles.actionButtonText}>History</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.viewButton}
                    onPress={handleViewRecipe}
                >
                    <Text style={styles.viewButtonText}>View Recipe</Text>
                </TouchableOpacity>
            </View>

            {/* Modification Modal */}
            <Modal
                visible={showModifyModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowModifyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} tint="dark" style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Modify Recipe</Text>
                            <Text style={styles.modalSubtitle}>
                                How would you like to modify "{recipe.recipe_name}"?
                            </Text>

                            <TextInput
                                style={styles.modificationInput}
                                placeholder="e.g., make it spicier, add more vegetables, make it vegan..."
                                placeholderTextColor={colors.textSecondary}
                                value={modificationRequest}
                                onChangeText={setModificationRequest}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalCancelButton}
                                    onPress={() => {
                                        setShowModifyModal(false);
                                        setModificationRequest('');
                                    }}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalSubmitButton}
                                    onPress={handleSubmitModification}
                                >
                                    <Text style={styles.modalSubmitText}>Modify Recipe</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </BlurView>
                </View>
            </Modal>

            {/* Comparison Modal */}
            <Modal
                visible={showComparisonModal}
                animationType="slide"
                onRequestClose={() => setShowComparisonModal(false)}
            >
                <RecipeComparisonComponent
                    recipeId={recipe.id}
                    onClose={() => setShowComparisonModal(false)}
                />
            </Modal>

            {/* History Modal */}
            <Modal
                visible={showHistoryModal}
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                {sessionId && (
                    <RecipeHistory
                        sessionId={sessionId}
                        onClose={() => setShowHistoryModal(false)}
                    />
                )}
            </Modal>
        </BlurView>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    imageContainer: {
        position: 'relative',
        height: 120,
    },
    recipeImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    difficultyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    difficultyText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    header: {
        padding: 12,
        paddingBottom: 8,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    title: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    cuisineBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.glassLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    cuisineText: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    infoText: {
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        paddingBottom: 8,
        gap: 6,
    },
    tag: {
        backgroundColor: colors.glassLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    tagText: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    moreTagsText: {
        fontSize: 10,
        color: colors.textSecondary,
        fontStyle: 'italic',
        alignSelf: 'center',
    },
    ingredientsPreview: {
        paddingHorizontal: 12,
        paddingBottom: 8,
    },
    ingredientsTitle: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
        marginBottom: 4,
    },
    ingredientsText: {
        fontSize: 12,
        color: colors.textPrimary,
        lineHeight: 16,
    },
    actionRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 4,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.2)',
    },
    actionButtonText: {
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    viewButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        backgroundColor: colors.glassLight,
    },
    viewButtonText: {
        fontSize: 12,
        color: colors.textPrimary,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalContent: {
        padding: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 20,
    },
    modificationInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 12,
        color: colors.textPrimary,
        fontSize: 16,
        minHeight: 80,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
    },
    modalCancelText: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    modalSubmitButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    modalSubmitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});