import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Download, Check, Trash2, ChevronDown, X } from 'lucide-react-native';
import {
    llamaService,
    LlamaModel,
    AVAILABLE_MODELS,
    ModelDownloadProgress,
} from '@/services/llamaService';
import { colors, glassStyles } from '@/styles/theme';

interface ModelSelectorProps {
    selectedModel: LlamaModel | null;
    onModelSelect: (model: LlamaModel) => void;
    disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelSelect, disabled }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
    const [downloadProgress, setDownloadProgress] = useState<Map<string, ModelDownloadProgress>>(
        new Map()
    );
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadDownloadedModels();
    }, []);

    const loadDownloadedModels = async () => {
        try {
            const downloaded = await llamaService.getDownloadedModels();
            setDownloadedModels(new Set(downloaded.map((m) => m.id)));
        } catch (error) {
            console.error('Error loading downloaded models:', error);
        }
    };

    const handleDownload = async (model: LlamaModel) => {
        setLoading(true);
        const success = await llamaService.downloadModel(model, (progress) => {
            setDownloadProgress((prev) => new Map(prev).set(model.id, progress));
        });

        if (success) {
            await loadDownloadedModels();
        } else {
            Alert.alert('Download Failed', 'Failed to download the model. Please try again.');
        }
        setLoading(false);
    };

    const handleDelete = async (model: LlamaModel) => {
        Alert.alert(
            'Delete Model',
            `Are you sure you want to delete ${model.displayName}? This will free up ${model.size}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await llamaService.deleteModel(model);
                        if (success) {
                            await loadDownloadedModels();
                            if (selectedModel?.id === model.id) {
                                onModelSelect(null as any);
                            }
                        } else {
                            Alert.alert('Delete Failed', 'Failed to delete the model.');
                        }
                    },
                },
            ]
        );
    };

    const handleSelectModel = async (model: LlamaModel) => {
        const isDownloaded = downloadedModels.has(model.id);

        if (!isDownloaded) {
            Alert.alert(
                'Model Not Downloaded',
                'This model needs to be downloaded first. Would you like to download it now?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Download',
                        onPress: () => handleDownload(model),
                    },
                ]
            );
            return;
        }

        onModelSelect(model);
        setIsOpen(false);
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getProgressForModel = (modelId: string): ModelDownloadProgress | undefined => {
        return downloadProgress.get(modelId);
    };

    return (
        <>
            <TouchableOpacity
                style={[styles.selectorButton, disabled && styles.disabled]}
                onPress={() => setIsOpen(true)}
                disabled={disabled}
            >
                <View style={styles.selectorContent}>
                    <Text style={styles.selectorLabel}>Model</Text>
                    <Text style={styles.selectorValue} numberOfLines={1}>
                        {selectedModel ? selectedModel.displayName : 'Select a model'}
                    </Text>
                </View>
                <ChevronDown size={20} color="#fff" />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                animationType="slide"
                transparent
                onRequestClose={() => setIsOpen(false)}
            >
                <BlurView intensity={40} tint="dark" style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select AI Model</Text>
                            <TouchableOpacity onPress={() => setIsOpen(false)}>
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false}>
                            {AVAILABLE_MODELS.map((model) => {
                                const isDownloaded = downloadedModels.has(model.id);
                                const isSelected = selectedModel?.id === model.id;
                                const progress = getProgressForModel(model.id);
                                const isDownloading = progress?.isDownloading;

                                return (
                                    <TouchableOpacity
                                        key={model.id}
                                        style={[
                                            styles.modelCard,
                                            isSelected && styles.modelCardSelected,
                                        ]}
                                        onPress={() => handleSelectModel(model)}
                                        disabled={loading}
                                    >
                                        <View style={styles.modelInfo}>
                                            <View style={styles.modelHeader}>
                                                <Text style={styles.modelName}>{model.displayName}</Text>
                                                {isSelected && (
                                                    <View style={styles.selectedBadge}>
                                                        <Check size={16} color={colors.primary} />
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.modelDescription}>{model.description}</Text>
                                            <View style={styles.modelMeta}>
                                                <Text style={styles.modelSize}>Size: {model.size}</Text>
                                                <Text style={styles.modelSize}>
                                                    • Context: {model.contextLength.toLocaleString()} tokens
                                                </Text>
                                            </View>

                                            {isDownloading && progress && (
                                                <View style={styles.progressContainer}>
                                                    <View style={styles.progressBar}>
                                                        <View
                                                            style={[
                                                                styles.progressFill,
                                                                { width: `${progress.progress * 100}%` },
                                                            ]}
                                                        />
                                                    </View>
                                                    <Text style={styles.progressText}>
                                                        {Math.round(progress.progress * 100)}% - {formatBytes(progress.bytesWritten)} / {formatBytes(progress.totalBytes)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.modelActions}>
                                            {isDownloading ? (
                                                <ActivityIndicator size="small" color={colors.primary} />
                                            ) : isDownloaded ? (
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(model);
                                                    }}
                                                >
                                                    <Trash2 size={20} color={colors.error} />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleDownload(model);
                                                    }}
                                                >
                                                    <Download size={20} color={colors.primary} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <Text style={styles.footerText}>
                                Downloaded models are stored locally and work offline
                            </Text>
                        </View>
                    </View>
                </BlurView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    selectorButton: {
        ...glassStyles.glassContainer,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
    },
    disabled: {
        opacity: 0.5,
    },
    selectorContent: {
        flex: 1,
    },
    selectorLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: 2,
    },
    selectorValue: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    modelList: {
        padding: 16,
    },
    modelCard: {
        ...glassStyles.glassCard,
        flexDirection: 'row',
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    modelCardSelected: {
        borderColor: colors.primary,
    },
    modelInfo: {
        flex: 1,
    },
    modelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    modelName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
    },
    selectedBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 4,
    },
    modelDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 8,
    },
    modelMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modelSize: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        marginRight: 8,
    },
    progressContainer: {
        marginTop: 12,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    progressText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    modelActions: {
        marginLeft: 12,
        justifyContent: 'center',
    },
    actionButton: {
        padding: 8,
    },
    modalFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    footerText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
    },
});
