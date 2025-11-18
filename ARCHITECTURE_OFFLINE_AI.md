# Architecture Overview: Offline AI Implementation

## Component Hierarchy

```
ChatScreen (chat.tsx)
├── Header (Mode indicators)
├── ModelSelector (Model picker modal)
│   ├── Available Models List
│   ├── Download Progress Bars
│   └── Delete/Download Actions
├── ScrollView (Messages)
│   └── ChatInterface (Existing)
└── ChatComposer (New input component)
    ├── ModelSelector Button
    ├── Voice Button (optional)
    ├── Text Input
    └── Send Button
```

## Data Flow

### Download Flow
```
User taps "Download"
    ↓
ModelSelector calls llamaService.downloadModel()
    ↓
llamaService downloads from HuggingFace
    ↓
Progress callbacks update UI
    ↓
File saved to device storage
    ↓
Model ready for use
```

### Chat Flow (Offline)
```
User types message
    ↓
ChatComposer.onSend()
    ↓
ChatScreen.handleSendMessage()
    ↓
llamaService.streamCompletion()
    ↓
Tokens stream back in real-time
    ↓
Display in ChatInterface
```

### Chat Flow (Online)
```
User types message
    ↓
ChatComposer.onSend()
    ↓
ChatScreen.handleSendMessage()
    ↓
chatService.processUserMessage()
    ↓
Cloud API call
    ↓
Response returned
    ↓
Display in ChatInterface
```

## Service Architecture

```
┌─────────────────────────────────────────────┐
│           User Interface Layer              │
│  ┌─────────────┐      ┌──────────────┐    │
│  │ ChatScreen  │◄────►│ModelSelector │    │
│  └─────────────┘      └──────────────┘    │
│         │                     │            │
│         ▼                     ▼            │
│  ┌─────────────┐      ┌──────────────┐    │
│  │ChatComposer │      │ProgressBars  │    │
│  └─────────────┘      └──────────────┘    │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│          Service Layer                      │
│  ┌──────────────┐     ┌─────────────┐     │
│  │llamaService  │     │chatService  │     │
│  │              │     │             │     │
│  │ - download   │     │ - process   │     │
│  │ - initialize │     │ - history   │     │
│  │ - completion │     │ - sessions  │     │
│  └──────────────┘     └─────────────┘     │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         Native Layer                        │
│  ┌──────────────┐     ┌─────────────┐     │
│  │  llama.rn    │     │react-native-│     │
│  │  (LLM Core)  │     │  fs2 (File) │     │
│  └──────────────┘     └─────────────┘     │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│         Device Storage                      │
│  📁 DocumentDirectory/                      │
│     ├── deepseek-r1-1.5b.gguf (0.7 GB)    │
│     ├── phi-3-mini-4k.gguf (2.4 GB)       │
│     └── llama-3.2-1b.gguf (0.8 GB)        │
└─────────────────────────────────────────────┘
```

## State Management

```typescript
// Chat Screen State
{
  messages: ChatMessage[]           // Chat history
  selectedModel: LlamaModel | null  // Current model
  isModelReady: boolean             // Model initialized
  useOfflineMode: boolean           // Mode flag
  isProcessing: boolean             // Loading state
}

// LlamaService State
{
  context: LlamaContext | null      // Active model
  currentModel: LlamaModel | null   // Loaded model
  downloadProgress: Map<>           // Progress tracking
}

// ModelSelector State
{
  isOpen: boolean                   // Modal visibility
  downloadedModels: Set<string>     // Downloaded IDs
  downloadProgress: Map<>           // Progress by model
  loading: boolean                  // Download state
}
```

## API Surface

### LlamaService
```typescript
// Core Methods
downloadModel(model, onProgress) → Promise<boolean>
initialize(model) → Promise<boolean>
completion(messages, onToken) → Promise<string>
streamCompletion(messages, onToken) → Promise<string>

// Management
isModelDownloaded(model) → Promise<boolean>
deleteModel(model) → Promise<boolean>
getDownloadedModels() → Promise<LlamaModel[]>
cleanup() → Promise<void>

// Info
getCurrentModel() → LlamaModel | null
isInitialized() → boolean
```

### ModelSelector Props
```typescript
{
  selectedModel: LlamaModel | null
  onModelSelect: (model) => void
  disabled?: boolean
}
```

### ChatComposer Props
```typescript
{
  onSend: (message: string) => void
  onVoicePress?: () => void
  selectedModel: LlamaModel | null
  onModelSelect: (model) => void
  disabled?: boolean
  placeholder?: string
  showVoiceButton?: boolean
  showModelSelector?: boolean
}
```

## File Structure

```
cookish/
├── services/
│   └── llamaService.ts              # 276 lines
│       ├── Model download logic
│       ├── Initialization & cleanup
│       ├── Completion (streaming/batch)
│       └── Storage management
│
├── components/
│   ├── ModelSelector.tsx            # 332 lines
│   │   ├── Model browser UI
│   │   ├── Download progress
│   │   └── Storage management
│   │
│   └── ChatComposer.tsx             # 115 lines
│       ├── Text input
│       ├── Model selector
│       ├── Voice button
│       └── Send button
│
└── app/(tabs)/
    └── chat.tsx                     # Updated
        ├── Message handling
        ├── Mode switching
        ├── Model initialization
        └── UI integration
```

## Dependencies Graph

```
chat.tsx
  ├─ imports ModelSelector
  ├─ imports ChatComposer
  ├─ imports llamaService
  └─ imports chatService (existing)

ModelSelector
  ├─ imports llamaService
  └─ imports BlurView, icons

ChatComposer
  ├─ imports ModelSelector
  └─ imports BlurView, TextInput

llamaService
  ├─ imports llama.rn
  └─ imports expo-file-system
```

## Event Flow

### User Downloads Model
```
1. User taps ModelSelector
2. Modal opens with models list
3. User taps download icon
4. llamaService.downloadModel() called
5. Progress callbacks fire
6. UI updates progress bar
7. Download completes
8. Model marked as downloaded
9. User can select model
```

### User Sends Message (Offline)
```
1. User types in ChatComposer
2. User taps send
3. onSend callback fires
4. handleSendMessage() in chat.tsx
5. Checks: useOfflineMode && isModelReady
6. llamaService.streamCompletion() called
7. Tokens stream back
8. Each token updates UI
9. Complete message saved
10. Chat updates
```

## Memory Management

```
Active States:
- One LlamaContext at a time
- Model files cached on disk
- Messages stored in Supabase

Cleanup Triggers:
- App backgrounded → Release context
- Model switched → Cleanup old, init new
- App closed → Automatic cleanup
```

## Error Handling

```
Download Errors:
- Network failure → Retry prompt
- Storage full → Alert user
- Invalid URL → Log error

Initialization Errors:
- Model corrupt → Redownload prompt
- Low memory → Suggest smaller model
- GPU unavailable → Fallback to CPU

Generation Errors:
- Context overflow → Truncate input
- OOM error → Release and retry
- Timeout → Cancel and retry
```

## Performance Optimizations

1. **Streaming**: Tokens displayed as generated
2. **Lazy Loading**: Models only loaded when selected
3. **Caching**: Downloaded models persist
4. **Memory**: One model at a time
5. **GPU**: Metal/OpenCL acceleration
6. **Quantization**: GGUF format for efficiency

## Security Considerations

- ✅ All processing on-device
- ✅ No data leaves device in offline mode
- ✅ Models from trusted sources (HuggingFace)
- ✅ File permissions properly set
- ✅ User controls model storage

---

This architecture provides a robust, maintainable offline AI system! 🚀
