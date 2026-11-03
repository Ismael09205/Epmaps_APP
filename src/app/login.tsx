import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Droplets,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { useSession, type SignInResult } from '@/auth/session-context';
import { AnimatedButton } from '@/components/motion/animated-button';
import { AnimatedInputFrame, resolveInputState } from '@/components/motion/animated-input-frame';
import { useCircularNavigation } from '@/components/motion/circular-transition';
import { Notice } from '@/components/notice';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Colors, Spacing } from '@/constants/theme';
import { isValidEmail, PASSWORD_RESET_SENT_NOTICE } from '@/domain/auth';
import { useTheme } from '@/hooks/use-theme';

const ERROR_MESSAGES: Record<Exclude<SignInResult, 'ok' | 'unverified'>, string> = {
  empty: 'El correo y la clave son obligatorios',
  'invalid-email': 'Ingrese un correo válido, por ejemplo nombre@dominio.com',
  invalid: 'Correo o clave incorrectos',
  'no-profile': 'Su cuenta no tiene un perfil de técnico asignado. Contacte a la oficina.',
  network: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
  'too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  unavailable: 'No se pudo iniciar sesión. Intente de nuevo más tarde.',
};

// Los campos y la marca son blancos en ambos modos; se usa la paleta clara para que el texto y
// los iconos conserven el contraste sobre esa superficie.
const SURFACE = Colors.light;

export default function LoginScreen() {
  const { signIn } = useSession();
  const router = useRouter();
  const { navigateWithReveal } = useCircularNavigation();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [isEmailTouched, setIsEmailTouched] = useState(false);

  // Al volver de la recuperación de clave, el correo usado ya queda escrito.
  const [receivedEmail, setReceivedEmail] = useState<string | undefined>();
  if (params.email !== receivedEmail) {
    setReceivedEmail(params.email);
    if (params.email) {
      setEmail(params.email);
    }
  }

  const clearResetNotice = () => {
    if (params.notice) {
      router.setParams({ notice: undefined });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    clearResetNotice();
    setIsEmailTouched(true);
    // Sin datos completos no hay nada que verificar: el botón no pasa por el estado de carga.
    if (email.trim() === '' || password === '') {
      setErrorMessage(ERROR_MESSAGES.empty);
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage(ERROR_MESSAGES['invalid-email']);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (result !== 'ok' && result !== 'unverified') {
      setErrorMessage(ERROR_MESSAGES[result]);
    }
  };

  const emailIsValid = isValidEmail(email);
  const emailState = resolveInputState({
    isFocused: focusedField === 'email',
    isInvalid:
      (isEmailTouched && !emailIsValid) || errorMessage === ERROR_MESSAGES.invalid,
    isValid: emailIsValid,
  });
  // La clave no se marca como válida: solo Firebase puede confirmarla.
  const passwordState = resolveInputState({
    isFocused: focusedField === 'password',
    isInvalid:
      errorMessage === ERROR_MESSAGES.invalid ||
      (errorMessage === ERROR_MESSAGES.empty && password === ''),
    isValid: false,
  });

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerClassName="grow justify-center gap-6 py-6" keyboardShouldPersistTaps="handled">
            {/* Encabezado institucional: identifica la herramienta antes de pedir credenciales. */}
            <View className="flex-row items-center gap-4">
              <View className="w-[56px] h-[56px] rounded-full items-center justify-center bg-surface-info-background">
                <Droplets color={SURFACE.accent} size={28} strokeWidth={2} />
              </View>
              <View className="flex-1 gap-[2px]">
                <ThemedText type="caption" themeColor="infoForeground">
                  EPMAPS · Quito
                </ThemedText>
                <ThemedText type="heading">Lecturas de medidores</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Agua potable y saneamiento
                </ThemedText>
              </View>
            </View>
            <View className="w-[48px] h-[3px] rounded-full bg-accent" />

            <View className="gap-4">
              <View className="gap-1 mb-1">
                <ThemedText className="font-bold">Identificación del técnico</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Use el correo y la clave de su cuenta de técnico.
                </ThemedText>
              </View>

              <View className="gap-2">
                <ThemedText type="smallBold">Correo electrónico</ThemedText>
                <AnimatedInputFrame state={emailState} palette={SURFACE} className="min-h-[52px] flex-row items-center gap-2 rounded-sm border-[1px] px-4">
                  <Mail color={SURFACE.accent} size={20} />
                  <TextInput
                    className="flex-1 min-h-[48px] py-2 text-[16px] text-surface-text"
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setIsEmailTouched(true);
                      setErrorMessage(null);
                      clearResetNotice();
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => {
                      setFocusedField(null);
                      setIsEmailTouched(true);
                    }}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    submitBehavior="submit"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="next"
                    accessibilityLabel="Correo electrónico"
                  />
                </AnimatedInputFrame>
              </View>

              <View className="gap-2">
                <ThemedText type="smallBold">Clave</ThemedText>
                <AnimatedInputFrame
                  state={passwordState}
                  palette={SURFACE}
                  showStatusIcon={passwordState === 'error'}
                  className="min-h-[52px] flex-row items-center gap-2 rounded-sm border-[1px] px-4">
                  <LockKeyhole color={SURFACE.accent} size={20} />
                  <TextInput
                    ref={passwordRef}
                    className="flex-1 min-h-[48px] py-2 text-[16px] text-surface-text"
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setErrorMessage(null);
                      clearResetNotice();
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
                </AnimatedInputFrame>
              </View>

              <Pressable
                onPress={(event) =>
                  navigateWithReveal(event, () =>
                    router.push({ pathname: '/recuperar-clave', params: { email } }),
                  )
                }
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Olvidé mi clave"
                hitSlop={Spacing.two}
                className="self-end active:scale-[0.98]">
                <ThemedText
                  type="smallBold"
                  maxFontSizeMultiplier={ChromeFontScale}
                  themeColor="infoForeground">
                  ¿Olvidaste tu contraseña?
                </ThemedText>
              </Pressable>

              {params.notice === PASSWORD_RESET_SENT_NOTICE && (
                <Notice tone="success" title="Revise su correo">
                  Si el correo tiene una cuenta, le llegará un enlace para crear una clave nueva.
                  Después de cambiarla, ingrese aquí. Si no lo encuentra, revise la carpeta de
                  correo no deseado.
                </Notice>
              )}
              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}

              <AnimatedButton
                label="Ingresar"
                busyLabel="Verificando…"
                icon={LogIn}
                status={isSubmitting ? 'busy' : 'idle'}
                onPress={handleSubmit}
                className="mt-2"
              />

              <View className="min-h-[48px] flex-row flex-wrap items-center justify-center gap-1">
                <ThemedText type="small" themeColor="textSecondary">
                  ¿No tiene una cuenta?
                </ThemedText>
                <Pressable
                  onPress={(event) =>
                    navigateWithReveal(event, () => router.push('/crear-cuenta'))
                  }
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Crear cuenta"
                  hitSlop={Spacing.three}
                  className="active:scale-[0.98]">
                  <ThemedText
                    type="smallBold"
                    maxFontSizeMultiplier={ChromeFontScale}
                    themeColor="infoForeground">
                    Crear cuenta
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View className="flex-row items-start gap-2 border-t-[0.5px] pt-4 border-t-border">
              <ShieldCheck color={theme.textSecondary} size={16} />
              <ThemedText type="small" themeColor="textSecondary" className="flex-1">
                Uso exclusivo del personal técnico de EPMAPS. No comparta su clave.
              </ThemedText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

