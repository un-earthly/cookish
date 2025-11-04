import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserPreferences,
  saveUserPreferences,
} from '@/services/recipeService';
import { ApiProvider } from '@/types/recipe';
import { Settings as SettingsIcon, LogOut, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiProvider, setApiProvider] = useState<ApiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getUserPreferences();
      if (prefs) {
        setApiProvider(prefs.api_provider);
        setApiKey(prefs.api_key || '');
        setLocation(prefs.location || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await saveUserPreferences({
        api_provider: apiProvider,
        api_key: apiKey.trim(),
        location: location.trim() || 'United States',
      });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
    }
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

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      style={styles.container}
    >
      <BlurView intensity={30} tint="light" style={styles.header}>
        <SettingsIcon size={32} color="#fff" />
        <Text style={styles.title}>Settings</Text>
      </BlurView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {error ? (
          <BlurView intensity={20} tint="light" style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </BlurView>
        ) : null}

        {success ? (
          <BlurView intensity={20} tint="light" style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
          </BlurView>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <BlurView intensity={20} tint="light" style={styles.infoCard}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </BlurView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Configuration</Text>

          <Text style={styles.label}>API Provider</Text>
          <View style={styles.providerRow}>
            <TouchableOpacity
              onPress={() => setApiProvider('openai')}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={apiProvider === 'openai' ? 40 : 20}
                tint="light"
                style={[
                  styles.providerButton,
                  apiProvider === 'openai' && styles.providerButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.providerButtonText,
                    apiProvider === 'openai' && styles.providerButtonTextActive,
                  ]}
                >
                  OpenAI
                </Text>
              </BlurView>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setApiProvider('gemini')}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={apiProvider === 'gemini' ? 40 : 20}
                tint="light"
                style={[
                  styles.providerButton,
                  apiProvider === 'gemini' && styles.providerButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.providerButtonText,
                    apiProvider === 'gemini' && styles.providerButtonTextActive,
                  ]}
                >
                  Google Gemini
                </Text>
              </BlurView>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            placeholder={
              apiProvider === 'openai'
                ? 'sk-...'
                : 'AIzaSy...'
            }
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            {apiProvider === 'openai'
              ? 'Get your API key from platform.openai.com'
              : 'Get your API key from makersuite.google.com/app/apikey'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., United States, California"
            value={location}
            onChangeText={setLocation}
          />
          <Text style={styles.hint}>
            Used to determine seasonal ingredients
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <BlurView intensity={20} tint="light" style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Dietary Restrictions</Text>
          <Text style={styles.infoText}>
            This app generates recipes that exclude:
          </Text>
          <Text style={styles.infoText}>• Rice</Text>
          <Text style={styles.infoText}>• Chicken</Text>
          <Text style={styles.infoText}>• Red meat (beef, lamb, pork)</Text>
          <Text style={styles.infoText}>• Lentils</Text>
          <Text style={styles.infoText}>• Chickpeas</Text>
          <Text style={styles.infoText} />
          <Text style={styles.infoText}>
            Recipes focus on fish, eggs, vegetables, fruits, dairy, and
            alternative grains.
          </Text>
        </BlurView>
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
  },
  header: {
    ...glassStyles.glassHeader,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  infoCard: {
    ...glassStyles.glassCard,
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  providerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  providerButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  providerButtonActive: {
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
  },
  providerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  providerButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    ...glassStyles.glassInput,
    marginBottom: 8,
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  saveButton: {
    ...glassStyles.glassButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    ...glassStyles.glassButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  signOutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    ...glassStyles.glassCard,
    marginBottom: 16,
    overflow: 'hidden',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  successBanner: {
    ...glassStyles.glassCard,
    marginBottom: 16,
    overflow: 'hidden',
  },
  successText: {
    color: colors.success,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoSection: {
    ...glassStyles.glassCard,
    marginTop: 24,
    overflow: 'hidden',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 4,
  },
});
