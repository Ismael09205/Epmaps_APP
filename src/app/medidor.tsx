import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { MaskedTextInput } from 'react-native-mask-text';
import { onlineManager, useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeterPhotoCapture } from '@/components/meter-photo-capture';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { classifyMeterCode } from '@/domain/meter-code';
import { decideDraftMeterSource, type ReadingDraft } from '@/domain/reading-draft';
import {
  formatMeterReadingDate,
  getCacheExpiry,
  type Meter,
  type MeterLookupResult,
} from '@/domain/meter';
import {
  assessConsumption,
  correctMeterReading,
  createMeterReading,
  formatReadingDifference,
  formatReadingTimestamp,
  getReadingMonth,
  isPhotoRequired,
  MAX_NOTE_LENGTH,
  MeterReadingError,
  MIN_NOTE_LENGTH,
  validateReadingForm,
  type ConsumptionAssessment,
  type MeterCondition,
  type MeterReading,
  type ReadingFormInput,
  type ReadingMeterContext,
} from '@/domain/reading';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/auth/session-context';
import { fetchMeter } from '@/api/meters';
import {
  meterCacheQueryKey,
  pruneExpiredMeterCache,
  type MeterCacheEntry,
} from '@/query/query-client';
import {
  pendingSyncCountQueryKey,
  READING_SYNC_MUTATION_KEY,
  syncPendingReadings,
} from '@/query/reading-sync';
import {
  meterReadingsQueryKey,
  verifyPendingReadingsAndRefresh,
} from '@/query/reading-verification';
import { deleteReadingPhoto, persistReadingPhoto } from '@/storage/photos';
import {
  DuplicateReadingError,
  findMeterReadingInMonth,
  listMeterReadings,
  loadDraft,
  saveDraftForm,
  saveDraftMeterCode,
  saveDraftMeterSnapshot,
  saveReading,
  updateReading,
} from '@/storage/readings';

let meterCodeDraft = '';

type LookupStatus =
  | 'loading'
  | 'success'
  | 'offline-cache'
  | 'offline-empty'
  | 'not-found'
  | 'ambiguous'
  | 'error'
  | 'expired'
  | 'restored-cache'
  | 'restored-outdated'
  | 'restored-requires-connection';

type LookupFeedback = {
  meterCode: string;
  status: LookupStatus;
};

class MeterLookupError extends Error {
  constructor(readonly status: 'not-found' | 'ambiguous') {
    super(status === 'not-found' ? 'Medidor no encontrado.' : 'Respuesta ambigua.');
    this.name = 'MeterLookupError';
  }
}

