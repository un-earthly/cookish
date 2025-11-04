import { StyleSheet } from 'react-native';

// Minimal dark greenish teal theme
export const colors = {
  gradientStart: '#061007',  // Very dark greenish base
  gradientMiddle: '#0D1F12', // Dark forest green
  gradientEnd: '#1A3A2E',    // Deep teal green

  // Glass backgrounds (with transparency)
  glassLight: 'rgba(255, 255, 255, 0.08)',
  glassMedium: 'rgba(255, 255, 255, 0.12)',
  glassStrong: 'rgba(255, 255, 255, 0.18)',

  // Accent colors - Greenish teal theme
  primary: '#2EC4B6',    // Bright teal
  secondary: '#4ECDC4',  // Light teal
  accent: '#7FD1B9',     // Soft mint green

  // Text colors
  textPrimary: '#E8F5E9',
  textSecondary: '#A5D6A7',
  textLight: '#ffffff',

  // Status colors
  success: '#4CAF50',  // Green
  error: '#EF5350',    // Red
  warning: '#FFA726',  // Orange
  info: '#42A5F5',     // Blue
};

// Glassmorphism styles
export const glassStyles = StyleSheet.create({
  // Basic glass containers
  glassContainer: {
    backgroundColor: colors.glassLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },

  glassContainerStrong: {
    backgroundColor: colors.glassStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },

  // Card styles
  glassCard: {
    backgroundColor: colors.glassMedium,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  // Button styles
  glassButton: {
    backgroundColor: colors.glassLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  // Input styles
  glassInput: {
    backgroundColor: colors.glassLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
  },

  // Badge styles
  glassBadge: {
    backgroundColor: colors.glassLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Header styles
  glassHeader: {
    backgroundColor: colors.glassMedium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
});

// Gradient background positions
export const gradientColors: readonly [string, string, string] = [colors.gradientStart, colors.gradientMiddle, colors.gradientEnd];
export const gradientLocations: readonly [number, number, number] = [0, 0.5, 1];
