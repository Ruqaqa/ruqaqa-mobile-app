import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_LAUNCHED_KEY = 'has_launched_before';

/**
 * Check if this is the first app launch.
 */
export async function isFirstLaunch(): Promise<boolean> {
  const launched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
  return launched !== 'true';
}

/**
 * Mark that the app has been launched before.
 */
export async function markLaunched(): Promise<void> {
  await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
}
