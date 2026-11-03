import { useState } from 'react';
import { CircleCheck, MailCheck, RefreshCw } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { useSession, type ResendResult, type VerificationResult } from '@/auth/session-context';
import { AnimatedButton, useSuccessFlash } from '@/components/motion/animated-button';
import { Notice, type NoticeTone } from '@/components/notice';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Colors } from '@/constants/theme';

type Feedback = { tone: NoticeTone; message: string };

const CONFIRM_MESSAGES: Record<Exclude<VerificationResult, 'ok'>, string> = {
  'not-verified': 'El correo todavía no está verificado. Abra el enlace que le enviamos.',
  'no-profile': 'Su cuenta no tiene un perfil de técnico asignado. Contacte a la oficina.',
  invalid: 'La cuenta ya no es válida. Inicie sesión de nuevo.',
  network: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
  'too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  unavailable: 'No se pudo comprobar la verificación. Intente de nuevo más tarde.',
};

const RESEND_MESSAGES: Record<Exclude<ResendResult, 'sent'>, string> = {
  invalid: 'La cuenta ya no es válida. Inicie sesión de nuevo.',
  network: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
  'too-many-requests': 'Ya se enviaron varios correos. Espere unos minutos antes de reenviarlo.',
  unavailable: 'No se pudo reenviar el correo. Intente de nuevo más tarde.',
};

// La marca es blanca en ambos modos; se usa la paleta clara para conservar el contraste del icono.
const SURFACE = Colors.light;

export default function VerifyEmailScreen() {
  const { verification, confirmEmailVerified, resendVerificationEmail, signOut } = useSession();
  const [wasResent, flashResent] = useSuccessFlash();
  const [busyAction, setBusyAction] = useState<'confirm' | 'resend' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(
    verification?.emailSent === false
      ? { tone: 'warning', message: 'No se pudo enviar el correo. Pulse «Reenviar correo».' }
      : null,
  );

  const isBusy = busyAction !== null;

  const handleConfirm = async () => {
    setBusyAction('confirm');
    setFeedback(null);
    const result = await confirmEmailVerified();
    setBusyAction(null);

    if (result !== 'ok') {
      setFeedback({ tone: 'error', message: CONFIRM_MESSAGES[result] });
    }
  };

  const handleResend = async () => {
    setBusyAction('resend');
    setFeedback(null);
    const result = await resendVerificationEmail();
    setBusyAction(null);

    if (result === 'sent') {
      flashResent();
    }
    setFeedback(
      result === 'sent'
        ? { tone: 'success', message: 'Le enviamos un nuevo correo de verificación.' }
        : { tone: 'error', message: RESEND_MESSAGES[result] },
    );
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerClassName="grow justify-center gap-6 py-6">
          <View className="flex-row items-center gap-4">
            <View className="w-[56px] h-[56px] rounded-full items-center justify-center bg-surface-info-background">
              <MailCheck color={SURFACE.accent} size={28} strokeWidth={2} />
            </View>
            <View className="flex-1 gap-[2px]">
              <ThemedText type="caption" themeColor="infoForeground">
                EPMAPS · Quito
              </ThemedText>
              <ThemedText type="heading">Verifique su correo</ThemedText>
            </View>
          </View>
          <View className="w-[48px] h-[3px] rounded-full bg-accent" />

          <View className="gap-2">
            <ThemedText type="small" themeColor="textSecondary">
              Debe verificar esta cuenta para ingresar:
            </ThemedText>
            <ThemedText className="font-bold">{verification?.email}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Abra el enlace que le enviamos a ese correo y luego pulse «Ya verifiqué». Si no lo
              encuentra, revise la carpeta de correo no deseado.
            </ThemedText>
          </View>

          {feedback !== null && <Notice tone={feedback.tone}>{feedback.message}</Notice>}

          <View className="gap-4">
            <AnimatedButton
              label="Ya verifiqué"
              busyLabel="Comprobando…"
              icon={CircleCheck}
              status={busyAction === 'confirm' ? 'busy' : 'idle'}
              disabled={isBusy && busyAction !== 'confirm'}
              onPress={handleConfirm}
            />

            <AnimatedButton
              label="Reenviar correo"
              busyLabel="Enviando…"
              successLabel="Correo enviado"
              icon={RefreshCw}
              variant="secondary"
              status={busyAction === 'resend' ? 'busy' : wasResent ? 'success' : 'idle'}
              disabled={isBusy && busyAction !== 'resend'}
              onPress={handleResend}
            />

            <Pressable
              onPress={signOut}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Usar otra cuenta"
              className={`min-h-[48px] items-center justify-center ${isBusy ? 'opacity-60' : ''} active:scale-[0.98]`}>
              <ThemedText type="smallBold" maxFontSizeMultiplier={ChromeFontScale}>
                Usar otra cuenta
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

