import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/services/authContext';

/**
 * Auth callback route — catches the deep link from Keycloak SSO redirect.
 * expo-auth-session resolves the token exchange via the login screen,
 * so this component just waits for auth state to settle, then navigates.
 *
 * We use imperative navigation in useEffect instead of <Redirect> because
 * the declarative component fires during render before the navigation tree
 * is ready for cross-navigator REPLACE actions.
 */
export default function AuthCallback() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(isAuthenticated ? '/(app)' : '/login');
  }, [isAuthenticated, isLoading]);

  return <View style={{ flex: 1 }} />;
}
