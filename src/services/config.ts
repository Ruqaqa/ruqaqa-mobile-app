import Constants from 'expo-constants';

interface AppConfig {
  apiBaseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
}

const DEV_CONFIG: AppConfig = {
  apiBaseUrl: 'http://192.168.100.57:3000',
  keycloakUrl: 'https://auth.ruqaqa.sa',
  keycloakRealm: 'ruqaqa',
  keycloakClientId: 'ruqaqa-mobile-app',
};

const PROD_CONFIG: AppConfig = {
  apiBaseUrl: 'https://ruqaqa.sa',
  keycloakUrl: 'https://auth.ruqaqa.sa',
  keycloakRealm: 'ruqaqa',
  keycloakClientId: 'ruqaqa-mobile-app',
};

function getConfig(): AppConfig {
  const channel = Constants.expoConfig?.extra?.releaseChannel ?? 'development';
  if (channel === 'production' || channel === 'prod') {
    return PROD_CONFIG;
  }
  return DEV_CONFIG;
}

export const config = getConfig();
