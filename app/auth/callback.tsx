import { Redirect } from 'expo-router';

/**
 * Auth callback route — catches the redirect URI from Keycloak SSO.
 * expo-auth-session handles the URL params (code, state) before this
 * component renders, so we just redirect to root which will route
 * based on auth state.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
