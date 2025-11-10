import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  X,
  Smartphone,
  Tablet,
  Monitor,
  Home
} from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';

interface WidgetModeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'small' | 'large' | 'horizontal' | 'close') => void;
}

export function WidgetModeModal({
  visible,
  onClose,
  onSelectMode
}: WidgetModeModalProps) {
  const handleModeSelect = (mode: 'small' | 'large' | 'horizontal' | 'close') => {
    onSelectMode(mode);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={30} tint="dark" style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Widget Mode</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Choose how you want to display the app on your home screen
            </Text>

            {/* Widget Options */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleModeSelect('small')}
              >
                <Smartphone size={32} color={colors.primary} />
                <Text style={styles.optionTitle}>Small Widget</Text>
                <Text style={styles.optionDescription}>2×2 compact view</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleModeSelect('large')}
              >
                <Tablet size={32} color={colors.primary} />
                <Text style={styles.optionTitle}>Large Widget</Text>
                <Text style={styles.optionDescription}>4×4 detailed view</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => handleModeSelect('horizontal')}
              >
                <Monitor size={32} color={colors.primary} />
                <Text style={styles.optionTitle}>Horizontal Widget</Text>
                <Text style={styles.optionDescription}>Wide landscape view</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, styles.closeOptionButton]}
                onPress={() => handleModeSelect('close')}
              >
                <Home size={32} color={colors.error} />
                <Text style={[styles.optionTitle, { color: colors.error }]}>Close App</Text>
                <Text style={styles.optionDescription}>Exit completely</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: colors.glassLight,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeOptionButton: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});