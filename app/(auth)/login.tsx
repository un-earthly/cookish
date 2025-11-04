import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { colors, glassStyles, gradientColors, gradientLocations } from '@/styles/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signUp } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await signUp(email, password);
        setError('Account created! Please sign in.');
        setIsSignUp(false);
      } else {
        await signIn(email, password);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Daily Recipe Generator</Text>
        <Text style={styles.subtitle}>
          Get 3 fresh recipes every day tailored to your taste
        </Text>

        {error ? (
          <BlurView intensity={20} tint="light" style={styles.errorContainer}>
            <Text style={styles.error}>{error}</Text>
          </BlurView>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
          activeOpacity={0.8}
        >
          <BlurView intensity={30} tint="light" style={styles.buttonBlur}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
  },
  input: {
    ...glassStyles.glassInput,
    marginBottom: 16,
    color: '#fff',
  },
  button: {
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonBlur: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    ...glassStyles.glassCard,
    marginBottom: 16,
    overflow: 'hidden',
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
});
