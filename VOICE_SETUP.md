# Voice Input Setup Guide

To enable full voice input functionality, you need to install the following Expo packages:

## Required Packages

```bash
expo install expo-av expo-file-system
```

## Permissions

The app.json has already been configured with the necessary microphone permissions:

```json
{
  "plugins": [
    [
      "expo-av",
      {
        "microphonePermission": "Allow Cookish to access your microphone for voice recipe requests."
      }
    ]
  ]
}
```

## Implementation Status

✅ **Voice Service**: Complete with placeholder implementations
✅ **UI Components**: Voice recording button with animations
✅ **Permissions**: Configured in app.json
✅ **Integration**: Connected to chat service
⚠️ **Audio Recording**: Requires expo-av package installation
⚠️ **Speech Recognition**: Currently uses simulated transcription

## Production Setup

1. Install the required packages:
   ```bash
   expo install expo-av expo-file-system
   ```

2. Uncomment the imports in `services/voiceService.ts`:
   ```typescript
   import { Audio } from 'expo-av';
   import * as FileSystem from 'expo-file-system';
   ```

3. Replace placeholder implementations with actual Audio API calls

4. Integrate with a speech-to-text service:
   - Google Cloud Speech-to-Text
   - AWS Transcribe
   - Azure Speech Services
   - OpenAI Whisper API

## Current Functionality

Even without the packages installed, the voice input system provides:
- ✅ Voice recording UI with animations
- ✅ Permission handling
- ✅ Simulated transcription with cooking-related phrases
- ✅ Integration with chat and recipe generation
- ✅ Error handling and user feedback

The system gracefully falls back to simulated functionality when packages are not available.