import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Grid2X2, Grid3X3, Maximize2 } from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';

interface WidgetModeModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'small' | 'large' | 'horizontal' | 'close') => void;
}

export function WidgetModeModal({
  visible,
  onClose,
  onSelectMode,
}: WidgetModeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={styles.blurOverlay}>
          <View style={styles.modalContainer}>
            <BlurView intensity={30} tint="light" style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>Switch to Widget Mode?</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Keep your recipes accessible on your home screen
              </Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => onSelectMode('small')}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={20} tint="light" style={styles.optionContent}>
                    <Grid2X2 size={32} color={colors.primary} />
                    <Text style={styles.optionTitle}>2×2 Widget</Text>
                    <Text style={styles.optionDescription}>
                      Compact view with today's recipe
                    </Text>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => onSelectMode('large')}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={20} tint="light" style={styles.optionContent}>
                    <Grid3X3 size={32} color={colors.primary} />
                    <Text style={styles.optionTitle}>4×4 Widget</Text>
                    <Text style={styles.optionDescription}>
                      Full view with all 3 recipes
                    </Text>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, styles.horizontalOption]}
                  onPress={() => onSelectMode('horizontal')}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={20} tint="light" style={styles.optionContent}>
                    <Maximize2 size={32} color={colors.primary} />
                    <Text style={styles.optionTitle}>Horizontal Widget</Text>
                    <Text style={styles.optionDescription}>
                      Wide view across screen
                    </Text>
                  </BlurView>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeAppButton}
                onPress={() => onSelectMode('close')}
                activeOpacity={0.8}
              >
                <Text style={styles.closeAppText}>Close App Completely</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    ...glassStyles.glassContainer,
    padding: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  option: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  horizontalOption: {
    // Additional styling if needed
  },
  optionContent: {
    ...glassStyles.glassCard,
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  optionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  closeAppButton: {
    ...glassStyles.glassButton,
    padding: 16,
    alignItems: 'center',
    borderColor: 'rgba(239, 83, 80, 0.5)',
  },
  closeAppText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
