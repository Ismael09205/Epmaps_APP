import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const EMPTY_MESSAGE = 'El código de empleado y la clave son obligatorios';
const INVALID_MESSAGE = 'Credenciales inválidas';

const ERROR_COLOR = { light: '#B3261E', dark: '#FFB4AB' } as const;

export default function LoginScreen() {
  const { signIn } = useSession();
  const scheme = useColorScheme();
  const theme = useTheme();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(employeeCode, password);
    setIsSubmitting(false);

    if (result === 'empty') {
      setErrorMessage(EMPTY_MESSAGE);
    } else if (result === 'invalid') {
      setErrorMessage(INVALID_MESSAGE);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.textSecondary },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedView style={styles.header}>
              <ThemedText type="subtitle">Identificación</ThemedText>
              <ThemedText themeColor="textSecondary">
                Registro de lecturas de medidores EPMAPS
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
              <ThemedView style={styles.field}>
                <ThemedText type="smallBold">Código de empleado</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={employeeCode}
                  onChangeText={(value) => {
                    setEmployeeCode(value);
                    setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Código de empleado"
                />
              </ThemedView>

              <ThemedView style={styles.field}>
                <ThemedText type="smallBold">Clave</ThemedText>
                <TextInput
                  style={inputStyle}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setErrorMessage(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Clave"
                />
              </ThemedView>

              {errorMessage !== null && (
                <ThemedText
                  accessibilityLiveRegion="polite"
                  style={[styles.errorMessage, { color: ERROR_COLOR[scheme === 'dark' ? 'dark' : 'light'] }]}>
                  {errorMessage}
                </ThemedText>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Ingresar"
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.text },
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                <ThemedText style={{ color: theme.background }}>Ingresar</ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.five,
  },
  header: {
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  errorMessage: {
    lineHeight: 22,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
