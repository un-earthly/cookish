# Offline LLM Setup for Cookish

This guide will help you set up offline AI capabilities using local LLM models.

## Overview

The app now supports both online and offline AI modes:
- **Online Mode**: Uses cloud-based AI services (OpenAI, Anthropic, etc.)
- **Offline Mode**: Uses locally downloaded LLM models that run on-device

## Installation

### 1. Install Required Dependencies

```bash
npm install llama.rn
```

**Note**: This app uses `expo-file-system` which is already included with Expo, so no additional file system package is needed.

### 2. iOS Setup

For iOS, you need to enable Metal support for GPU acceleration:

```bash
cd ios
pod install
cd ..
```

Add the following to your `Info.plist`:

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

### 3. Android Setup

For Android, add the following to `android/app/build.gradle`:

```gradle
android {
    // ... existing config
    
    packagingOptions {
        pickFirst 'lib/x86/libc++_shared.so'
        pickFirst 'lib/x86_64/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
    }
}
```

## Usage

### Using the Chat Screen

1. **Navigate to Chat Tab**: Open the chat screen from the bottom navigation
2. **Select a Model**: 
   - Tap on the "Model" selector at the bottom
   - Browse available models
   - Download a model by tapping the download icon
3. **Wait for Initialization**: Once downloaded, the model will initialize automatically
4. **Start Chatting**: Send messages to the AI - it will process them offline!

### Available Models

The app comes pre-configured with 3 models:

1. **DeepSeek R1 1.5B** (Fast)
   - Size: ~0.7 GB
   - Best for: Quick responses, simple queries
   - Context: 2,048 tokens

2. **Phi-3 Mini** (Balanced)
   - Size: ~2.4 GB
   - Best for: General cooking assistance
   - Context: 4,096 tokens

3. **Llama 3.2 1B** (Ultra Fast)
   - Size: ~0.8 GB
   - Best for: Very fast responses
   - Context: 8,192 tokens

### Model Management

- **Download**: Tap the download icon next to any model
- **Delete**: Tap the trash icon to free up space
- **Progress**: See real-time download progress
- **Switch Models**: Select different models for different use cases

## Features

### 1. Model Selector Component
- Visual model browser
- Download progress tracking
- Storage management
- Model information display

### 2. Chat Composer
- Integrated model selector
- Voice input support (optional)
- Offline/Online mode indicator
- Clean, intuitive UI

### 3. Offline Processing
- Streaming token generation
- Real-time response display
- No internet required
- Private and secure

## Architecture

```
services/
  └── llamaService.ts          # Core LLM management
components/
  ├── ModelSelector.tsx        # Model selection UI
  └── ChatComposer.tsx         # Chat input with model picker
app/(tabs)/
  └── chat.tsx                 # Enhanced chat screen
```

## Performance Tips

1. **Choose the Right Model**:
   - For fast responses: Use Llama 3.2 1B or DeepSeek R1
   - For better quality: Use Phi-3 Mini

2. **Manage Storage**:
   - Delete unused models to free space
   - Only keep models you actively use

3. **Battery Considerations**:
   - Offline processing uses more battery
   - Consider using online mode when plugged in

4. **Memory Management**:
   - Only one model can be loaded at a time
   - Switching models releases the previous one

## Troubleshooting

### Model Won't Download
- Check internet connection
- Ensure sufficient storage space
- Try downloading again

### Model Won't Initialize
- Verify model file is complete
- Check device has enough RAM
- Try restarting the app

### Slow Performance
- Close other apps to free memory
- Use a smaller model
- Ensure latest app version

### Download Progress Stuck
- Cancel and retry download
- Check network stability
- Clear app cache

## Technical Details

### Supported Platforms
- iOS 13+
- Android 7.0+ (API 24+)

### Requirements
- Minimum 3GB RAM
- 1-3GB free storage (per model)
- Metal support (iOS) or OpenCL (Android)

### Model Format
- Uses GGUF format
- Quantized for mobile efficiency
- Optimized for on-device inference

## Future Enhancements

- [ ] More model options
- [ ] Custom model imports
- [ ] Fine-tuning capabilities
- [ ] Multi-modal support (images)
- [ ] Model sharing between users

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the error messages in-app
3. Check app logs for detailed errors

## Credits

- **llama.rn**: React Native bindings for llama.cpp
- **Model Providers**: HuggingFace model hub
- **Models**: DeepSeek, Microsoft, Meta
