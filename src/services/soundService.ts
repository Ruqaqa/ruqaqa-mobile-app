import { createAudioPlayer, AudioPlayer } from 'expo-audio';

const successSound = require('../../assets/sounds/success.mp3');

let player: AudioPlayer | null = null;

function waitForLoaded(p: AudioPlayer, timeoutMs = 3000): Promise<void> {
  if (p.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const sub = p.addListener('playbackStatusUpdate', () => {
      if (p.isLoaded) {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    });
  });
}

export async function playSuccessSound(): Promise<void> {
  try {
    if (!player) {
      player = createAudioPlayer(successSound);
      await waitForLoaded(player);
    } else {
      player.seekTo(0);
    }
    player.play();
  } catch {
    // Sound is never critical — silent fail
  }
}
