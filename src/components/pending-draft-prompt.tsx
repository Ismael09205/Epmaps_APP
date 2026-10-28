import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session-context';
import { Notice } from '@/components/notice';
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
          style={[
            styles.dialog,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          <View style={[styles.iconBadge, { backgroundColor: theme.infoBackground }]}>
            <ClipboardList color={theme.infoForeground} size={24} />
          </View>
          <ThemedText type="subtitle">Registro pendiente</ThemedText>
          <ThemedText themeColor="textSecondary">
            {`La app se cerró durante el registro del medidor MED-${draft.meterDigits}. ¿Desea continuar la captura o descartarla?`}
          </ThemedText>
          {discardFailed && (
            <Notice tone="error">No se pudo descartar la captura. Inténtelo de nuevo.</Notice>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
              Continuar captura
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Elimina los datos y la foto de la captura pendiente."
            onPress={handleDiscard}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              { borderColor: theme.inputBorder },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" style={styles.buttonLabel}>
              Descartar captura
            </ThemedText>
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
    backgroundColor: 'rgba(14, 20, 48, 0.55)',
  },
  dialog: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
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
    opacity: 0.8,
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
