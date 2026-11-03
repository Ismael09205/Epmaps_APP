import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { Modal, View } from 'react-native';

import { useSession } from '@/auth/session-context';
import { AnimatedButton } from '@/components/motion/animated-button';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
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
      <View className="flex-1 justify-center p-6 bg-[rgba(14,20,48,0.55)]">
        <View
          accessibilityViewIsModal
          className="border-[1px] rounded-lg p-6 gap-4 bg-background border-border">
          <View className="w-[44px] h-[44px] rounded-sm items-center justify-center bg-info-background">
            <ClipboardList color={theme.infoForeground} size={24} />
          </View>
          <ThemedText type="subtitle">Registro pendiente</ThemedText>
          <ThemedText themeColor="textSecondary">
            {`La app se cerró durante el registro del medidor MED-${draft.meterDigits}. ¿Desea continuar la captura o descartarla?`}
          </ThemedText>
          {discardFailed && (
            <Notice tone="error">No se pudo descartar la captura. Inténtelo de nuevo.</Notice>
          )}
          <AnimatedButton label="Continuar captura" onPress={handleContinue} />
          <AnimatedButton
            label="Descartar captura"
            accessibilityHint="Elimina los datos y la foto de la captura pendiente."
            variant="secondary"
            onPress={handleDiscard}
          />
        </View>
      </View>
    </Modal>
  );
}


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
