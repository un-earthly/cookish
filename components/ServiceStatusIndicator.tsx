import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import {
    Wifi, WifiOff, AlertTriangle, CheckCircle, Clock,
    Mic, Image, MessageCircle, Database, Zap, X, RefreshCw
} from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';
import { useAppIntegration } from '@/hooks/useAppIntegration';

interface ServiceStatusIndicatorProps {
    showDetails?: boolean;
    compact?: boolean;
}

export function ServiceStatusIndicator({
    showDetails = false,
    compact = false
}: ServiceStatusIndicatorProps) {
    const [showModal, setShowModal] = useState(false);
    const {
        serviceHealth,
        availableFeatures,
        isInitialized,
        isInitializing,
        refreshServiceStatus,
        resetServices
    } = useAppIntegration();

    if (!isInitialized && !isInitializing) {
        return null;
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return colors.success;
            case 'degraded':
                return colors.warning;
            case 'unhealthy':
                return colors.error;
            case 'unavailable':
                return colors.textSecondary;
            default:
                return colors.textSecondary;
        }
    };

    const getStatusIcon = (status: string, size: number = 16) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle size={size} color={colors.success} />;
            case 'degraded':
                return <Clock size={size} color={colors.warning} />;
            case 'unhealthy':
                return <AlertTriangle size={size} color={colors.error} />;
            case 'unavailable':
                return <X size={size} color={colors.textSecondary} />;
            default:
                return <Clock size={size} color={colors.textSecondary} />;
        }
    };

    const getServiceIcon = (serviceName: string, size: number = 16) => {
        switch (serviceName) {
            case 'database':
                return <Database size={size} color={colors.primary} />;
            case 'aiRouter':
                return <Zap size={size} color={colors.primary} />;
            case 'imageService':
                return <Image size={size} color={colors.primary} />;
            case 'voiceService':
                return <Mic size={size} color={colors.primary} />;
            case 'cacheService':
                return <MessageCircle size={size} color={colors.primary} />;
            default:
                return <CheckCircle size={size} color={colors.primary} />;
        }
    };

    const getServiceDisplayName = (serviceName: string) => {
        switch (serviceName) {
            case 'database':
                return 'Database';
            case 'aiRouter':
                return 'AI Services';
            case 'imageService':
                return 'Images';
            case 'voiceService':
                return 'Voice Input';
            case 'cacheService':
                return 'Cache';
            default:
                return serviceName;
        }
    };

    const handleRefresh = async () => {
        await refreshServiceStatus();
    };

    const handleReset = async () => {
        await resetServices();
        setShowModal(false);
    };

    if (compact) {
        return (
            <TouchableOpacity
                style={styles.compactIndicator}
                onPress={() => setShowModal(true)}
            >
                {isInitializing ? (
                    <RefreshCw size={16} color={colors.warning} />
                ) : (
                    getStatusIcon(serviceHealth?.overall || 'unhealthy', 16)
                )}
            </TouchableOpacity>
        );
    }

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.statusIndicator,
                    { borderColor: getStatusColor(serviceHealth?.overall || 'unhealthy') }
                ]}
                onPress={() => setShowModal(true)}
            >
                <View style={styles.statusHeader}>
                    {isInitializing ? (
                        <RefreshCw size={16} color={colors.warning} />
                    ) : (
                        getStatusIcon(serviceHealth?.overall || 'unhealthy', 16)
                    )}
                    <Text style={styles.statusText}>
                        {isInitializing ? 'Initializing...' :
                            serviceHealth?.overall === 'healthy' ? 'All Systems Operational' :
                                serviceHealth?.overall === 'degraded' ? 'Limited Functionality' :
                                    'Service Issues'}
                    </Text>
                </View>

                {showDetails && serviceHealth && (
                    <View style={styles.detailsContainer}>
                        {serviceHealth.capabilities.length > 0 && (
                            <Text style={styles.capabilitiesText}>
                                ✓ {serviceHealth.capabilities.slice(0, 2).join(', ')}
                                {serviceHealth.capabilities.length > 2 && ` +${serviceHealth.capabilities.length - 2} more`}
                            </Text>
                        )}
                        {serviceHealth.limitations.length > 0 && (
                            <Text style={styles.limitationsText}>
                                ⚠ {serviceHealth.limitations[0]}
                            </Text>
                        )}
                    </View>
                )}
            </TouchableOpacity>

            {/* Detailed Status Modal */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} tint="dark" style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Service Status</Text>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => setShowModal(false)}
                                >
                                    <X size={24} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Overall Status */}
                                <View style={styles.overallStatus}>
                                    {getStatusIcon(serviceHealth?.overall || 'unhealthy', 24)}
                                    <Text style={styles.overallStatusText}>
                                        {serviceHealth?.overall === 'healthy' ? 'All Systems Operational' :
                                            serviceHealth?.overall === 'degraded' ? 'Limited Functionality' :
                                                'Service Issues Detected'}
                                    </Text>
                                </View>

                                {/* Individual Services */}
                                {serviceHealth && (
                                    <View style={styles.servicesContainer}>
                                        <Text style={styles.sectionTitle}>Services</Text>
                                        {Object.entries(serviceHealth.services).map(([serviceName, status]) => (
                                            <View key={serviceName} style={styles.serviceItem}>
                                                <View style={styles.serviceInfo}>
                                                    {getServiceIcon(serviceName, 20)}
                                                    <Text style={styles.serviceName}>
                                                        {getServiceDisplayName(serviceName)}
                                                    </Text>
                                                </View>
                                                <View style={styles.serviceStatus}>
                                                    {getStatusIcon(status, 16)}
                                                    <Text style={[
                                                        styles.serviceStatusText,
                                                        { color: getStatusColor(status) }
                                                    ]}>
                                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Available Features */}
                                {availableFeatures && (
                                    <View style={styles.featuresContainer}>
                                        <Text style={styles.sectionTitle}>Available Features</Text>
                                        {Object.entries(availableFeatures).map(([feature, available]) => (
                                            <View key={feature} style={styles.featureItem}>
                                                <Text style={styles.featureName}>
                                                    {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                </Text>
                                                {available ? (
                                                    <CheckCircle size={16} color={colors.success} />
                                                ) : (
                                                    <X size={16} color={colors.error} />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Capabilities */}
                                {serviceHealth?.capabilities && serviceHealth.capabilities.length > 0 && (
                                    <View style={styles.capabilitiesContainer}>
                                        <Text style={styles.sectionTitle}>Active Capabilities</Text>
                                        {serviceHealth.capabilities.map((capability, index) => (
                                            <View key={index} style={styles.capabilityItem}>
                                                <CheckCircle size={14} color={colors.success} />
                                                <Text style={styles.capabilityText}>{capability}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Limitations */}
                                {serviceHealth?.limitations && serviceHealth.limitations.length > 0 && (
                                    <View style={styles.limitationsContainer}>
                                        <Text style={styles.sectionTitle}>Current Limitations</Text>
                                        {serviceHealth.limitations.map((limitation, index) => (
                                            <View key={index} style={styles.limitationItem}>
                                                <AlertTriangle size={14} color={colors.warning} />
                                                <Text style={styles.limitationText}>{limitation}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Action Buttons */}
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={styles.refreshButton}
                                        onPress={handleRefresh}
                                    >
                                        <RefreshCw size={16} color="#fff" />
                                        <Text style={styles.refreshButtonText}>Refresh Status</Text>
                                    </TouchableOpacity>

                                    {serviceHealth?.overall !== 'healthy' && (
                                        <TouchableOpacity
                                            style={styles.resetButton}
                                            onPress={handleReset}
                                        >
                                            <AlertTriangle size={16} color={colors.error} />
                                            <Text style={styles.resetButtonText}>Reset Services</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </BlurView>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    compactIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glassLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    statusIndicator: {
        backgroundColor: colors.glassLight,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        marginBottom: 8,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    detailsContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
    },
    capabilitiesText: {
        fontSize: 12,
        color: colors.success,
        marginBottom: 4,
    },
    limitationsText: {
        fontSize: 12,
        color: colors.warning,
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
        maxHeight: '80%',
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalContent: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    closeButton: {
        padding: 4,
    },
    overallStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
        padding: 16,
        backgroundColor: colors.glassLight,
        borderRadius: 8,
    },
    overallStatusText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    servicesContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    serviceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.glassLight,
        borderRadius: 6,
        marginBottom: 8,
    },
    serviceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    serviceName: {
        fontSize: 14,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    serviceStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    featuresContainer: {
        marginBottom: 20,
    },
    featureItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    featureName: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    capabilitiesContainer: {
        marginBottom: 20,
    },
    capabilityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    capabilityText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    limitationsContainer: {
        marginBottom: 20,
    },
    limitationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    limitationText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    actionButtons: {
        gap: 12,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glassLight,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.error,
        gap: 8,
    },
    resetButtonText: {
        color: colors.error,
        fontSize: 14,
        fontWeight: '600',
    },
});