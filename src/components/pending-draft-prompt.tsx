import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session-context';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getReadingMonth } from '@/domain/reading';
import type { ReadingDraft } from '@/domain/reading-draft';
import { useTheme } from '@/hooks/use-theme';
import { deleteReadingPhoto } from '@/storage/photos';
import { deleteDraft, findMeterReadingInMonth, loadDraft } from '@/storage/readings';

// El aviso se ofrece una vez por técnico cada vez que se abre la app.
let promptedEmployeeCode: string | null = null;

// HU-008: al abrir la app con sesión iniciada, ofrece continuar o descartar la captura pendiente.
export function PendingDraftPrompt() {
  const { status, technician } = useSession();
  const router = useRouter();
  const theme = useTheme();
  const [draft, setDraft] = useState<ReadingDraft | null>(null);
  const [discardFailed, setDiscardFailed] = useState(false);
  const employeeCode = technician?.employeeCode;

  useEffect(() => {
    if (status !== 'authenticated' || !employeeCode || promptedEmployeeCode === employeeCode) {
      return;
    }

    promptedEmployeeCode = employeeCode;
    loadPendingDraft(employeeCode)
      .then(setDraft)
      .catch((error: unknown) => {
        console.error('No se pudo consultar la captura pendiente.', error);
      });
  }, [status, employeeCode]);

  if (!draft || status !== 'authenticated' || draft.employeeCode !== employeeCode) {
    return null;
  }

  const handleContinue = () => {
    setDraft(null);
    router.push({ pathname: '/medidor', params: { restoreDraft: '1' } });
  };

  const handleDiscard = () => {
    setDiscardFailed(false);
    deleteDraft(draft.employeeCode)
      .then((photoUri) => {
        if (photoUri) {
          deleteReadingPhoto(photoUri);
        }
        setDraft(null);
      })
      .catch((error: unknown) => {
        console.error('No se pudo descartar la captura pendiente.', error);
        setDiscardFailed(true);
      });
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={handleContinue}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: theme.background }]}>
          <ThemedText type="subtitle">Registro pendiente</ThemedText>
          <ThemedText>
            {`La app se cerró durante el registro del medidor MED-${draft.meterDigits}. ¿Desea continuar la captura o descartarla?`}
          </ThemedText>
          {discardFailed && (
            <ThemedText accessibilityLiveRegion="polite">
              No se pudo descartar la captura. Inténtelo de nuevo.
            </ThemedText>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={{ color: theme.background }}>Continuar captura</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Elimina los datos y la foto de la captura pendiente."
            onPress={handleDiscard}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              { borderColor: theme.text },
              pressed && styles.pressed,
            ]}>
            <ThemedText>Descartar captura</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialog: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});

// Una captura cuyo medidor ya tiene registro este mes no puede terminarse (HU-010 CA-03):
// se descarta sin preguntar para no ofrecer retomar un registro ya guardado o enviado.
async function loadPendingDraft(employeeCode: string): Promise<ReadingDraft | null> {
  const draft = await loadDraft(employeeCode);
  if (!draft) {
    return null;
  }

  const monthReading = await findMeterReadingInMonth(
    `MED-${draft.meterDigits}`,
    getReadingMonth(new Date()),
  );
  if (!monthReading) {
    return draft;
  }

  const photoUri = await deleteDraft(employeeCode);
  if (photoUri && photoUri !== monthReading.photoUri) {
    deleteReadingPhoto(photoUri);
  }
  return null;
}
