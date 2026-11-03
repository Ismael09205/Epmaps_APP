import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound, Mail, Send } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { useSession, type PasswordResetResult } from '@/auth/session-context';
import { AnimatedButton, useSuccessFlash } from '@/components/motion/animated-button';
import { AnimatedInputFrame, resolveInputState } from '@/components/motion/animated-input-frame';
import { useCircularNavigation } from '@/components/motion/circular-transition';
import { FieldMessage } from '@/components/motion/field-message';
import { Notice } from '@/components/notice';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Colors } from '@/constants/theme';
import { isValidEmail, PASSWORD_RESET_SENT_NOTICE } from '@/domain/auth';

const INVALID_EMAIL_MESSAGE = 'Ingrese un correo válido, por ejemplo nombre@dominio.com';

const ERROR_MESSAGES: Record<Exclude<PasswordResetResult, 'sent'>, string> = {
  'invalid-email': INVALID_EMAIL_MESSAGE,
  invalid: INVALID_EMAIL_MESSAGE,
  network: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
  'too-many-requests': 'Ya se enviaron varios correos. Espere unos minutos antes de reenviarlo.',
  unavailable: 'No se pudo enviar el correo. Intente de nuevo más tarde.',
};

// Los campos y la marca son blancos en ambos modos; se usa la paleta clara para que el texto y
// los iconos conserven el contraste sobre esa superficie.
const SURFACE = Colors.light;

// Deja ver el paso a éxito del botón antes de volver al inicio de sesión.
const SUCCESS_PAUSE_MS = 600;

export default function ResetPasswordScreen() {
  const { requestPasswordReset } = useSession();
  const router = useRouter();
  const { navigateWithReveal } = useCircularNavigation();
  const [isSent, flashSent] = useSuccessFlash();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [isTouched, setIsTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fieldError = isTouched && !isValidEmail(email) ? INVALID_EMAIL_MESSAGE : undefined;
  const inputState = resolveInputState({
    isFocused,
    isInvalid: fieldError !== undefined,
    isValid: isTouched && isValidEmail(email),
  });

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsTouched(true);
    setErrorMessage(null);
    if (!isValidEmail(email)) {
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (result === 'sent') {
      // El cambio de clave ocurre en la página de Firebase y la app no recibe aviso: se vuelve al
      // inicio de sesión para que el técnico ya esté ahí cuando regrese con su clave nueva.
      flashSent();
      setTimeout(() => {
        navigateWithReveal(null, () =>
          router.dismissTo({
            pathname: '/login',
            params: { email: email.trim(), notice: PASSWORD_RESET_SENT_NOTICE },
          }),
        );
      }, SUCCESS_PAUSE_MS);
    } else {
      setErrorMessage(ERROR_MESSAGES[result]);
    }
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerClassName="grow justify-center gap-6 py-6" keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center gap-4">
              <View className="w-[56px] h-[56px] rounded-full items-center justify-center bg-surface-info-background">
                <KeyRound color={SURFACE.accent} size={28} strokeWidth={2} />
              </View>
              <View className="flex-1 gap-[2px]">
                <ThemedText type="caption" themeColor="infoForeground">
                  EPMAPS · Quito
                </ThemedText>
                <ThemedText type="heading">Recuperar clave</ThemedText>
              </View>
            </View>
            <View className="w-[48px] h-[3px] rounded-full bg-accent" />

            <View className="gap-4">
              <ThemedText type="small" themeColor="textSecondary">
                Escriba el correo de su cuenta. Le enviaremos un enlace para crear una clave nueva.
              </ThemedText>

              <View className="gap-2">
                <ThemedText type="smallBold">Correo electrónico</ThemedText>
                <AnimatedInputFrame state={inputState} palette={SURFACE} className="min-h-[52px] flex-row items-center gap-2 rounded-sm border-[1px] px-4">
                  <Mail color={SURFACE.accent} size={20} />
                  <TextInput
                    className="flex-1 min-h-[48px] py-2 text-[16px] text-surface-text"
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setIsTouched(true);
                      setErrorMessage(null);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setIsFocused(false);
                      setIsTouched(true);
                    }}
                    onSubmitEditing={handleSubmit}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    returnKeyType="send"
                    accessibilityLabel="Correo electrónico"
                  />
                </AnimatedInputFrame>
                {fieldError && (
                  <FieldMessage>
                    <ThemedText type="small" themeColor="errorForeground" accessibilityLiveRegion="polite">
                      {fieldError}
                    </ThemedText>
                  </FieldMessage>
                )}
              </View>

              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}

              <AnimatedButton
                label="Enviar enlace"
                busyLabel="Enviando…"
                successLabel="Enlace enviado"
                icon={Send}
                status={isSubmitting ? 'busy' : isSent ? 'success' : 'idle'}
                onPress={handleSubmit}
                className="mt-2"
              />

              <Pressable
                onPress={(event) => navigateWithReveal(event, () => router.back())}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Volver al inicio de sesión"
                className="min-h-[48px] items-center justify-center active:scale-[0.98]">
                <ThemedText
                  type="smallBold"
                  maxFontSizeMultiplier={ChromeFontScale}
                  themeColor="infoForeground">
                  Volver al inicio de sesión
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