export default function MeterScreen() {
  const { technician } = useSession();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { restoreDraft } = useLocalSearchParams<{ restoreDraft?: string }>();
  const [digits, setDigits] = useState(meterCodeDraft);
  const [lookup, setLookup] = useState<LookupFeedback | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<ReadingDraft | null>(null);
  // HU-008: ficha guardada en la captura pendiente, usada si no se pudo obtener una vigente.
  const [snapshotMeter, setSnapshotMeter] = useState<Meter | null>(null);
  const status = classifyMeterCode(`MED-${digits}`);
  const meterCode = `MED-${digits}`;
  const employeeCode = technician?.employeeCode ?? '';
  const queryKey =
    status === 'valid' && employeeCode
      ? meterCacheQueryKey(employeeCode, meterCode)
      : (['meter-cache', 'disabled'] as const);

  const query = useQuery<MeterCacheEntry>({
    queryKey,
    queryFn: () => loadMeterCacheEntry(meterCode),
    enabled: false,
    staleTime: Infinity,
  });

  const currentLookup = lookup?.meterCode === meterCode ? lookup.status : null;
  const cachedEntryExpired =
    query.data !== undefined && query.data.expiresAt <= Date.now();
  const meterEntry =
    currentLookup === null ||
    currentLookup === 'expired' ||
    cachedEntryExpired
      ? undefined
      : query.data;
  const displayedMeter =
    meterEntry?.meter ??
    (currentLookup === 'restored-outdated' ? (snapshotMeter ?? undefined) : undefined);
  const canConsult = status === 'valid' && employeeCode !== '' && !query.isFetching;

  useEffect(() => {
    if (restoreDraft !== '1' || employeeCode === '') {
      return;
    }

    let cancelled = false;
    loadDraft(employeeCode)
      .then((draft) => {
        if (cancelled || !draft) {
          return;
        }

        const draftMeterCode = `MED-${draft.meterDigits}`;
        meterCodeDraft = draft.meterDigits;
        setDigits(draft.meterDigits);
        setRestoredDraft(draft);
        setSnapshotMeter(draft.meter);
        if (classifyMeterCode(draftMeterCode) !== 'valid') {
          return;
        }

        pruneExpiredMeterCache(queryClient);
        const cachedEntry = queryClient.getQueryData<MeterCacheEntry>(
          meterCacheQueryKey(employeeCode, draftMeterCode),
        );
        const source = decideDraftMeterSource({
          hasValidCache: cachedEntry !== undefined && cachedEntry.expiresAt > Date.now(),
          hasSnapshot: draft.meter !== null,
          isOnline: onlineManager.isOnline(),
        });

        if (source === 'refresh') {
          startLookup(draftMeterCode, draft.meter !== null);
        } else {
          setLookup({
            meterCode: draftMeterCode,
            status:
              source === 'cache'
                ? 'restored-cache'
                : source === 'outdated-snapshot'
                  ? 'restored-outdated'
                  : 'restored-requires-connection',
          });
        }
      })
      .catch((error: unknown) => {
        console.error('No se pudo recuperar la captura pendiente.', error);
      });

    return () => {
      cancelled = true;
    };
    // Solo se restaura una vez al abrir la pantalla desde el aviso de captura pendiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDraft, employeeCode]);

  useEffect(() => {
    if (!meterEntry) {
      return;
    }

    const expiresIn = meterEntry.expiresAt - Date.now();
    if (expiresIn <= 0) {
      pruneExpiredMeterCache(queryClient);
      setLookup({ meterCode, status: 'expired' });
      return;
    }

    const timeout = setTimeout(() => {
      pruneExpiredMeterCache(queryClient, new Date());
      setLookup({ meterCode, status: 'expired' });
    }, expiresIn);

    return () => clearTimeout(timeout);
  }, [meterCode, meterEntry?.expiresAt, queryClient]);

  useEffect(() => {
    if (
      lookup?.meterCode !== meterCode ||
      (lookup.status !== 'offline-cache' && lookup.status !== 'offline-empty')
    ) {
      return;
    }

    return onlineManager.subscribe((isOnline) => {
      if (isOnline) {
        setLookup((current) =>
          current?.meterCode === meterCode ? { meterCode, status: 'loading' } : current,
        );
      }
    });
  }, [lookup?.meterCode, lookup?.status, meterCode]);

  const handleChangeText = (_text: string, rawText: string) => {
    const nextDigits = rawText.replace(/\D/g, '').slice(0, 6);
    meterCodeDraft = nextDigits;
    setDigits(nextDigits);
    setLookup(null);
    setRestoredDraft(null);
    setSnapshotMeter(null);

    if (employeeCode !== '') {
      saveDraftMeterCode(employeeCode, nextDigits)
        .then((abandonedPhotoUri) => {
          if (abandonedPhotoUri) {
            deleteReadingPhoto(abandonedPhotoUri);
          }
        })
        .catch((error: unknown) => {
          console.error('No se pudo guardar la captura pendiente.', error);
        });
    }
  };

  const handleConsult = () => {
    if (!canConsult) {
      return;
    }

    Keyboard.dismiss();
    startLookup(meterCode, false);
  };

  // `useSnapshotOnFailure`: al continuar una captura, si la actualización falla se usa la
  // ficha guardada en la captura, marcada como desactualizada.
  function startLookup(meterCode: string, useSnapshotOnFailure: boolean) {
    pruneExpiredMeterCache(queryClient);
    const key = meterCacheQueryKey(employeeCode, meterCode);
    const cachedEntry = queryClient.getQueryData<MeterCacheEntry>(key);
    const isOnline = onlineManager.isOnline();

    setLookup({
      meterCode,
      status: isOnline ? 'loading' : cachedEntry ? 'offline-cache' : 'offline-empty',
    });

    void queryClient
      .fetchQuery({
        queryKey: key,
        queryFn: () => loadMeterCacheEntry(meterCode),
        retry: false,
        staleTime: 0,
      })
      .then(() => setLookup({ meterCode, status: 'success' }))
      .catch((error: unknown) => {
        const nextStatus = useSnapshotOnFailure
          ? 'restored-outdated'
          : error instanceof MeterLookupError
            ? error.status
            : 'error';
        setLookup({ meterCode, status: nextStatus });
      });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Identificación del medidor</ThemedText>

            <View style={styles.field}>
              <ThemedText type="smallBold">Código del medidor</ThemedText>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.textSecondary,
                  },
                ]}>
                <ThemedText style={styles.prefix}>MED-</ThemedText>
                <MaskedTextInput
                  accessibilityLabel="Seis dígitos del código del medidor"
                  accessibilityHint="El prefijo MED aparece antes del campo."
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  mask="999999"
                  maxLength={6}
                  onChangeText={handleChangeText}
                  style={[styles.input, { color: theme.text }]}
                  value={digits}
                />
              </View>
              {status === 'valid' ? (
                <ThemedText accessibilityLiveRegion="polite">Código válido.</ThemedText>
              ) : status === 'incomplete' ? (
                <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
                  Ingrese los seis dígitos de la etiqueta.
                </ThemedText>
              ) : null}
            </View>

            {status === 'valid' && (
              <View style={styles.lookupSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Consultar datos del medidor ${meterCode}`}
                  accessibilityState={{ disabled: !canConsult }}
                  disabled={!canConsult}
                  onPress={handleConsult}
                  style={({ pressed }) => [
                    styles.consultButton,
                    { backgroundColor: theme.text },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText style={{ color: theme.background }}>Consultar</ThemedText>
                </Pressable>

                {currentLookup === null && (
                  <ThemedText themeColor="textSecondary">
                    Seleccione Consultar para ver los datos disponibles.
                  </ThemedText>
                )}

                {currentLookup !== null && (
                  <View accessibilityLiveRegion="polite" style={styles.feedback}>
                    {currentLookup === 'loading' && !meterEntry && (
                      <View style={styles.loading}>
                        <ActivityIndicator
                          color={theme.text}
                          size="small"
                          accessibilityLabel="Consultando datos del medidor"
                        />
                        <ThemedText>Consultando datos del medidor…</ThemedText>
                      </View>
                    )}
                    {currentLookup === 'success' && (
                      <ThemedText>Datos del medidor consultados.</ThemedText>
                    )}
                    {currentLookup === 'offline-cache' && (
                      <ThemedText>
                        Sin conexión. La información guardada puede estar desactualizada.
                      </ThemedText>
                    )}
                    {currentLookup === 'offline-empty' && (
                      <ThemedText>
                        Sin conexión. No hay datos actuales disponibles.
                      </ThemedText>
                    )}
                    {currentLookup === 'not-found' && (
                      <ThemedText>
                        {meterEntry
                          ? 'La oficina no encontró el medidor. Se conserva la ficha anterior, que puede estar desactualizada.'
                          : 'La oficina no encontró el medidor.'}
                      </ThemedText>
                    )}
                    {currentLookup === 'ambiguous' && (
                      <ThemedText>
                        {meterEntry
                          ? 'La oficina devolvió más de un registro. Se conserva la ficha anterior, que puede estar desactualizada.'
                          : 'La oficina devolvió más de un registro para este medidor. No se actualizó la ficha.'}
                      </ThemedText>
                    )}
                    {currentLookup === 'error' && (
                      <ThemedText>
                        {meterEntry
                          ? 'No se pudo actualizar la información. Se conserva la ficha guardada, que puede estar desactualizada.'
                          : 'No se pudieron consultar los datos. Revise la conexión e inténtelo de nuevo.'}
                      </ThemedText>
                    )}
                    {currentLookup === 'restored-cache' && (
                      <ThemedText>
                        Captura pendiente recuperada con la ficha guardada del medidor.
                      </ThemedText>
                    )}
                    {currentLookup === 'restored-outdated' && (
                      <ThemedText>
                        Captura pendiente recuperada. Se usan los datos guardados del medidor, que
                        pueden estar desactualizados.
                      </ThemedText>
                    )}
                    {currentLookup === 'restored-requires-connection' && (
                      <ThemedText>
                        Captura pendiente recuperada. Se necesita conexión para consultar la ficha
                        del medidor.
                      </ThemedText>
                    )}
                    {currentLookup === 'expired' && (
                      <ThemedText>
                        Los datos guardados vencieron. Consulte de nuevo para obtener datos actuales.
                      </ThemedText>
                    )}
                  </View>
                )}

                {displayedMeter && (
                  <View
                    style={[
                      styles.meterCard,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.textSecondary,
                      },
                    ]}>
                    <ThemedText type="smallBold">
                      {`Ficha del medidor ${displayedMeter.meterCode}`}
                    </ThemedText>
                    <MeterDetail label="Dirección" value={displayedMeter.address} />
                    <MeterDetail label="Sector" value={displayedMeter.sector} />
                    <MeterDetail label="Número de cuenta" value={displayedMeter.accountNumber} />
                    <MeterDetail label="Estado" value={displayedMeter.status} />
                    <MeterDetail
                      label="Última lectura"
                      value={`${displayedMeter.lastReading} ${displayedMeter.monthlyAverageConsumptionUnit}`}
                    />
                    <MeterDetail
                      label="Fecha de última lectura"
                      value={formatMeterReadingDate(displayedMeter.lastReadingDate)}
                    />
                    <MeterDetail
                      label="Consumo promedio mensual"
                      value={`${displayedMeter.monthlyAverageConsumption} ${displayedMeter.monthlyAverageConsumptionUnit}`}
                    />
                  </View>
                )}

                {employeeCode !== '' && (
                  <ReadingRegistration
                    key={meterCode}
                    employeeCode={employeeCode}
                    meterCode={meterCode}
                    meterDigits={digits}
                    meter={displayedMeter}
                    initialDraft={
                      restoredDraft?.meterDigits === digits ? restoredDraft : undefined
                    }
                    offlineWithoutMeter={
                      currentLookup === 'offline-empty' ||
                      currentLookup === 'restored-requires-connection'
                    }
                  />
                )}
              </View>
            )}
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
    gap: Spacing.four,
    paddingVertical: Spacing.five,
  },
  field: {
    gap: Spacing.two,
  },
  lookupSection: {
    gap: Spacing.three,
  },
  consultButton: {
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  feedback: {
    gap: Spacing.two,
  },
  loading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  meterCard: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  meterDetail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
  meterDetailValue: {
    flexShrink: 1,
  },
  inputRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 18,
  },
  readingSection: {
    gap: Spacing.three,
  },
  readingInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
  },
  conditionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  conditionOption: {
    minHeight: 48,
    minWidth: 104,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  checkboxRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flexShrink: 1,
  },
  readingPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.two,
  },
  noteInput: {
    minHeight: 80,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
  readingItem: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});

const CONDITION_OPTIONS: { condition: MeterCondition; label: string }[] = [
  { condition: 'normal', label: 'Normal' },
  { condition: 'inaccessible', label: 'Inaccesible' },
  { condition: 'damaged', label: 'Dañado' },
];

const CONDITION_TITLES: Record<MeterCondition, string> = {
  normal: 'Medidor normal',
  inaccessible: 'Medidor inaccesible',
  damaged: 'Medidor dañado',
};

const EMPTY_FORM: ReadingFormInput = {
  condition: null,
  value: '',
  inaccessibleReason: '',
  damageDescription: '',
};

type RegistrationFeedback =
  | { status: 'saved'; reading: MeterReading; savedOffline: boolean }
  | { status: 'corrected'; savedOffline: boolean }
  | { status: 'duplicate' }
  | { status: 'correction-rejected' }
  | { status: 'error' };

type RegistrationState = {
  form: ReadingFormInput;
  meterReviewConfirmed: boolean;
  photoUri: string | null;
};

function toFormInput(reading: MeterReading): ReadingFormInput {
  return {
    condition: reading.condition,
    value: reading.value === null ? '' : String(reading.value),
    inaccessibleReason: reading.inaccessibleReason ?? '',
    damageDescription: reading.damageDescription ?? '',
  };
}

function ReadingRegistration({
  employeeCode,
  meterCode,
  meterDigits,
  meter,
  initialDraft,
  offlineWithoutMeter,
}: {
  employeeCode: string;
  meterCode: string;
  meterDigits: string;
  initialDraft: ReadingDraft | undefined;
  meter: Meter | undefined;
  offlineWithoutMeter: boolean;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReadingFormInput>(initialDraft?.form ?? EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<RegistrationFeedback | null>(null);
  const [meterReviewConfirmed, setMeterReviewConfirmed] = useState(
    initialDraft?.meterReviewConfirmed ?? false,
  );
  const [photoUri, setPhotoUri] = useState<string | null>(initialDraft?.photoUri ?? null);
  // HU-010: registro no enviado en corrección y captura nueva apartada mientras se corrige.
  const [editing, setEditing] = useState<MeterReading | null>(null);
  const stashedRegistration = useRef<RegistrationState | null>(null);
  const isSyncing = useIsMutating({ mutationKey: READING_SYNC_MUTATION_KEY }) > 0;
  const validation = validateReadingForm(form);
  const errors = validation.success ? {} : validation.errors;
  const readingValue =
    validation.success && validation.details.condition !== 'inaccessible'
      ? validation.details.value
      : null;
  // HU-006: se evalúa al registrar, también sin conexión, con la ficha en caché. Al corregir se usa
  // la ficha guardada en el registro.
  const evaluationContext: (Omit<ReadingMeterContext, 'monthlyAverageConsumption'> & {
    monthlyAverageConsumption: number | null;
  }) | undefined = editing
    ? {
        meterCode: editing.meterCode,
        lastReading: editing.previousReading,
        lastReadingDate: editing.previousReadingDate,
        monthlyAverageConsumption: editing.monthlyAverageConsumption,
      }
    : meter;
  const assessment =
    evaluationContext &&
    readingValue !== null &&
    evaluationContext.monthlyAverageConsumption !== null
      ? assessConsumption(
          readingValue,
          evaluationContext.lastReading,
          evaluationContext.monthlyAverageConsumption,
        )
      : null;
  const isElevated = assessment?.check === 'elevated';
  const photoRequired =
    form.condition !== null && isPhotoRequired(form.condition, assessment?.check ?? 'not-applicable');
  const readingsQueryKey = meterReadingsQueryKey(employeeCode, meterCode);
  const readingsQuery = useQuery({
    queryKey: readingsQueryKey,
    queryFn: () => listMeterReadings(employeeCode, meterCode),
    networkMode: 'always',
  });
  // HU-010 CA-03: un solo registro por medidor y mes, sin importar el técnico.
  const currentMonth = getReadingMonth(new Date());
  const monthReadingQuery = useQuery({
    queryKey: [...readingsQueryKey, 'month', currentMonth],
    queryFn: () => findMeterReadingInMonth(meterCode, currentMonth),
    networkMode: 'always',
  });
  const monthReading = monthReadingQuery.data ?? null;
  const showForm =
    editing !== null || (meter !== undefined && monthReadingQuery.isSuccess && monthReading === null);
  const canRegister =
    (editing !== null ? !isSyncing : meter !== undefined && monthReading === null) &&
    validation.success &&
    !isSaving &&
    (!isElevated || meterReviewConfirmed) &&
    (!photoRequired || photoUri !== null);

  useEffect(() => {
    if (!meter) {
      return;
    }

    saveDraftMeterSnapshot(employeeCode, meterDigits, meter).catch((error: unknown) => {
      console.error('No se pudo guardar la ficha en la captura pendiente.', error);
    });
  }, [employeeCode, meterDigits, meter]);

  // HU-008: cada cambio del técnico se conserva para continuar si la app se cierra.
  const persistDraft = (changes: {
    form?: ReadingFormInput;
    meterReviewConfirmed?: boolean;
    photoUri?: string | null;
  }) => {
    if (editing) {
      return;
    }

    saveDraftForm({
      employeeCode,
      meterDigits,
      form: changes.form ?? form,
      meterReviewConfirmed: changes.meterReviewConfirmed ?? meterReviewConfirmed,
      photoUri: changes.photoUri === undefined ? photoUri : changes.photoUri,
      meter: meter ?? null,
    }).catch((error: unknown) => {
      console.error('No se pudo guardar la captura pendiente.', error);
    });
  };

  const updateForm = (changes: Partial<ReadingFormInput>) => {
    const nextForm = { ...form, ...changes };
    setForm(nextForm);
    setFeedback(null);
    persistDraft({ form: nextForm });
  };

  const toggleMeterReview = () => {
    const nextConfirmed = !meterReviewConfirmed;
    setMeterReviewConfirmed(nextConfirmed);
    persistDraft({ meterReviewConfirmed: nextConfirmed });
  };

  // La foto se guarda en el almacenamiento persistente al tomarla; la reemplazada se elimina.
  const handleCapture = async (temporaryUri: string) => {
    const persistedUri = await persistReadingPhoto(temporaryUri, meterCode);
    const replacedUri = photoUri;
    setPhotoUri(persistedUri);
    persistDraft({ photoUri: persistedUri });
    // Al corregir, la foto del registro solo se elimina después de guardar la corrección.
    if (replacedUri && replacedUri !== editing?.photoUri) {
      deleteReadingPhoto(replacedUri);
    }
  };

  const restoreRegistration = () => {
    const stashed = stashedRegistration.current;
    stashedRegistration.current = null;
    setForm(stashed?.form ?? EMPTY_FORM);
    setMeterReviewConfirmed(stashed?.meterReviewConfirmed ?? false);
    setPhotoUri(stashed?.photoUri ?? null);
    setEditing(null);
  };

  const startCorrection = (reading: MeterReading) => {
    if (reading.syncStatus !== 'pending' || isSyncing) {
      return;
    }

    if (!editing) {
      stashedRegistration.current = { form, meterReviewConfirmed, photoUri };
    } else if (photoUri && photoUri !== editing.photoUri) {
      deleteReadingPhoto(photoUri);
    }

    setEditing(reading);
    setForm(toFormInput(reading));
    setMeterReviewConfirmed(reading.meterReviewConfirmed);
    setPhotoUri(reading.photoUri);
    setFeedback(null);
  };

  const cancelCorrection = () => {
    if (editing && photoUri && photoUri !== editing.photoUri) {
      deleteReadingPhoto(photoUri);
    }
    restoreRegistration();
  };

  const handleSaveCorrection = async () => {
    if (!editing || !validation.success || !canRegister) {
      return;
    }

    Keyboard.dismiss();
    setIsSaving(true);
    setFeedback(null);

    try {
      const correctedOnline = onlineManager.isOnline();
      const corrected = correctMeterReading(editing, {
        details: validation.details,
        meterReviewConfirmed,
        photoUri,
        isOnline: correctedOnline,
        correctedAt: new Date(),
      });
      await updateReading(corrected);
      // La foto reemplazada se elimina solo después de guardar correctamente la nueva.
      if (editing.photoUri && editing.photoUri !== corrected.photoUri) {
        deleteReadingPhoto(editing.photoUri);
      }

      restoreRegistration();
      setFeedback({ status: 'corrected', savedOffline: !correctedOnline });
      void refreshReadings(corrected);
    } catch (error: unknown) {
      console.error('No se pudo guardar la corrección.', error);
      setFeedback({
        status: error instanceof MeterReadingError ? 'correction-rejected' : 'error',
      });
      void queryClient.invalidateQueries({ queryKey: readingsQueryKey });
    } finally {
      setIsSaving(false);
    }
  };

  const refreshReadings = async (saved: MeterReading) => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: readingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: pendingSyncCountQueryKey(employeeCode) }),
      ]);
      if (onlineManager.isOnline()) {
        // La conexión pudo volver mientras se guardaba la lectura.
        if (saved.status === 'pending-verification') {
          await verifyPendingReadingsAndRefresh(queryClient);
        }
        // HU-009 CA-01: con conexión, el registro se envía de inmediato.
        await syncPendingReadings(queryClient);
      }
    } catch (error: unknown) {
      console.error('No se pudieron actualizar las lecturas registradas.', error);
    }
  };

  const handleRegister = async () => {
    if (!meter || !validation.success || !canRegister) {
      return;
    }

    Keyboard.dismiss();
    setIsSaving(true);
    setFeedback(null);

    try {
      const recordedAt = new Date();
      const savedOnline = onlineManager.isOnline();
      const reading = createMeterReading({
        employeeCode,
        meterCode,
        details: validation.details,
        meter,
        recordedAt,
        isOnline: savedOnline,
        meterReviewConfirmed,
        photoUri,
      });
      const saved = await saveReading(reading);

      setForm(EMPTY_FORM);
      setMeterReviewConfirmed(false);
      setPhotoUri(null);
      setFeedback({ status: 'saved', reading: saved, savedOffline: !savedOnline });
      void refreshReadings(saved);
    } catch (error: unknown) {
      console.error('No se pudo guardar el registro.', error);
      setFeedback({ status: error instanceof DuplicateReadingError ? 'duplicate' : 'error' });
      if (error instanceof DuplicateReadingError) {
        void queryClient.invalidateQueries({ queryKey: readingsQueryKey });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = [
    styles.readingInput,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.textSecondary,
      color: theme.text,
    },
  ];

  return (
    <View style={styles.readingSection}>
      {showForm ? (
        <View style={styles.field}>
          {editing && (
            <ThemedText type="subtitle">
              {`Corrección del registro del ${formatReadingTimestamp(editing.recordedAt)}`}
            </ThemedText>
          )}
          <ThemedText type="smallBold">Estado del medidor</ThemedText>
          <View accessibilityRole="radiogroup" style={styles.conditionOptions}>
            {CONDITION_OPTIONS.map((option) => {
              const selected = form.condition === option.condition;

              return (
                <Pressable
                  key={option.condition}
                  accessibilityRole="radio"
                  accessibilityLabel={`Estado ${option.label}`}
                  accessibilityState={{ checked: selected }}
                  onPress={() => updateForm({ condition: option.condition })}
                  style={({ pressed }) => [
                    styles.conditionOption,
                    {
                      borderColor: selected ? theme.text : theme.textSecondary,
                      backgroundColor: selected ? theme.text : theme.backgroundElement,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type={selected ? 'smallBold' : 'small'}
                    style={selected ? { color: theme.background } : undefined}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {errors.condition && (
            <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
              {errors.condition}
            </ThemedText>
          )}

          {form.condition === 'inaccessible' && (
            <NoteField
              label="Motivo (obligatorio)"
              accessibilityLabel="Motivo por el que el medidor está inaccesible"
              value={form.inaccessibleReason}
              error={errors.inaccessibleReason}
              onChangeText={(text) => updateForm({ inaccessibleReason: text })}
              style={inputStyle}
            />
          )}

          {form.condition === 'damaged' && (
            <NoteField
              label="Descripción del daño (obligatoria)"
              accessibilityLabel="Descripción del daño del medidor"
              value={form.damageDescription}
              error={errors.damageDescription}
              onChangeText={(text) => updateForm({ damageDescription: text })}
              style={inputStyle}
            />
          )}

          {(form.condition === 'normal' || form.condition === 'damaged') && (
            <View style={styles.field}>
              <ThemedText type="smallBold">
                {form.condition === 'normal'
                  ? 'Lectura del medidor (obligatoria)'
                  : 'Lectura del medidor (opcional)'}
              </ThemedText>
              <TextInput
                accessibilityLabel={`Lectura del medidor ${meterCode}`}
                accessibilityHint="Hasta 5 dígitos enteros y 4 decimales."
                keyboardType="decimal-pad"
                onChangeText={(text) => updateForm({ value: text })}
                placeholder="Ej. 125.5"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={form.value}
              />
              {errors.value && (
                <ThemedText
                  themeColor={form.value.trim() === '' ? 'textSecondary' : 'text'}
                  accessibilityLiveRegion="polite">
                  {errors.value}
                </ThemedText>
              )}
            </View>
          )}

          {assessment && evaluationContext && (
            <ConsumptionNotice
              assessment={assessment}
              previousReading={evaluationContext.lastReading}
              unit={meter?.monthlyAverageConsumptionUnit ?? ''}
            />
          )}

          {isElevated && (
            <>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: meterReviewConfirmed }}
                onPress={toggleMeterReview}
                style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: theme.text,
                      backgroundColor: meterReviewConfirmed ? theme.text : 'transparent',
                    },
                  ]}>
                  {meterReviewConfirmed && (
                    <ThemedText style={{ color: theme.background }}>✓</ThemedText>
                  )}
                </View>
                <ThemedText style={styles.checkboxLabel}>
                  Confirmo que revisé el medidor de agua
                </ThemedText>
              </Pressable>
            </>
          )}

          {form.condition !== null && (
            <MeterPhotoCapture
              photoUri={photoUri}
              required={photoRequired}
              onCapture={handleCapture}
            />
          )}

          {editing && isSyncing && (
            <ThemedText accessibilityLiveRegion="polite">
              Se están enviando registros. Espere a que termine el envío para guardar la corrección.
            </ThemedText>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              editing ? 'Guardar corrección del registro' : `Registrar el medidor ${meterCode}`
            }
            accessibilityState={{ disabled: !canRegister, busy: isSaving }}
            disabled={!canRegister}
            onPress={() => void (editing ? handleSaveCorrection() : handleRegister())}
            style={({ pressed }) => [
              styles.consultButton,
              { backgroundColor: theme.text },
              (pressed || !canRegister) && styles.pressed,
            ]}>
            <ThemedText style={{ color: theme.background }}>
              {isSaving ? 'Guardando…' : editing ? 'Guardar corrección' : 'Registrar'}
            </ThemedText>
          </Pressable>
          {editing && (
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={cancelCorrection}
              style={({ pressed }) => [
                styles.consultButton,
                styles.secondaryButton,
                { borderColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <ThemedText>Cancelar corrección</ThemedText>
            </Pressable>
          )}
        </View>
      ) : meter && monthReading ? (
        <ThemedText accessibilityLiveRegion="polite">
          {monthReading.employeeCode === employeeCode && monthReading.syncStatus === 'pending'
            ? 'Este medidor ya tiene un registro este mes. Puede modificarlo en Registros guardados mientras no se haya enviado.'
            : 'Este medidor ya tiene un registro este mes y no se puede registrar otro.'}
        </ThemedText>
      ) : (
        offlineWithoutMeter && (
          <ThemedText accessibilityLiveRegion="polite">
            No se puede registrar el medidor sin conexión porque no hay una ficha guardada.
          </ThemedText>
        )
      )}

      {feedback && (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <ThemedText type="smallBold">
            {feedback.status === 'error'
              ? 'No se pudo guardar el registro. Inténtelo de nuevo.'
              : feedback.status === 'duplicate'
                ? 'No se guardó: este medidor ya tiene un registro este mes.'
                : feedback.status === 'correction-rejected'
                  ? 'No se guardaron los cambios: el registro ya fue enviado o los datos no son válidos.'
                  : feedback.status === 'corrected'
                    ? 'Cambios guardados en el registro.'
                    : 'Registro guardado.'}
          </ThemedText>
          {feedback.status === 'saved' && (
            <ThemedText>
              {feedback.reading.status === 'verified' && feedback.reading.difference !== null
                ? `Diferencia con la lectura anterior: ${formatReadingDifference(
                    feedback.reading.difference,
                  )}.`
                : feedback.reading.status === 'not-applicable'
                  ? 'Comparación con la lectura anterior: No aplica.'
                  : 'La comparación con la lectura anterior se hará al recuperar la conexión.'}
            </ThemedText>
          )}
          {(feedback.status === 'saved' || feedback.status === 'corrected') && (
            <ThemedText>
              {feedback.savedOffline
                ? 'Actualmente no tiene conexión. Estado: Pendiente de envío. Se enviará automáticamente al recuperar la conexión.'
                : 'Estado: Pendiente de envío. Se enviará en este momento.'}
            </ThemedText>
          )}
        </View>
      )}

      {readingsQuery.isError && (
        <ThemedText>No se pudieron cargar los registros guardados.</ThemedText>
      )}

      {readingsQuery.data && readingsQuery.data.length > 0 && (
        <View style={styles.field}>
          <ThemedText type="smallBold">Registros guardados</ThemedText>
          {readingsQuery.data.map((reading) => (
            <ReadingItem
              key={reading.id}
              reading={reading}
              isEditing={editing?.id === reading.id}
              correctionBlocked={isSyncing || isSaving}
              onCorrect={() => startCorrection(reading)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ConsumptionNotice({
  assessment,
  previousReading,
  unit,
}: {
  assessment: ConsumptionAssessment;
  previousReading: number;
  unit: string;
}) {
  if (assessment.check === 'not-applicable') {
    return null;
  }

  return (
    <ThemedText accessibilityLiveRegion="polite">
      {assessment.check === 'review-required'
        ? `La lectura es menor que la anterior (${previousReading}). El registro quedará marcado para revisión y no se calculará el consumo.`
        : assessment.check === 'elevated'
          ? `Advertencia: el consumo del mes (${assessment.consumption} ${unit}) supera el triple del promedio mensual (${assessment.threshold} ${unit}). Revise el medidor y tome una foto.`
          : `Consumo del mes: ${assessment.consumption} ${unit}.`}
    </ThemedText>
  );
}

function NoteField({
  label,
  accessibilityLabel,
  value,
  error,
  onChangeText,
  style,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  error: string | undefined;
  onChangeText: (text: string) => void;
  style: ComponentProps<typeof TextInput>['style'];
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={`Entre ${MIN_NOTE_LENGTH} y ${MAX_NOTE_LENGTH} caracteres: letras, números, espacios, coma, punto y guion.`}
        maxLength={MAX_NOTE_LENGTH}
        multiline
        // Evita saltos de línea: el texto solo admite letras, números, espacios, coma, punto y guion.
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        onChangeText={onChangeText}
        placeholderTextColor={theme.textSecondary}
        style={[style, styles.noteInput]}
        value={value}
      />
      <ThemedText
        type={value.length >= MAX_NOTE_LENGTH ? 'smallBold' : 'small'}
        themeColor={value.length >= MAX_NOTE_LENGTH ? 'text' : 'textSecondary'}
        accessibilityLiveRegion="polite">
        {value.length >= MAX_NOTE_LENGTH
          ? `${value.length}/${MAX_NOTE_LENGTH} caracteres. Llegó al límite: no puede escribir más.`
          : `${value.length}/${MAX_NOTE_LENGTH} caracteres`}
      </ThemedText>
      {error && (
        <ThemedText
          themeColor={value.trim() === '' ? 'textSecondary' : 'text'}
          accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

function ReadingItem({
  reading,
  isEditing,
  correctionBlocked,
  onCorrect,
}: {
  reading: MeterReading;
  isEditing: boolean;
  correctionBlocked: boolean;
  onCorrect: () => void;
}) {
  const theme = useTheme();
  const previous = `${reading.previousReading} del ${formatMeterReadingDate(
    reading.previousReadingDate,
  )}`;

  return (
    <View
      style={[
        styles.readingItem,
        { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary },
      ]}>
      <ThemedText type="smallBold">{CONDITION_TITLES[reading.condition]}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {`Registrado el ${formatReadingTimestamp(reading.recordedAt)}`}
      </ThemedText>
      {reading.inaccessibleReason !== null && (
        <ThemedText>{`Motivo: ${reading.inaccessibleReason}`}</ThemedText>
      )}
      {reading.damageDescription !== null && (
        <ThemedText>{`Daño: ${reading.damageDescription}`}</ThemedText>
      )}
      {reading.condition !== 'inaccessible' && (
        <ThemedText>
          {reading.value === null ? 'Sin lectura' : `Lectura: ${reading.value}`}
        </ThemedText>
      )}
      {reading.status === 'verified' && reading.difference !== null ? (
        <ThemedText>
          {`Verificada. Diferencia con la lectura anterior (${previous}): ${formatReadingDifference(
            reading.difference,
          )}`}
        </ThemedText>
      ) : reading.status === 'not-applicable' ? (
        <ThemedText>Comparación con la lectura anterior: No aplica.</ThemedText>
      ) : (
        <ThemedText>
          {`Pendiente de verificar. Se comparará con la lectura anterior (${previous}) al recuperar la conexión.`}
        </ThemedText>
      )}
      {reading.consumptionCheck === 'normal' && (
        <ThemedText>{`Consumo del mes: ${reading.consumption}`}</ThemedText>
      )}
      {reading.consumptionCheck === 'elevated' && (
        <ThemedText>
          {`Consumo elevado: ${reading.consumption}, supera el triple del promedio mensual (${reading.monthlyAverageConsumption}). Revisión del medidor confirmada.`}
        </ThemedText>
      )}
      {reading.consumptionCheck === 'review-required' && (
        <ThemedText>Marcado para revisión: la lectura es menor que la anterior.</ThemedText>
      )}
      {reading.updatedAt && (
        <ThemedText type="small" themeColor="textSecondary">
          {`Modificado el ${formatReadingTimestamp(reading.updatedAt)}`}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {reading.syncStatus === 'sent' && reading.sentAt
          ? `Enviado el ${formatReadingTimestamp(reading.sentAt)}`
          : 'Pendiente de envío'}
      </ThemedText>
      {reading.photoUri && (
        <Image
          accessibilityLabel="Foto del medidor asociada al registro"
          contentFit="cover"
          source={{ uri: reading.photoUri }}
          style={styles.readingPhoto}
        />
      )}
      {reading.syncStatus === 'pending' && !isEditing && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Corregir registro"
          accessibilityHint={
            correctionBlocked ? 'No disponible mientras se envían registros.' : undefined
          }
          accessibilityState={{ disabled: correctionBlocked }}
          disabled={correctionBlocked}
          onPress={onCorrect}
          style={({ pressed }) => [
            styles.consultButton,
            styles.secondaryButton,
            { borderColor: theme.text },
            (pressed || correctionBlocked) && styles.pressed,
          ]}>
          <ThemedText>Corregir</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function MeterDetail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.meterDetail, { borderColor: theme.textSecondary }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.meterDetailValue}>{value}</ThemedText>
    </View>
  );
}

async function loadMeterCacheEntry(meterCode: string): Promise<MeterCacheEntry> {
  const result: MeterLookupResult = await fetchMeter(meterCode);

  if (result.status !== 'found') {
    throw new MeterLookupError(result.status);
  }

  return {
    meter: result.meter,
    expiresAt: getCacheExpiry(new Date()).getTime(),
  };
}
