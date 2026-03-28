import AsyncStorage from '@react-native-async-storage/async-storage';

const CLIENT_KEY = 'cached_last_client';
const PROJECT_KEY = 'cached_last_project';

export interface CachedFormValues {
  client: string | null;
  project: string | null;
}

export async function getLastClientAndProject(): Promise<CachedFormValues> {
  try {
    const [client, project] = await AsyncStorage.multiGet([CLIENT_KEY, PROJECT_KEY]);
    return {
      client: client[1] ?? null,
      project: project[1] ?? null,
    };
  } catch {
    return { client: null, project: null };
  }
}

export async function saveLastClientAndProject(
  client: string | null | undefined,
  project: string | null | undefined,
): Promise<void> {
  try {
    const pairs: [string, string][] = [];
    if (client) pairs.push([CLIENT_KEY, client]);
    if (project) pairs.push([PROJECT_KEY, project]);
    if (pairs.length > 0) await AsyncStorage.multiSet(pairs);
  } catch {
    // ignore
  }
}

export async function clearFormCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CLIENT_KEY, PROJECT_KEY]);
  } catch {
    // ignore
  }
}
