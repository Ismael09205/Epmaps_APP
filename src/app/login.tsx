import { useRef, useState } from 'react';
import {
  Droplets,
  IdCard,
  LockKeyhole,
  LogIn,
  ShieldCheck,
} from 'lucide-react-native';
import {
  ActivityIndicator,
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
import { ChromeFontScale, Colors, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EMPTY_MESSAGE = 'El código de empleado y la clave son obligatorios';
const INVALID_MESSAGE = 'Credenciales inválidas';

// Los campos y la marca son blancos en ambos modos; se usa la paleta clara para que el texto y
// los iconos conserven el contraste sobre esa superficie.
const SURFACE = Colors.light;

export default function LoginScreen() {
  const { signIn } = useSession();
  const theme = useTheme();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const [focusedField, setFocusedField] = useState<'employeeCode' | 'password' | null>(null);

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

  const fieldStyle = (field: 'employeeCode' | 'password') => [
    styles.inputRow,
    {
      backgroundColor: SURFACE.background,
      borderColor: focusedField === field ? SURFACE.accent : SURFACE.inputBorder,
    },
    focusedField === field && styles.inputRowFocused,
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Encabezado institucional: identifica la herramienta antes de pedir credenciales. */}
            <View style={styles.brand}>
              <View style={[styles.brandMark, { backgroundColor: SURFACE.infoBackground }]}>
                <Droplets color={SURFACE.accent} size={28} strokeWidth={2} />
              </View>
              <View style={styles.brandText}>
                <ThemedText type="caption" themeColor="infoForeground">
                  EPMAPS · Quito
                </ThemedText>
                <ThemedText type="heading">Lecturas de medidores</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Agua potable y saneamiento
                </ThemedText>
              </View>
            </View>
            <View style={[styles.brandRule, { backgroundColor: theme.accent }]} />

            <View style={styles.form}>
              <View style={styles.formHeader}>
                <ThemedText style={styles.formTitle}>Identificación del técnico</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Use el código de empleado y la clave asignados por la oficina.
                </ThemedText>
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Código de empleado</ThemedText>
                <View style={fieldStyle('employeeCode')}>
                  <IdCard color={SURFACE.accent} size={20} />
                  <TextInput
                    style={[styles.input, { color: SURFACE.text }]}
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={employeeCode}
                    onChangeText={(value) => {
                      setEmployeeCode(value);
                      setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('employeeCode')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    submitBehavior="submit"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    returnKeyType="next"
                    accessibilityLabel="Código de empleado"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <ThemedText type="smallBold">Clave</ThemedText>
                <View style={fieldStyle('password')}>
                  <LockKeyhole color={SURFACE.accent} size={20} />
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, { color: SURFACE.text }]}
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    onSubmitEditing={handleSubmit}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    accessibilityLabel="Clave"
                  />
                </View>
              </View>

              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Ingresar"
                accessibilityState={{ busy: isSubmitting }}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: pressed ? theme.brand : theme.accent },
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color={theme.onAccent} size="small" />
                ) : (
                  <LogIn color={theme.onAccent} size={20} />
                )}
                <ThemedText
                  type="smallBold"
                  maxFontSizeMultiplier={ChromeFontScale}
                  style={[styles.buttonLabel, { color: theme.onAccent }]}>
                  {isSubmitting ? 'Verificando…' : 'Ingresar'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <ShieldCheck color={theme.textSecondary} size={16} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                Uso exclusivo del personal técnico de EPMAPS. No comparta su clave.
              </ThemedText>
            </View>
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
    paddingHorizontal: ScreenPadding,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    flex: 1,
    gap: Spacing.half,
  },
  // Línea corta de acento que separa la identidad del formulario.
  brandRule: {
    width: 48,
    height: 3,
    borderRadius: Radius.pill,
  },
  form: {
    gap: Spacing.three,
  },
  formHeader: {
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  formTitle: {
    fontWeight: '700',
  },
  field: {
    gap: Spacing.two,
  },
  inputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  inputRowFocused: {
    borderWidth: 2,
    paddingHorizontal: Spacing.three - 1,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  submitButton: {
    marginTop: Spacing.two,
    minHeight: 54,
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonLabel: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  footerText: {
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
