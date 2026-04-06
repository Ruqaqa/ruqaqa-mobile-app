import { Platform } from 'react-native';

export function getPreferredEncoder(): string {
  switch (Platform.OS) {
    case 'ios':
      return 'h264_videotoolbox';
    case 'android':
      return 'h264_mediacodec';
    default:
      return 'libx264';
  }
}
