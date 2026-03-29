import { Audio } from 'expo-av';

const successSound = require('../../assets/sounds/success.mp3');

let loaded: Audio.Sound | null = null;

export async function playSuccessSound(): Promise<void> {
  try {
    if (!loaded) {
      const { sound } = await Audio.Sound.createAsync(successSound);
      loaded = sound;
    } else {
      await loaded.setPositionAsync(0);
    }
    await loaded.playAsync();
  } catch {
    // Sound is never critical — silent fail
  }
}
