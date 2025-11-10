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
    Clock,
    GitBranch,
    RotateCcw,
    TrendingUp,
    MessageCircle,
    Calendar,
    BarChart3,
    Eye,
    Trash2
} from 'lucide-react-native';
import { variationService } from '@/services/variationService';
import { colors, glassStyles } from '@/styles/theme';

interface RecipeHistoryProps {
    recipeId: string;
    onClose: () => void;
    onViewComparison?: (originalId: string, variationId?: string) => void;
    onRollback?: (recipeId: string) => void;
}

interface HistoryData {
    original: any;
    timeline: any[];
    statistics: any;
}

export function RecipeHistory({
    recipeId,
    onClose,
    onViewComparison,
    onRollback
}: RecipeHistoryProps) {
    const [historyData, setHistoryData] = useState<HistoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, [recipeId]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await variationService.getRecipeHistoryTimeline(recipeId);
            setHistoryData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async (targetVersionId?: string) => {
        if (!historyData) return;

        const versionName = targetVersionId
            ? historyData.timeline.find(t => t.id === targetVersionId)?.name || 'selected version'
            : 'original recipe';

        Alert.alert(
            'Rollback Recipe',
            `Are you sure you want to rollback to "${versionName}"? This will create a new recipe with the selected version's settings.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Rollback',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const result = await variationService.rollbackToVersion(
                                recipeId,
                                targetVersionId,
                                `User requested rollback to ${versionName} from history`
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

    const handleDeleteVariation = async (variationId: string) => {
        Alert.alert(
            'Delete Variation',
            'Are you sure you want to delete this recipe variation? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await variationService.deleteVariation(variationId);
                            Alert.alert('Success', 'Variation deleted successfully!');
                            loadHistory(); // Reload to update the timeline
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete variation');
                        }
                    }
                }
            ]
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimelineIcon = (type: string) => {
        switch (type) {
            case 'original':
                return <GitBranch size={20} color={colors.primary} />;
            case 'variation':
                return <TrendingUp size={20} color={colors.success} />;
            case 'rollback':
                return <RotateCcw size={20} color={colors.warning} />;
            default:
                return <Clock size={20} color={colors.textSecondary} />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'original':
                return colors.primary;
            case 'variation':
                return colors.success;
            case 'rollback':
                return colors.warning;
            default:
                return colors.textSecondary;
        }
    };

    const renderStatistics = () => {
        if (!historyData) return null;

        const { statistics } = historyData;

        return (
            <BlurView intensity={20} tint="light" style={styles.statisticsCard}>
                <View style={styles.statisticsHeader}>
                    <BarChart3 size={24} color={colors.primary} />
                    <Text style={styles.statisticsTitle}>Recipe Statistics</Text>
                </View>

                <View style={styles.statisticsGrid}>
                    <View style={styles.statisticItem}>
                        <Text style={styles.statisticValue}>{statistics.total_variations}</Text>
                        <Text style={styles.statisticLabel}>Total Variations</Text>
                    </View>

                    <View style={styles.statisticItem}>
                        <Text style={styles.statisticValue}>
                            {statistics.modification_frequency.toFixed(1)}
                        </Text>
                        <Text style={styles.statisticLabel}>Modifications/Day</Text>
                    </View>
                </View>

                <View style={styles.lastModifiedSection}>
                    <Text style={styles.lastModifiedLabel}>Last Modified:</Text>
                    <Text style={styles.lastModifiedValue}>
                        {formatDate(statistics.most_recent_modification)}
                    </Text>
                </View>

                {statistics.popular_modification_types.length > 0 && (
                    <View style={styles.popularModsSection}>
                        <Text style={styles.popularModsTitle}>Popular Modifications:</Text>
                        {statistics.popular_modification_types.map((type: string, index: number) => (
                            <Text key={index} style={styles.popularModType}>
                                • {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                        ))}
                    </View>
                )}
            </BlurView>
        );
    };

    const renderTimelineItem = (item: any, index: number) => {
        const isLast = index === historyData!.timeline.length - 1;

        return (
            <View key={item.id} style={styles.timelineItem}>
                {/* Timeline Line */}
                <View style={styles.timelineLine}>
                    <View style={[styles.timelineIcon, { borderColor: getTypeColor(item.type) }]}>
                        {getTimelineIcon(item.type)}
                    </View>
                    {!isLast && <View style={styles.timelineConnector} />}
                </View>

                {/* Timeline Content */}
                <BlurView intensity={20} tint="light" style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                        <View style={styles.timelineInfo}>
                            <Text style={styles.timelineName}>{item.name}</Text>
                            <Text style={styles.timelineDescription}>{item.description}</Text>
                        </View>
                        <View style={styles.timelineActions}>
                            {item.type !== 'original' && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => onViewComparison?.(recipeId, item.id)}
                                        style={styles.actionButton}
                                    >
                                        <Eye size={16} color={colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteVariation(item.id)}
                                        style={styles.actionButton}
                                    >
                                        <Trash2 size={16} color={colors.error} />
                                    </TouchableOpacity>
                                </>
                            )}
                            <TouchableOpacity
                                onPress={() => handleRollback(item.type === 'original' ? undefined : item.id)}
                                style={styles.actionButton}
                            >
                                <RotateCcw size={16} color={colors.warning} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.timelineMetadata}>
                        <View style={styles.metadataItem}>
                            <Calendar size={14} color={colors.textSecondary} />
                            <Text style={styles.metadataText}>{formatDate(item.created_at)}</Text>
                        </View>

                        <View style={styles.metadataItem}>
                            <Text style={[styles.createdViaTag, { backgroundColor: getTypeColor(item.type) }]}>
                                {item.created_via.toUpperCase()}
                            </Text>
                        </View>

                        {item.chat_session_id && (
                            <View style={styles.metadataItem}>
                                <MessageCircle size={14} color={colors.textSecondary} />
                                <Text style={styles.metadataText}>From Chat</Text>
                            </View>
                        )}
                    </View>

                    {item.changes_summary && item.changes_summary.length > 0 && (
                        <View style={styles.changesSummary}>
                            <Text style={styles.changesSummaryTitle}>Changes:</Text>
                            {item.changes_summary.map((change: string, changeIndex: number) => (
                                <Text key={changeIndex} style={styles.changesSummaryItem}>
                                    • {change}
                                </Text>
                            ))}
                        </View>
                    )}
                </BlurView>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading recipe history...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={loadHistory} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!historyData) {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <BlurView intensity={20} tint="light" style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recipe History</Text>
                <View style={styles.headerSpacer} />
            </BlurView>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Recipe Info */}
                <BlurView intensity={20} tint="light" style={styles.recipeInfoCard}>
                    <Text style={styles.recipeTitle}>{historyData.original.recipe_name}</Text>
                    <Text style={styles.recipeSubtitle}>
                        {historyData.original.cuisine_type} • {historyData.original.difficulty}
                    </Text>
                </BlurView>

                {/* Statistics */}
                {renderStatistics()}

                {/* Timeline */}
                <View style={styles.timelineSection}>
                    <Text style={styles.timelineSectionTitle}>Modification Timeline</Text>
                    <View style={styles.timeline}>
                        {historyData.timeline.map((item, index) => renderTimelineItem(item, index))}
                    </View>
                </View>
            </ScrollView>
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
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    recipeInfoCard: {
        ...glassStyles.glassCard,
        marginBottom: 16,
        alignItems: 'center',
    },
    recipeTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
    },
    recipeSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    statisticsCard: {
        ...glassStyles.glassCard,
        marginBottom: 20,
    },
    statisticsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    statisticsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    statisticsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    statisticItem: {
        alignItems: 'center',
    },
    statisticValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 4,
    },
    statisticLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    lastModifiedSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    lastModifiedLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    lastModifiedValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    popularModsSection: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    popularModsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 8,
    },
    popularModType: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    timelineSection: {
        marginBottom: 20,
    },
    timelineSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 16,
    },
    timeline: {
        paddingLeft: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineLine: {
        alignItems: 'center',
        marginRight: 16,
    },
    timelineIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        backgroundColor: colors.glassLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    timelineConnector: {
        width: 2,
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginTop: -8,
    },
    timelineContent: {
        ...glassStyles.glassCard,
        flex: 1,
        marginBottom: 0,
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    timelineInfo: {
        flex: 1,
        marginRight: 12,
    },
    timelineName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    timelineDescription: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    timelineActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glassLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    timelineMetadata: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    metadataItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metadataText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    createdViaTag: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    changesSummary: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    changesSummaryTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 6,
    },
    changesSummaryItem: {
        fontSize: 11,
        color: colors.textSecondary,
        marginBottom: 2,
    },
});