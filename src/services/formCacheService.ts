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
    const toSet: [string, string][] = [];
    const toRemove: string[] = [];
    if (client) toSet.push([CLIENT_KEY, client]);
    else toRemove.push(CLIENT_KEY);
    if (project) toSet.push([PROJECT_KEY, project]);
    else toRemove.push(PROJECT_KEY);
    if (toSet.length > 0) await AsyncStorage.multiSet(toSet);
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
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
