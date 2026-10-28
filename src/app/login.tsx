import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EMPTY_MESSAGE = 'El código de empleado y la clave son obligatorios';
const INVALID_MESSAGE = 'Credenciales inválidas';

export default function LoginScreen() {
  const { signIn } = useSession();
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
    { backgroundColor: theme.background, color: theme.text, borderColor: theme.inputBorder },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={[styles.brandRule, { backgroundColor: theme.accent }]} />
              <View style={styles.headerText}>
                <ThemedText type="smallBold" style={{ color: theme.infoForeground }}>
                  EPMAPS
                </ThemedText>
                <ThemedText type="subtitle">Identificación del técnico</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Registro de lecturas de medidores de agua
                </ThemedText>
              </View>
            </View>

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

              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Ingresar"
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
                  Ingresar
                </ThemedText>
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
    flexDirection: 'row',
    gap: Spacing.three,
  },
  // Línea vertical de acento, el mismo motivo que el bloque de trabajo de la pantalla principal.
  brandRule: {
    width: 4,
    borderRadius: 2,
  },
  headerText: {
    flex: 1,
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
  submitButton: {
    minHeight: 52,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonLabel: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
