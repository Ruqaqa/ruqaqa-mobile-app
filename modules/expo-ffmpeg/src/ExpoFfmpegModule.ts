import { NativeModule, requireNativeModule } from 'expo';

import type { ExpoFfmpegModuleEvents } from './types';

declare class ExpoFfmpegModule extends NativeModule<ExpoFfmpegModuleEvents> {
  execute(command: string): Promise<{ returnCode: number; output: string; duration: number }>;
  cancel(): void;
  getMediaInfo(path: string): Promise<{
    duration: number;
    width: number;
    height: number;
    codec: string;
    bitrate: number;
  }>;
}

export default requireNativeModule<ExpoFfmpegModule>('ExpoFfmpeg');
