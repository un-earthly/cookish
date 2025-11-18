import { initLlama } from 'llama.rn';
import { LlamaContext, RNLlamaOAICompatibleMessage, TokenData } from 'llama.rn';
import { Paths, File } from 'expo-file-system';

export interface LlamaModel {
  id: string;
  name: string;
  displayName: string;
  url: string;
  filename: string;
  size: string;
  description: string;
  contextLength: number;
}

export interface ModelDownloadProgress {
  modelId: string;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  isDownloading: boolean;
  isComplete: boolean;
  error?: string;
}

export const AVAILABLE_MODELS: LlamaModel[] = [
  {
    id: 'deepseek-r1-1.5b',
    name: 'DeepSeek-R1-Distill-Qwen-1.5B',
    displayName: 'DeepSeek R1 1.5B (Fast)',
    url: 'https://huggingface.co/lmstudio-community/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q3_K_L.gguf',
    filename: 'deepseek-r1-1.5b.gguf',
    size: '0.7 GB',
    description: 'Lightweight model optimized for mobile devices',
    contextLength: 2048,
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3-Mini-4K',
    displayName: 'Phi-3 Mini (Balanced)',
    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
    filename: 'phi-3-mini-4k.gguf',
    size: '2.4 GB',
    description: 'Microsoft efficient small model',
    contextLength: 4096,
  },
  {
    id: 'llama-3.2-1b',
    name: 'Llama-3.2-1B',
    displayName: 'Llama 3.2 1B (Ultra Fast)',
    url: 'https://huggingface.co/lmstudio-community/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    filename: 'llama-3.2-1b.gguf',
    size: '0.8 GB',
    description: 'Meta smallest Llama model',
    contextLength: 2048,
  },
];

class LlamaService {
  private context: LlamaContext | null = null;
  private currentModel: LlamaModel | null = null;
  private downloadCallbacks: Map<string, (progress: ModelDownloadProgress) => void> = new Map();

  private getModelFile(model: LlamaModel): File {
    return new File(Paths.document, model.filename);
  }

  async getAvailableStorage(): Promise<{ free: number; total: number }> {
    const info = await Paths.document.stat();
    return {
      free: info.freeSize || 0,
      total: info.totalSize || 0,
    };
  }

  async isModelDownloaded(model: LlamaModel): Promise<boolean> {
    try {
      const file = this.getModelFile(model);
      return file.exists;
    } catch (error) {
      return false;
    }
  }

  async getDownloadedModels(): Promise<LlamaModel[]> {
    const downloaded: LlamaModel[] = [];
    for (const model of AVAILABLE_MODELS) {
      if (await this.isModelDownloaded(model)) {
        downloaded.push(model);
      }
    }
    return downloaded;
  }

  async downloadModel(
    model: LlamaModel,
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<void> {
    const file = this.getModelFile(model);
    if (file.exists) {
      console.log('Model already downloaded:', model.displayName);
      return;
    }

    try {
      console.log('Starting download:', model.displayName);
      if (onProgress) {
        this.downloadCallbacks.set(model.id, onProgress);
      }

      onProgress?.({
        modelId: model.id,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        isDownloading: true,
        isComplete: false,
      });

      await File.downloadFileAsync(model.url, file, { idempotent: true });

      onProgress?.({
        modelId: model.id,
        progress: 100,
        bytesWritten: 100,
        totalBytes: 100,
        isDownloading: false,
        isComplete: true,
      });

      console.log('Download complete:', model.displayName);
      this.downloadCallbacks.delete(model.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({
        modelId: model.id,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        isDownloading: false,
        isComplete: false,
        error: errorMessage,
      });
      this.downloadCallbacks.delete(model.id);
      throw new Error(`Failed to download ${model.displayName}: ${errorMessage}`);
    }
  }

  async deleteModel(model: LlamaModel): Promise<void> {
    const file = this.getModelFile(model);
    if (!file.exists) {
      console.log('Model not found:', model.displayName);
      return;
    }
    if (this.currentModel?.id === model.id) {
      await this.release();
    }
    try {
      await file.delete();
      console.log('Model deleted:', model.displayName);
    } catch (error) {
      throw new Error(`Failed to delete ${model.displayName}: ${error}`);
    }
  }

  async initialize(model: LlamaModel): Promise<void> {
    if (typeof initLlama !== 'function') {
      throw new Error(
        'llama.rn requires a development build. Expo Go does not support this feature. ' +
        'Run: npx expo prebuild && npx expo run:android'
      );
    }

    await this.release();
    const file = this.getModelFile(model);
    if (!file.exists) {
      throw new Error(`Model not downloaded: ${model.displayName}`);
    }

    try {
      const modelPath = file.uri.replace('file://', '');
      console.log('Initializing model with path:', modelPath);

      this.context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: model.contextLength,
        n_gpu_layers: 0,
      });

      this.currentModel = model;
      console.log('Initialized model:', model.displayName);
    } catch (error) {
      this.context = null;
      this.currentModel = null;
      if (error instanceof Error && error.message.includes('initContext')) {
        throw new Error(
          'llama.rn requires a development build. Expo Go does not support this feature. ' +
          'Run: npx expo prebuild && npx expo run:android'
        );
      }
      throw new Error(`Failed to initialize ${model.displayName}: ${error}`);
    }
  }

  async complete(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      onToken?: (token: string) => void;
    }
  ): Promise<string> {
    if (!this.context) {
      throw new Error('No model initialized. Call initialize() first.');
    }

    try {
      let fullResponse = '';
      const completion = await this.context.completion(
        {
          prompt,
          temperature: options?.temperature ?? 0.7,
          n_predict: options?.maxTokens ?? 512,
        },
        (data: TokenData) => {
          fullResponse += data.token;
          options?.onToken?.(data.token);
        }
      );
      return fullResponse || completion.text;
    } catch (error) {
      throw new Error(`Completion failed: ${error}`);
    }
  }

  async chatCompletion(
    messages: RNLlamaOAICompatibleMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      onToken?: (token: string) => void;
    }
  ): Promise<string> {
    if (!this.context) {
      throw new Error('No model initialized. Call initialize() first.');
    }

    try {
      let fullResponse = '';
      const completion = await this.context.completionWithMessages(
        messages,
        {
          temperature: options?.temperature ?? 0.7,
          n_predict: options?.maxTokens ?? 512,
        },
        (data: TokenData) => {
          fullResponse += data.token;
          options?.onToken?.(data.token);
        }
      );
      return fullResponse || completion.text;
    } catch (error) {
      throw new Error(`Chat completion failed: ${error}`);
    }
  }

  async release(): Promise<void> {
    if (this.context) {
      try {
        await this.context.release();
      } catch (error) {
        console.error('Error releasing context:', error);
      }
      this.context = null;
      this.currentModel = null;
    }
  }

  getCurrentModel(): LlamaModel | null {
    return this.currentModel;
  }

  isModelLoaded(): boolean {
    return this.context !== null;
  }
}

export const llamaService = new LlamaService();
