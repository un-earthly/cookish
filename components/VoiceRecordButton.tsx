import React, { useState, useEffect } from 'react';
import {
    TouchableOpacity,
    StyleSheet,
    Animated,
    View,
    Text,
} from 'react-native';
import { Mic, MicOff, Loader } from 'lucide-react-native';
import { colors, glassStyles } from '@/styles/theme';
import { voiceService } from '@/services/voiceService';
import { ProcessingState } from '@/types/recipe';

interface VoiceRecordButtonProps {
    onTranscript: (transcript: string) => void;
    disabled?: boolean;
    processingState?: ProcessingState;
}

export function VoiceRecordButton({
    onTranscript,
    disabled = false,
    processingState
}: VoiceRecordButtonProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [pulseAnim] = useState(new Animated.Value(1));
    const [isVoiceSupported, setIsVoiceSupported] = useState(false);

    useEffect(() => {
        checkVoiceSupport();
    }, []);

    useEffect(() => {
        if (processingState) {
            setIsRecording(processingState.isListening);
            setIsTranscribing(processingState.isTranscribing);
        }
    }, [processingState]);

    useEffect(() => {
        if (isRecording) {
            startPulseAnimation();
        } else {
            stopPulseAnimation();
        }
    }, [isRecording]);

    const checkVoiceSupport = async () => {
        try {
            const supported = await voiceService.isVoiceInputSupported();
            setIsVoiceSupported(supported);
        } catch (error) {
            console.error('Failed to check voice support:', error);
            setIsVoiceSupported(false);
        }
    };

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const stopPulseAnimation = () => {
        pulseAnim.stopAnimation();
        Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = async () => {
        if (disabled || !isVoiceSupported) return;

        try {
            if (isRecording) {
                // Stop recording
                const transcript = await voiceService.stopRecording();
                setIsRecording(false);

                if (transcript && transcript.trim()) {
                    onTranscript(transcript);
                }
            } else {
                // Start recording
                setIsRecording(true);
                await voiceService.startRecording();
            }
        } catch (error) {
            console.error('Voice recording error:', error);
            setIsRecording(false);
            setIsTranscribing(false);
        }
    };

    const getButtonIcon = () => {
        if (isTranscribing) {
            return <Loader size={20} color="#fff" />;
        }
        if (isRecording) {
            return <MicOff size={20} color="#fff" />;
        }
        if (!isVoiceSupported) {
            return <MicOff size={20} color="rgba(255, 255, 255, 0.5)" />;
        }
        return <Mic size={20} color="#fff" />;
    };

    const getButtonStyle = () => {
        if (!isVoiceSupported || disabled) {
            return [styles.button, styles.buttonDisabled];
        }
        if (isRecording) {
            return [styles.button, styles.buttonRecording];
        }
        return styles.button;
    };

    const getStatusText = () => {
        if (!isVoiceSupported) {
            return 'Voice not available';
        }
        if (isTranscribing) {
            return 'Processing...';
        }
        if (isRecording) {
            return 'Tap to stop';
        }
        return 'Hold to speak';
    };

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.buttonContainer,
                    {
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            >
                <TouchableOpacity
                    style={getButtonStyle()}
                    onPress={handlePress}
                    disabled={disabled || !isVoiceSupported}
                    activeOpacity={0.8}
                >
                    {getButtonIcon()}
                </TouchableOpacity>
            </Animated.View>

            {(isRecording || isTranscribing) && (
                <Text style={styles.statusText}>
                    {getStatusText()}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    buttonContainer: {
        position: 'relative',
    },
    button: {
        ...glassStyles.glassButton,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    buttonRecording: {
        backgroundColor: colors.error,
    },
    buttonDisabled: {
        backgroundColor: colors.glassLight,
        opacity: 0.5,
    },
    statusText: {
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
});