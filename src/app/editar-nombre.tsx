import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Save, UserRound, UserRoundPen } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { useSession, type UpdateNameResult } from '@/auth/session-context';
import { AnimatedButton, useSuccessFlash } from '@/components/motion/animated-button';
import { AnimatedInputFrame, resolveInputState } from '@/components/motion/animated-input-frame';
import { useCircularNavigation } from '@/components/motion/circular-transition';
import { FieldMessage } from '@/components/motion/field-message';
import { Notice } from '@/components/notice';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Colors } from '@/constants/theme';
import { DISPLAY_NAME_MAX_LENGTH, sanitizeNameInput, validateDisplayName } from '@/domain/auth';

const ERROR_MESSAGES: Record<Exclude<UpdateNameResult, 'ok'>, string> = {
  invalid: 'Su sesión ya no es válida. Cierre sesión e ingrese de nuevo.',
  network: 'No se pudo conectar con el servidor. Para cambiar el nombre se necesita internet.',
  'too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  unavailable: 'No se pudo actualizar el nombre. Intente de nuevo más tarde.',
};

// Los campos y la marca son blancos en ambos modos; se usa la paleta clara para que el texto y
// los iconos conserven el contraste sobre esa superficie.
const SURFACE = Colors.light;

// Deja ver el paso a éxito del botón antes de volver al inicio.
const SUCCESS_PAUSE_MS = 600;

export default function EditNameScreen() {
  const { technician, displayName, updateDisplayName } = useSession();
  const router = useRouter();
  const { navigateWithReveal } = useCircularNavigation();
  const currentName =
    displayName ?? (technician ? `${technician.name} ${technician.surname}` : '');
  const [name, setName] = useState(currentName);
  const [isTouched, setIsTouched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wasSaved, flashSaved] = useSuccessFlash();

  const validationError = validateDisplayName(name);
  const fieldError = isTouched ? validationError : null;
  const isUnchanged = name.trim() === currentName;

  const handleSubmit = async () => {
    if (isSubmitting || wasSaved || isUnchanged) {
      return;
    }

    setIsTouched(true);
    setErrorMessage(null);
    if (validationError !== null) {
      return;
    }

    setIsSubmitting(true);
    const result = await updateDisplayName(name);
    setIsSubmitting(false);

    if (result === 'ok') {
      flashSaved();
      setTimeout(() => navigateWithReveal(null, () => router.back()), SUCCESS_PAUSE_MS);
    } else {
      setErrorMessage(ERROR_MESSAGES[result]);
    }
  };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerClassName="grow gap-6 py-6" keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center gap-4">
              <View className="w-[56px] h-[56px] rounded-full items-center justify-center bg-surface-info-background">
                <UserRoundPen color={SURFACE.accent} size={28} strokeWidth={2} />
              </View>
              <View className="flex-1 gap-[2px]">
                <ThemedText type="caption" themeColor="infoForeground">
                  Mi cuenta
                </ThemedText>
                <ThemedText type="heading">Editar nombre</ThemedText>
              </View>
            </View>
            <View className="w-[48px] h-[3px] rounded-full bg-accent" />

            <View className="gap-4">
              <ThemedText type="small" themeColor="textSecondary">
                Este es el nombre que se muestra en la aplicación. Su código de empleado no cambia.
              </ThemedText>

              <View className="gap-2">
                <ThemedText type="smallBold">Nombre</ThemedText>
                <AnimatedInputFrame
                  state={resolveInputState({
                    isFocused,
                    isInvalid: fieldError !== null,
                    isValid: isTouched && validationError === null && !isUnchanged,
                  })}
                  palette={SURFACE}
                  className="min-h-[52px] flex-row items-center gap-2 px-4">
                  <UserRound color={SURFACE.accent} size={20} />
                  <TextInput
                    className="flex-1 min-h-[48px] py-2 text-[16px] text-surface-text"
                    selectionColor={SURFACE.accent}
                    cursorColor={SURFACE.accent}
                    value={name}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    onChangeText={(value) => {
                      setName(sanitizeNameInput(value));
                      setIsTouched(true);
                      setErrorMessage(null);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                      setIsFocused(false);
                      setIsTouched(true);
                    }}
                    onSubmitEditing={handleSubmit}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="done"
                    accessibilityLabel="Nombre"
                  />
                </AnimatedInputFrame>
                {fieldError !== null && (
                  <FieldMessage>
                    <ThemedText
                      type="small"
                      themeColor="errorForeground"
                      accessibilityLiveRegion="polite">
                      {fieldError}
                    </ThemedText>
                  </FieldMessage>
                )}
              </View>

              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}

              <AnimatedButton
                label="Guardar nombre"
                busyLabel="Guardando…"
                successLabel="Nombre actualizado"
                icon={Save}
                status={isSubmitting ? 'busy' : wasSaved ? 'success' : 'idle'}
                disabled={isUnchanged && !wasSaved}
                onPress={handleSubmit}
                className="mt-2"
              />

              <Pressable
                onPress={(event) => navigateWithReveal(event, () => router.back())}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Volver al inicio"
                className="min-h-[48px] items-center justify-center active:scale-[0.98]">
                <ThemedText
                  type="smallBold"
                  maxFontSizeMultiplier={ChromeFontScale}
                  themeColor="infoForeground">
                  Volver al inicio
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

