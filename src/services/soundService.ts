import { createAudioPlayer, AudioPlayer } from 'expo-audio';

const successSound = require('../../assets/sounds/success.mp3');

let player: AudioPlayer | null = null;

export async function playSuccessSound(): Promise<void> {
  try {
    if (!player) {
      player = createAudioPlayer(successSound);
    } else {
      player.seekTo(0);
    }
    player.play();
  } catch {
    // Sound is never critical — silent fail
  }
}
