import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TotpInput } from './TotpInput';
import { CredentialLoginStatus } from '../../types/auth';

interface DirectLoginFormProps {
  onSubmit: (
    username: string,
    password: string,
    totp?: string,
  ) => Promise<CredentialLoginStatus>;
  loading: boolean;
}

type Step = 'credentials' | 'totp';

export function DirectLoginForm({ onSubmit, loading }: DirectLoginFormProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  const [step, setStep] = useState<Step>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpError, setTotpError] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const handleCredentialSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('pleaseFillAllRequiredFields'));
      return;
    }
    setError(null);

    const status = await onSubmit(username, password);
    handleStatus(status);
  };

  const handleTotpSubmit = async (code?: string) => {
    const totpCode = code ?? totp;
    if (totpCode.length !== 6) return;
    setTotpError(null);

    const status = await onSubmit(username, password, totpCode);
    handleStatus(status);
  };

  const handleStatus = (status: CredentialLoginStatus) => {
    switch (status) {
      case CredentialLoginStatus.Success:
        break; // Navigation handled by auth context
      case CredentialLoginStatus.TotpRequired:
        setStep('totp');
        setTotp('');
        break;
      case CredentialLoginStatus.TotpInvalid:
        setTotpError(t('invalidCode'));
        setTotp('');
        break;
      case CredentialLoginStatus.InvalidCredentials:
        setError(t('loginFailed'));
        break;
      case CredentialLoginStatus.AccountDisabled:
        setError(t('accountDisabled'));
        break;
      case CredentialLoginStatus.AccountTemporarilyDisabled:
        setError(t('accountTemporarilyDisabled'));
        break;
      case CredentialLoginStatus.RequiredAction:
        setError(t('requiredAction'));
        break;
      case CredentialLoginStatus.NetworkError:
        setError(t('networkError'));
        break;
      default:
        setError(t('loginError'));
    }
  };

  const handleTotpChange = (value: string) => {
    setTotp(value);
    setTotpError(null);
    // Auto-submit when 6 digits entered
    if (value.length === 6) {
      handleTotpSubmit(value);
    }
  };

  if (step === 'totp') {
    return (
      <View testID="totp-step">
        <Text
          style={[
            typography.headingMedium,
            { color: colors.foreground, textAlign: 'center' },
          ]}
        >
          {t('enterVerificationCode')}
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            {
              color: colors.foregroundSecondary,
              textAlign: 'center',
              marginTop: spacing.sm,
              marginBottom: spacing.xl,
            },
          ]}
        >
          {t('totpInstructions')}
        </Text>

        <TotpInput
          value={totp}
          onChange={handleTotpChange}
          error={totpError ?? undefined}
        />

        <View style={{ marginTop: spacing.lg }}>
          <Button
            title={t('confirm')}
            onPress={() => handleTotpSubmit()}
            variant="default"
            size="lg"
            loading={loading}
            disabled={totp.length !== 6}
          />
        </View>

        <Pressable
          onPress={() => {
            setStep('credentials');
            setTotp('');
            setTotpError(null);
          }}
          style={{ marginTop: spacing.md, alignSelf: 'center' }}
        >
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.secondary },
            ]}
          >
            {t('previous')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="credentials-step">
      <Input
        testID="username-input"
        label={t('username')}
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={error && !password ? error : undefined}
      />

      <View style={styles.passwordContainer}>
        <Input
          ref={passwordRef}
          testID="password-input"
          label={t('password')}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
          secureTextEntry={!showPassword}
          textContentType="password"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={handleCredentialSubmit}
        />
        <Pressable
          testID="toggle-password"
          onPress={() => setShowPassword(!showPassword)}
          accessibilityLabel={showPassword ? t('hidePassword') : t('showPassword')}
          style={[styles.eyeButton, { top: 32, right: spacing.md }]}
        >
          <Text style={{ color: colors.foregroundSecondary, fontSize: 16 }}>
            {showPassword ? '◉' : '◎'}
          </Text>
        </Pressable>
      </View>

      {error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={[
            typography.bodySmall,
            {
              color: colors.error,
              textAlign: 'center',
              marginBottom: spacing.md,
            },
          ]}
        >
          {error}
        </Text>
      )}

      <Button
        testID="credential-sign-in"
        title={t('signIn')}
        onPress={handleCredentialSubmit}
        variant="default"
        size="lg"
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    padding: 8,
    zIndex: 1,
  },
});
