import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { BlurTargetView } from 'expo-blur';
import { useLocalSearchParams } from 'expo-router';
import { onlineManager, useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Ban,
  Check,
  CircleCheck,
  Clock,
  CloudOff,
  CloudUpload,
  Gauge,
  Hash,
  Info,
  History,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Search,
  Wrench,
} from 'lucide-react-native';

import { useIsOnline } from '@/components/connection-banner';
import { MeterPhotoCapture } from '@/components/meter-photo-capture';
import { LocationMapPreview } from '@/components/location-map-preview';
import { LocationSummary } from '@/components/location-summary';
import {
  CloudSyncAnimation,
  SuccessAnimation,
  WaterLoadingAnimation,
} from '@/components/lottie/animations';
import { OfflineMapPrompt } from '@/components/offline-map-prompt';
import { ReadingLocationMap } from '@/components/reading-location-map';
import { AnimatedButton, useSuccessFlash } from '@/components/motion/animated-button';
import { AnimatedInputFrame, resolveInputState } from '@/components/motion/animated-input-frame';
import { ExpandableContent, ExpandChevron, RevealSection } from '@/components/motion/expandable';
import { FieldMessage } from '@/components/motion/field-message';
import { FloatingCard } from '@/components/motion/floating-card';
import { SwipeAction } from '@/components/motion/swipe-action';
import { SyncStatusPill } from '@/components/motion/sync-indicators';
import { Notice } from '@/components/notice';
import { Image, MaskedTextInput, SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Fonts, Spacing } from '@/constants/theme';
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
  describeReadingDifference,
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
import type { ReadingLocation } from '@/domain/reading-location';
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
  const blurTargetRef = useRef<View>(null);
  const [digits, setDigits] = useState(meterCodeDraft);
  // MaskedTextInput copia `value` a su estado y a la vez avisa los cambios de ese estado: si recibiera
  // cada dígito escrito, al escribir rápido ambos valores se intercambiarían sin fin. Por eso solo
  // recibe el valor que escribe la app (el inicial y el de una captura recuperada).
  const [inputValue, setInputValue] = useState(meterCodeDraft);
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  const [wasConsulted, flashConsulted] = useSuccessFlash();
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
    // Mientras se consulta no se muestran datos anteriores: todo aparece junto al terminar.
    currentLookup === 'loading' ||
    currentLookup === 'expired' ||
    cachedEntryExpired
      ? undefined
      : query.data;
  const displayedMeter =
    meterEntry?.meter ??
    (currentLookup === 'restored-outdated' ? (snapshotMeter ?? undefined) : undefined);
  const canConsult = status === 'valid' && employeeCode !== '' && !query.isFetching;
  const isConsulting = currentLookup === 'loading' || query.isFetching;

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
        setInputValue(draft.meterDigits);
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
    // El campo con máscara también avisa cuando la app escribe el código (al continuar una
    // captura); sin un cambio real no se reinicia la consulta ni la captura recuperada.
    if (nextDigits === meterCodeDraft) {
      return;
    }
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
      .then(() => {
        setLookup({ meterCode, status: 'success' });
        flashConsulted();
      })
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
    <ThemedView className="flex-1">
      {/* Contenido que se difumina detrás de la recomendación del mapa sin conexión. */}
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView contentContainerClassName="gap-6 pt-6 pb-8" keyboardShouldPersistTaps="handled">
            <View className="gap-1">
              <ThemedText type="caption" themeColor="infoForeground">
                Lectura del período
              </ThemedText>
              <ThemedText type="heading">Identificación del medidor</ThemedText>
            </View>

            <View className="gap-2">
              <ThemedText type="smallBold">Código del medidor</ThemedText>
              <AnimatedInputFrame
                state={resolveInputState({
                  isFocused: isCodeFocused,
                  isInvalid:
                    status === 'invalid' || (currentLookup === 'not-found' && !meterEntry),
                  isValid: status === 'valid',
                })}
                className="min-h-[56px] flex-row items-center pl-4 pr-2">
                <ThemedText type="data" className="text-[22px] leading-[28px] text-info-foreground">
                  MED-
                </ThemedText>
                <MaskedTextInput
                  accessibilityLabel="Seis dígitos del código del medidor"
                  accessibilityHint="El prefijo MED aparece antes del campo."
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  mask="999999"
                  maxLength={6}
                  onChangeText={handleChangeText}
                  onFocus={() => setIsCodeFocused(true)}
                  onBlur={() => setIsCodeFocused(false)}
                  placeholder="000000"
                  placeholderTextColor={theme.border}
                  className="flex-1 min-h-[54px] px-1 py-2 text-[22px] font-bold tracking-[3px] text-text" style={styles.input}
                  value={inputValue}
                />
              </AnimatedInputFrame>
              {status === 'valid' && currentLookup === 'not-found' && !meterEntry ? null : status ===
                'valid' ? (
                <View className="flex-row items-center gap-[6px]" accessibilityLiveRegion="polite">
                  <CircleCheck color={theme.successForeground} size={16} />
                  <ThemedText type="small" className="text-success-foreground">
                    Código válido.
                  </ThemedText>
                </View>
              ) : status === 'incomplete' ? (
                <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
                  Ingrese los seis dígitos de la etiqueta.
                </ThemedText>
              ) : null}
            </View>

            {status === 'valid' && (
              <View className="gap-4">
                <AnimatedButton
                  label="Consultar"
                  busyLabel="Consultando…"
                  successLabel="Consultado"
                  accessibilityLabel={`Consultar datos del medidor ${meterCode}`}
                  icon={Search}
                  status={isConsulting ? 'busy' : wasConsulted ? 'success' : 'idle'}
                  disabled={!canConsult && !isConsulting}
                  onPress={handleConsult}
                />

                {currentLookup === null && (
                  <ThemedText themeColor="textSecondary">
                    Seleccione Consultar para ver los datos disponibles.
                  </ThemedText>
                )}

                {currentLookup !== null && (
                  <View accessibilityLiveRegion="polite" className="gap-4">
                    {currentLookup === 'loading' && (
                      <Notice tone="loading">Consultando datos del medidor…</Notice>
                    )}
                    {currentLookup === 'success' && (
                      <Notice tone="success">Datos del medidor consultados.</Notice>
                    )}
                    {currentLookup === 'offline-cache' && (
                      <Notice tone="warning">
                        Sin conexión. La información guardada puede estar desactualizada.
                      </Notice>
                    )}
                    {currentLookup === 'offline-empty' && (
                      <Notice tone="warning">
                        Sin conexión. No hay datos actuales disponibles.
                      </Notice>
                    )}
                    {currentLookup === 'not-found' && (
                      <Notice tone={meterEntry ? 'warning' : 'error'}>
                        {meterEntry
                          ? 'La oficina no encontró el medidor. Se conserva la ficha anterior, que puede estar desactualizada.'
                          : 'La oficina no encontró el medidor.'}
                      </Notice>
                    )}
                    {currentLookup === 'ambiguous' && (
                      <Notice tone={meterEntry ? 'warning' : 'error'}>
                        {meterEntry
                          ? 'La oficina devolvió más de un registro. Se conserva la ficha anterior, que puede estar desactualizada.'
                          : 'La oficina devolvió más de un registro para este medidor. No se actualizó la ficha.'}
                      </Notice>
                    )}
                    {currentLookup === 'error' && (
                      <Notice tone={meterEntry ? 'warning' : 'error'}>
                        {meterEntry
                          ? 'No se pudo actualizar la información. Se conserva la ficha guardada, que puede estar desactualizada.'
                          : 'No se pudieron consultar los datos. Revise la conexión e inténtelo de nuevo.'}
                      </Notice>
                    )}
                    {currentLookup === 'restored-cache' && (
                      <Notice tone="info">
                        Captura pendiente recuperada con la ficha guardada del medidor.
                      </Notice>
                    )}
                    {currentLookup === 'restored-outdated' && (
                      <Notice tone="warning">
                        Captura pendiente recuperada. Se usan los datos guardados del medidor, que
                        pueden estar desactualizados.
                      </Notice>
                    )}
                    {currentLookup === 'restored-requires-connection' && (
                      <Notice tone="warning">
                        Captura pendiente recuperada. Se necesita conexión para consultar la ficha
                        del medidor.
                      </Notice>
                    )}
                    {currentLookup === 'expired' && (
                      <Notice tone="warning">
                        Los datos guardados vencieron. Consulte de nuevo para obtener datos actuales.
                      </Notice>
                    )}
                  </View>
                )}

                {displayedMeter && (
                  <FloatingCard>
                    <MeterSummary meter={displayedMeter} />
                  </FloatingCard>
                )}

                {employeeCode !== '' && (
                  // Se oculta sin desmontar: una nueva consulta no debe perder lo ya capturado.
                  <View className={`${isConsulting ? 'hidden' : ''}`}>
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
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </BlurTargetView>
      <OfflineMapPrompt
        meterCode={currentLookup === 'success' && displayedMeter ? meterCode : null}
        blurTarget={blurTargetRef}
      />
    </ThemedView>
  );
}

const styles = {
  input: { fontFamily: Fonts.mono },
  readingValueInput: { fontFamily: Fonts.mono },
  noteInput: { textAlignVertical: 'top' },
} as const;

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
  | { status: 'saved'; reading: MeterReading }
  | { status: 'corrected'; reading: MeterReading }
  | { status: 'duplicate' }
  | { status: 'correction-rejected' }
  | { status: 'error' };

type RegistrationState = {
  form: ReadingFormInput;
  meterReviewConfirmed: boolean;
  photoUri: string | null;
  location: ReadingLocation | null;
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
  const [wasSaved, flashSaved] = useSuccessFlash();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReadingFormInput>(initialDraft?.form ?? EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<RegistrationFeedback | null>(null);
  const [meterReviewConfirmed, setMeterReviewConfirmed] = useState(
    initialDraft?.meterReviewConfirmed ?? false,
  );
  const [photoUri, setPhotoUri] = useState<string | null>(initialDraft?.photoUri ?? null);
  // Ubicación obligatoria en los tres estados del medidor: GPS por defecto o marcador manual.
  const [location, setLocation] = useState<ReadingLocation | null>(
    initialDraft?.location ?? null,
  );
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
  const unit = meter?.monthlyAverageConsumptionUnit ?? '';
  const showForm =
    editing !== null || (meter !== undefined && monthReadingQuery.isSuccess && monthReading === null);
  const canRegister =
    (editing !== null ? !isSyncing : meter !== undefined && monthReading === null) &&
    validation.success &&
    !isSaving &&
    (!isElevated || meterReviewConfirmed) &&
    (!photoRequired || photoUri !== null) &&
    location !== null;

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
    location?: ReadingLocation | null;
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
      location: changes.location === undefined ? location : changes.location,
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

  const updateLocation = (nextLocation: ReadingLocation) => {
    setLocation(nextLocation);
    setFeedback(null);
    persistDraft({ location: nextLocation });
  };

  const restoreRegistration = () => {
    const stashed = stashedRegistration.current;
    stashedRegistration.current = null;
    setForm(stashed?.form ?? EMPTY_FORM);
    setMeterReviewConfirmed(stashed?.meterReviewConfirmed ?? false);
    setPhotoUri(stashed?.photoUri ?? null);
    setLocation(stashed?.location ?? null);
    setEditing(null);
  };

  const startCorrection = (reading: MeterReading) => {
    if (reading.syncStatus !== 'pending' || isSyncing) {
      return;
    }

    if (!editing) {
      stashedRegistration.current = { form, meterReviewConfirmed, photoUri, location };
    } else if (photoUri && photoUri !== editing.photoUri) {
      deleteReadingPhoto(photoUri);
    }

    setEditing(reading);
    setForm(toFormInput(reading));
    setMeterReviewConfirmed(reading.meterReviewConfirmed);
    setPhotoUri(reading.photoUri);
    setLocation(reading.location);
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
        location,
        isOnline: correctedOnline,
        correctedAt: new Date(),
      });
      await updateReading(corrected);
      // La foto reemplazada se elimina solo después de guardar correctamente la nueva.
      if (editing.photoUri && editing.photoUri !== corrected.photoUri) {
        deleteReadingPhoto(editing.photoUri);
      }

      restoreRegistration();
      flashSaved();
      setFeedback({ status: 'corrected', reading: corrected });
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
        location,
      });
      const saved = await saveReading(reading);

      setForm(EMPTY_FORM);
      setMeterReviewConfirmed(false);
      setPhotoUri(null);
      setLocation(null);
      flashSaved();
      setFeedback({ status: 'saved', reading: saved });
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

  return (
    <View className="gap-4">
      {showForm ? (
        <View className="gap-2">
          {editing && (
            <ThemedText type="heading">
              {`Corrección del registro del ${formatReadingTimestamp(editing.recordedAt)}`}
            </ThemedText>
          )}
          <ThemedText type="smallBold">Estado del medidor</ThemedText>
          <ConditionSelector
            value={form.condition}
            onChange={(condition) => updateForm({ condition })}
          />
          {errors.condition && (
            <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
              {errors.condition}
            </ThemedText>
          )}

          <RevealSection visible={form.condition === 'inaccessible'}>
            <NoteField
              label="Motivo (obligatorio)"
              accessibilityLabel="Motivo por el que el medidor está inaccesible"
              value={form.inaccessibleReason}
              error={errors.inaccessibleReason}
              onChangeText={(text) => updateForm({ inaccessibleReason: text })}
            />
          </RevealSection>

          <RevealSection visible={form.condition === 'damaged'}>
            <NoteField
              label="Descripción del daño (obligatoria)"
              accessibilityLabel="Descripción del daño del medidor"
              value={form.damageDescription}
              error={errors.damageDescription}
              onChangeText={(text) => updateForm({ damageDescription: text })}
            />
          </RevealSection>

          <RevealSection visible={form.condition === 'normal' || form.condition === 'damaged'}>
            <View className="gap-2">
              <ThemedText type="smallBold">
                {form.condition === 'normal'
                  ? 'Lectura del medidor (obligatoria)'
                  : 'Lectura del medidor (opcional)'}
              </ThemedText>
              <ValidatedTextInput
                error={errors.value}
                accessibilityLabel={`Lectura del medidor ${meterCode}`}
                accessibilityHint="Hasta 5 dígitos enteros y 4 decimales."
                keyboardType="decimal-pad"
                onChangeText={(text) => updateForm({ value: text })}
                placeholder="Ej. 125.5"
                placeholderTextColor={theme.textSecondary}
                className="font-bold tabular-nums" style={styles.readingValueInput}
                value={form.value}
              />
              {errors.value && (
                <FieldMessage>
                  <ThemedText
                    type="small"
                    themeColor={form.value.trim() === '' ? 'textSecondary' : 'errorForeground'}
                    accessibilityLiveRegion="polite">
                    {errors.value}
                  </ThemedText>
                </FieldMessage>
              )}
            </View>
          </RevealSection>

          {assessment && evaluationContext && (
            <ConsumptionNotice
              assessment={assessment}
              previousReading={evaluationContext.lastReading}
              unit={unit}
            />
          )}

          <RevealSection visible={isElevated}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: meterReviewConfirmed }}
                onPress={toggleMeterReview}
                className="min-h-[48px] flex-row items-center gap-4 active:opacity-80">
                <View
                  className={`w-[28px] h-[28px] border-[2px] rounded-[4px] items-center justify-center border-accent ${meterReviewConfirmed ? 'bg-accent' : 'bg-transparent'}`}>
                  {meterReviewConfirmed && <Check color={theme.onAccent} size={18} strokeWidth={3} />}
                </View>
                <ThemedText className="shrink">
                  Confirmo que revisé el medidor de agua
                </ThemedText>
              </Pressable>
          </RevealSection>

          <RevealSection visible={form.condition !== null}>
            <MeterPhotoCapture
              photoUri={photoUri}
              required={photoRequired}
              onCapture={handleCapture}
            />
          </RevealSection>

          {/* El mapa y el GPS se activan solo después de elegir el estado del medidor. */}
          <RevealSection visible={form.condition !== null}>
            <ReadingLocationMap
              key={editing ? `correction-${editing.id}` : 'registration'}
              location={location}
              onChange={updateLocation}
            />
          </RevealSection>

          {editing && isSyncing && (
            <Notice tone="loading">
              Se están enviando registros. Espere a que termine el envío para guardar la corrección.
            </Notice>
          )}

          <AnimatedButton
            label={editing ? 'Guardar corrección' : 'Registrar'}
            busyLabel="Guardando…"
            successLabel="Guardado"
            accessibilityLabel={
              editing ? 'Guardar corrección del registro' : `Registrar el medidor ${meterCode}`
            }
            status={isSaving ? 'busy' : wasSaved ? 'success' : 'idle'}
            disabled={!canRegister && !isSaving}
            onPress={() => void (editing ? handleSaveCorrection() : handleRegister())}
          />
          {editing && (
            <AnimatedButton
              label="Cancelar corrección"
              variant="secondary"
              disabled={isSaving}
              onPress={cancelCorrection}
            />
          )}
        </View>
      ) : meter && monthReading ? (
        <Notice tone="info">
          {monthReading.employeeCode === employeeCode && monthReading.syncStatus === 'pending'
            ? 'Este medidor ya tiene un registro este mes. Puede modificarlo en Registros guardados mientras no se haya enviado.'
            : 'Este medidor ya tiene un registro este mes y no se puede registrar otro.'}
        </Notice>
      ) : (
        offlineWithoutMeter && (
          <Notice tone="warning">
            No se puede registrar el medidor sin conexión porque no hay una ficha guardada.
          </Notice>
        )
      )}

      {feedback &&
        (feedback.status === 'saved' || feedback.status === 'corrected' ? (
          <SavedReadingCard
            title={
              feedback.status === 'corrected'
                ? 'Cambios guardados en el registro'
                : 'Registro guardado'
            }
            reading={
              readingsQuery.data?.find(
                (reading) => reading.readingUuid === feedback.reading.readingUuid,
              ) ?? feedback.reading
            }
            isSyncing={isSyncing}
            unit={unit}
          />
        ) : (
          <Notice
            tone="error"
            title={
              feedback.status === 'error'
                ? 'No se pudo guardar el registro. Inténtelo de nuevo.'
                : feedback.status === 'duplicate'
                  ? 'No se guardó: este medidor ya tiene un registro este mes.'
                  : 'No se guardaron los cambios: el registro ya fue enviado o los datos no son válidos.'
            }
          />
        ))}

      {readingsQuery.isError && (
        <Notice tone="error">No se pudieron cargar los registros guardados.</Notice>
      )}

      {readingsQuery.data && readingsQuery.data.length > 0 && (
        <View className="gap-2">
          <ThemedText type="heading" className="mt-4">
            Registros guardados
          </ThemedText>
          {readingsQuery.data.map((reading, index) => (
            <Animated.View key={reading.id} layout={LinearTransition.duration(240)}>
              <FloatingCard index={index} variant="stack">
                <SwipeAction
                  enabled={
                    reading.syncStatus === 'pending' &&
                    editing?.id !== reading.id &&
                    !isSyncing &&
                    !isSaving
                  }
                  label="Corregir"
                  icon={Pencil}
                  onAction={() => startCorrection(reading)}>
                  <ReadingItem
                    reading={reading}
                    isEditing={editing?.id === reading.id}
                    correctionBlocked={isSyncing || isSaving}
                    unit={unit}
                    onCorrect={() => startCorrection(reading)}
                  />
                </SwipeAction>
              </FloatingCard>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

// El indicador se desliza hasta la opción elegida y el color de cada texto acompaña el cambio.
function ConditionSelector({
  value,
  onChange,
}: {
  value: MeterCondition | null;
  onChange: (condition: MeterCondition) => void;
}) {
  const selectedIndex = CONDITION_OPTIONS.findIndex((option) => option.condition === value);
  const position = useSharedValue(Math.max(selectedIndex, 0));
  const indicatorOpacity = useSharedValue(selectedIndex >= 0 ? 1 : 0);
  const rowWidth = useSharedValue(0);
  const optionCount = CONDITION_OPTIONS.length;

  useEffect(() => {
    if (selectedIndex < 0) {
      indicatorOpacity.set(withTiming(0, { duration: 150 }));
      return;
    }
    // La primera selección aparece en su lugar; las siguientes se deslizan desde la anterior.
    if (indicatorOpacity.get() === 0) {
      position.set(selectedIndex);
    } else {
      position.set(withSpring(selectedIndex, { damping: 18, stiffness: 220 }));
    }
    indicatorOpacity.set(withTiming(1, { duration: 150 }));
  }, [selectedIndex, position, indicatorOpacity]);

  const indicatorStyle = useAnimatedStyle(() => {
    const width = (rowWidth.get() - Spacing.one * (optionCount - 1)) / optionCount;
    return {
      width,
      opacity: indicatorOpacity.get(),
      transform: [{ translateX: position.get() * (width + Spacing.one) }],
    };
  });

  return (
    <View
      accessibilityRole="radiogroup"
      className="border-[1px] rounded-sm p-1 border-input-border bg-background-element">
      <View
        className="flex-row gap-1"
        onLayout={(event) => {
          rowWidth.set(event.nativeEvent.layout.width);
        }}>
        <Animated.View
          className="absolute top-0 bottom-0 left-0 rounded-[4px] bg-accent" style={indicatorStyle}
        />
        {CONDITION_OPTIONS.map((option) => (
          <ConditionOption
            key={option.condition}
            label={option.label}
            selected={value === option.condition}
            onPress={() => onChange(option.condition)}
          />
        ))}
      </View>
    </View>
  );
}

function ConditionOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const idleColor = theme.text;
  const selectedColor = theme.onAccent;
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: 180 }));
  }, [selected, progress]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [idleColor, selectedColor]),
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Estado ${label}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="min-h-[44px] flex-1 rounded-[4px] items-center justify-center px-2 active:opacity-80">
      <Animated.Text
        maxFontSizeMultiplier={ChromeFontScale}
        className="text-[14px] leading-[20px] font-bold text-center" style={labelStyle}>
        {label}
      </Animated.Text>
    </Pressable>
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
    <Notice tone={assessment.check === 'normal' ? 'info' : 'warning'}>
      {assessment.check === 'review-required'
        ? `La lectura es menor que la anterior (${previousReading}). El registro quedará marcado para revisión y no se calculará el consumo.`
        : assessment.check === 'elevated'
          ? `Advertencia: el consumo del mes (${assessment.consumption} ${unit}) supera el triple del promedio mensual (${assessment.threshold} ${unit}). Revise el medidor y tome una foto.`
          : `Consumo del mes: ${assessment.consumption} ${unit}.`}
    </Notice>
  );
}

// Un campo vacío no se marca en rojo: su mensaje solo indica que el dato es obligatorio.
function ValidatedTextInput({
  error,
  style,
  value,
  ...inputProps
}: { error: string | undefined; value: string } & ComponentProps<typeof TextInput>) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.trim() !== '';

  return (
    <AnimatedInputFrame
      state={resolveInputState({
        isFocused,
        isInvalid: Boolean(error) && hasValue,
        isValid: !error && hasValue,
      })}
      className="flex-row items-center pr-4">
      <TextInput
        {...inputProps}
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 min-h-[52px] px-4 text-[18px] text-text" style={style}
      />
    </AnimatedInputFrame>
  );
}

function NoteField({
  label,
  accessibilityLabel,
  value,
  error,
  onChangeText,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  error: string | undefined;
  onChangeText: (text: string) => void;
}) {
  const theme = useTheme();

  return (
    <View className="gap-2">
      <ThemedText type="smallBold">{label}</ThemedText>
      <ValidatedTextInput
        error={error}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={`Entre ${MIN_NOTE_LENGTH} y ${MAX_NOTE_LENGTH} caracteres: letras, números, espacios, coma, punto y guion.`}
        maxLength={MAX_NOTE_LENGTH}
        multiline
        // Evita saltos de línea: el texto solo admite letras, números, espacios, coma, punto y guion.
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        onChangeText={onChangeText}
        placeholderTextColor={theme.textSecondary}
        className="min-h-[80px] py-2" style={styles.noteInput}
        value={value}
      />
      <ThemedText
        type={value.length >= MAX_NOTE_LENGTH ? 'smallBold' : 'small'}
        themeColor={value.length >= MAX_NOTE_LENGTH ? 'warningForeground' : 'textSecondary'}
        accessibilityLiveRegion="polite">
        {value.length >= MAX_NOTE_LENGTH
          ? `${value.length}/${MAX_NOTE_LENGTH} caracteres. Llegó al límite: no puede escribir más.`
          : `${value.length}/${MAX_NOTE_LENGTH} caracteres`}
      </ThemedText>
      {error && (
        <FieldMessage>
          <ThemedText
            type="small"
            themeColor={value.trim() === '' ? 'textSecondary' : 'errorForeground'}
            accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        </FieldMessage>
      )}
    </View>
  );
}

// Estado de envío real del registro: se actualiza solo cuando termina el envío.
function SendingStatus({ reading, isSyncing }: { reading: MeterReading; isSyncing: boolean }) {
  const theme = useTheme();
  const isOnline = useIsOnline();
  const isSent = reading.syncStatus === 'sent';

  const status = isSent
    ? {
        Icon: CircleCheck,
        color: theme.successForeground,
        title: 'Enviado a la oficina',
        detail: reading.sentAt ? `El ${formatReadingTimestamp(reading.sentAt)}` : null,
      }
    : !isOnline
      ? {
          Icon: CloudOff,
          animation: 'cloud-sync' as const,
          color: theme.warningForeground,
          title: 'Guardado en el teléfono',
          detail: 'Sin conexión. Se enviará automáticamente al recuperar la conexión.',
        }
      : isSyncing
        ? {
            Icon: null,
            color: theme.infoForeground,
            title: 'Enviando a la oficina…',
            detail: null,
          }
        : {
            Icon: CloudUpload,
            color: theme.infoForeground,
            title: 'En cola de envío',
            detail: 'Se enviará automáticamente en este momento.',
          };
  const { Icon } = status;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="border-t-[0.5px] pt-4 border-t-border">
      <FieldMessage key={status.title}>
        <View className="flex-row items-start gap-2">
          {status.animation === 'cloud-sync' ? (
            <CloudSyncAnimation
              size={24}
              colors={{ primary: theme.accent, secondary: theme.text, base: theme.backgroundSelected }}
            />
          ) : Icon ? (
            <Icon color={status.color} size={20} />
          ) : (
            <WaterLoadingAnimation size={24} />
          )}
          <View className="flex-1">
            <ThemedText type="caption" themeColor="textSecondary">
              ENVÍO
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: status.color }}>
              {status.title}
            </ThemedText>
            {status.detail !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                {status.detail}
              </ThemedText>
            )}
          </View>
        </View>
      </FieldMessage>
    </View>
  );
}

// Confirmación del registro: primero lo guardado, luego la comparación y al final el envío.
function SavedReadingCard({
  title,
  reading,
  isSyncing,
  unit,
}: {
  title: string;
  reading: MeterReading;
  isSyncing: boolean;
  unit: string;
}) {
  const theme = useTheme();
  const hasComparison = reading.status === 'verified' && reading.difference !== null;
  const [, , differenceLine, verdict] = hasComparison
    ? describeReadingDifference({ ...reading, difference: reading.difference ?? 0 }, unit)
    : [];
  const isBelowPrevious = hasComparison && (reading.difference ?? 0) < 0;

  return (
    <FloatingCard>
      <View
        accessibilityLiveRegion="polite"
        className="border-[1px] rounded-md overflow-hidden bg-background border-border">
        <View className="flex-row items-center gap-2 px-4 py-4 bg-success-background">
          <SuccessAnimation size={32} />
          <ThemedText type="smallBold" className="flex-1 text-[16px] leading-[22px] text-success-foreground">
            {title}
          </ThemedText>
        </View>

        <View className="p-4 gap-4">
          <View className="gap-[2px]">
            <ThemedText type="caption" themeColor="infoForeground">
              LECTURA ACTUAL
            </ThemedText>
            {reading.value === null ? (
              <ThemedText className="text-[20px] leading-[28px] font-semibold text-text-secondary">
                {reading.condition === 'inaccessible' ? 'Sin lectura · inaccesible' : 'Sin lectura'}
              </ThemedText>
            ) : (
              <View className="flex-row items-baseline gap-2">
                <ThemedText type="display">{String(reading.value)}</ThemedText>
                {unit !== '' && (
                  <ThemedText className="text-[16px] font-semibold text-text-secondary">
                    {unit}
                  </ThemedText>
                )}
              </View>
            )}
          </View>

          {hasComparison ? (
            <>
              <View
                className="flex-row border-[1px] rounded-sm py-3 bg-background-element border-border">
                <StatCell
                  label="ANTERIOR"
                  value={withUnit(reading.previousReading, unit)}
                  detail={formatMeterReadingDate(reading.previousReadingDate)}
                />
                <View className="w-[0.5px] bg-border" />
                <StatCell
                  label="DIFERENCIA"
                  value={withUnit(formatReadingDifference(reading.difference ?? 0), unit)}
                  detail={differenceLine?.replace('Diferencia: ', '')}
                  tone={isBelowPrevious ? theme.warningForeground : undefined}
                />
              </View>
              <ThemedText
                type="small"
                themeColor={isBelowPrevious ? 'warningForeground' : 'textSecondary'}>
                {verdict}
              </ThemedText>
            </>
          ) : (
            <View className="flex-row items-start gap-2">
              <Info color={theme.textSecondary} size={18} />
              <ThemedText type="small" themeColor="textSecondary" className="flex-1">
                {reading.status === 'not-applicable'
                  ? 'Comparación con la lectura anterior: No aplica.'
                  : 'La comparación con la lectura anterior se hará al recuperar la conexión.'}
              </ThemedText>
            </View>
          )}

          <SendingStatus reading={reading} isSyncing={isSyncing} />
        </View>
      </View>
    </FloatingCard>
  );
}

const CONDITION_ICONS: Record<MeterCondition, typeof Gauge> = {
  normal: Gauge,
  inaccessible: Ban,
  damaged: Wrench,
};

function withUnit(amount: number | string, unit: string): string {
  return unit ? `${amount} ${unit}` : `${amount}`;
}

function ReadingItem({
  reading,
  isEditing,
  correctionBlocked,
  unit,
  onCorrect,
}: {
  reading: MeterReading;
  isEditing: boolean;
  correctionBlocked: boolean;
  unit: string;
  onCorrect: () => void;
}) {
  const theme = useTheme();
  // La lectura del mes en curso empieza abierta: es la que todavía se puede corregir.
  const [isOpen, setIsOpen] = useState(
    () => getReadingMonth(new Date(reading.recordedAt)) === getReadingMonth(new Date()),
  );
  const expanded = isOpen || isEditing;
  // El mapa del registro se carga la primera vez que se abre, no por cada registro de la lista.
  const [hasBeenExpanded, setHasBeenExpanded] = useState(expanded);
  if (expanded && !hasBeenExpanded) {
    setHasBeenExpanded(true);
  }
  const isSent = reading.syncStatus === 'sent' && reading.sentAt !== null;
  const ConditionIcon = CONDITION_ICONS[reading.condition];
  const conditionTone = {
    foreground:
      reading.condition === 'normal'
        ? theme.infoForeground
        : reading.condition === 'damaged'
          ? theme.errorForeground
          : theme.warningForeground,
  };
  const note =
    reading.inaccessibleReason !== null
      ? { label: 'MOTIVO', text: reading.inaccessibleReason }
      : reading.damageDescription !== null
        ? { label: 'DESCRIPCIÓN DEL DAÑO', text: reading.damageDescription }
        : null;
  const difference =
    reading.status === 'verified' && reading.difference !== null
      ? withUnit(formatReadingDifference(reading.difference), unit)
      : reading.status === 'not-applicable'
        ? 'No aplica'
        : 'Por verificar';
  const consumption =
    (reading.consumptionCheck === 'normal' || reading.consumptionCheck === 'elevated') &&
    reading.consumption !== null
      ? withUnit(reading.consumption, unit)
      : reading.consumptionCheck === 'review-required'
        ? 'En revisión'
        : 'No aplica';

  return (
    <View
      className={`border-[1px] rounded-md overflow-hidden bg-background ${isEditing ? 'border-accent' : 'border-border'} ${isEditing ? 'border-[2px]' : ''}`}>
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        disabled={isEditing}
        accessibilityRole="button"
        accessibilityLabel={`Registro ${CONDITION_TITLES[reading.condition]}, ${isSent ? 'enviado' : 'pendiente'}`}
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-4 p-4 border-b-[0.5px] border-b-border">
        <View className="flex-1">
          <View className="flex-row items-center gap-[6px]">
            <ConditionIcon color={conditionTone.foreground} size={18} />
            <ThemedText type="smallBold">{CONDITION_TITLES[reading.condition]}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {`Registrado el ${formatReadingTimestamp(reading.recordedAt)}`}
          </ThemedText>
        </View>
        <SyncStatusPill status={isSent ? 'sent' : 'pending'} />
        <ExpandChevron expanded={expanded} color={theme.textSecondary} />
      </Pressable>

      <View className="p-4 gap-4">
        <View className="gap-[2px]">
          <ThemedText type="caption" themeColor="infoForeground">
            LECTURA REGISTRADA
          </ThemedText>
          {reading.value === null ? (
            <ThemedText className="text-[20px] leading-[28px] font-semibold text-text-secondary">
              {reading.condition === 'inaccessible' ? 'Sin lectura · inaccesible' : 'Sin lectura'}
            </ThemedText>
          ) : (
            <View className="flex-row items-baseline gap-2">
              <ThemedText type="display">{String(reading.value)}</ThemedText>
              {unit !== '' && (
                <ThemedText className="text-[16px] font-semibold text-text-secondary">
                  {unit}
                </ThemedText>
              )}
            </View>
          )}
        </View>

        {reading.consumptionCheck === 'elevated' && (
          <Notice tone="warning" title="Consumo elevado">
            {`Supera el triple del promedio mensual (${withUnit(reading.monthlyAverageConsumption ?? 0, unit)}). Revisión del medidor confirmada.`}
          </Notice>
        )}
        {reading.consumptionCheck === 'review-required' && (
          <Notice tone="warning" title="Marcado para revisión">
            La lectura es menor que la anterior.
          </Notice>
        )}

      </View>

      <ExpandableContent expanded={expanded}>
      <View className="px-4 pb-4 gap-4">
        <View
          className="flex-row border-[1px] rounded-sm py-3 bg-background-element border-border">
          <StatCell
            label="ANTERIOR"
            value={withUnit(reading.previousReading, unit)}
            detail={formatMeterReadingDate(reading.previousReadingDate)}
          />
          <View className="w-[0.5px] bg-border" />
          <StatCell
            label="DIFERENCIA"
            value={difference}
            muted={reading.status !== 'verified'}
          />
          <View className="w-[0.5px] bg-border" />
          <StatCell
            label="CONSUMO"
            value={consumption}
            muted={consumption === 'No aplica'}
            tone={
              reading.consumptionCheck === 'elevated' || reading.consumptionCheck === 'review-required'
                ? theme.warningForeground
                : undefined
            }
          />
        </View>

        {reading.status === 'pending-verification' && (
          <View className="flex-row items-center gap-[6px]">
            <Clock color={theme.textSecondary} size={14} />
            <ThemedText type="small" themeColor="textSecondary" className="flex-1">
              Se comparará con la lectura anterior al recuperar la conexión.
            </ThemedText>
          </View>
        )}

        {note && (
          <View className="border-l-[3px] pl-4 gap-[2px]" style={{ borderLeftColor: conditionTone.foreground }}>
            <ThemedText type="caption" themeColor="infoForeground">
              {note.label}
            </ThemedText>
            <ThemedText type="small">{note.text}</ThemedText>
          </View>
        )}

        {reading.photoUri && (
          <View className="gap-2">
            <View className="flex-row items-center gap-[6px]">
              <ImageIcon color={theme.textSecondary} size={14} />
              <ThemedText type="caption" themeColor="infoForeground">
                EVIDENCIA FOTOGRÁFICA
              </ThemedText>
            </View>
            <Image
              accessibilityLabel="Foto del medidor asociada al registro"
              contentFit="cover"
              source={{ uri: reading.photoUri }}
              className="w-full rounded-sm aspect-[4/3]"
            />
          </View>
        )}

        {reading.location && (
          <View className="gap-2">
            <View className="flex-row items-center gap-[6px]">
              <MapPin color={theme.textSecondary} size={14} />
              <ThemedText type="caption" themeColor="infoForeground">
                UBICACIÓN DEL MEDIDOR
              </ThemedText>
            </View>
            {hasBeenExpanded && <LocationMapPreview location={reading.location} />}
            <LocationSummary location={reading.location} />
          </View>
        )}
      </View>

      {(reading.updatedAt || isSent || (reading.syncStatus === 'pending' && !isEditing)) && (
        <View className="border-t-[0.5px] p-4 gap-2 border-t-border">
          {reading.updatedAt && (
            <View className="flex-row items-center gap-[6px]">
              <History color={theme.textSecondary} size={14} />
              <ThemedText type="small" themeColor="textSecondary">
                {`Modificado el ${formatReadingTimestamp(reading.updatedAt)}`}
              </ThemedText>
            </View>
          )}
          {isSent && reading.sentAt && (
            <View className="flex-row items-center gap-[6px]">
              <CircleCheck color={theme.successForeground} size={14} />
              <ThemedText type="small" themeColor="successForeground">
                {`Enviado el ${formatReadingTimestamp(reading.sentAt)}`}
              </ThemedText>
            </View>
          )}
          {reading.syncStatus === 'pending' && !isEditing && (
            <AnimatedButton
              label="Corregir"
              accessibilityLabel="Corregir registro"
              accessibilityHint={
                correctionBlocked ? 'No disponible mientras se envían registros.' : undefined
              }
              icon={Pencil}
              variant="secondary"
              disabled={correctionBlocked}
              onPress={onCorrect}
            />
          )}
        </View>
      )}
      </ExpandableContent>
    </View>
  );
}

function StatCell({
  label,
  value,
  detail,
  muted = false,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  muted?: boolean;
  tone?: string;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 px-3 gap-[2px]">
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText
        type={muted ? 'smallBold' : 'data'}
        className="leading-[22px]" style={{ color: tone ?? (muted ? theme.textSecondary : theme.text) }}>
        {value}
      </ThemedText>
      {detail !== undefined && (
        <ThemedText className="text-[12px] leading-[16px] font-medium text-text-secondary">{detail}</ThemedText>
      )}
    </View>
  );
}

// Ficha del medidor consultado: identificación arriba, ubicación y datos de lectura separados.
function MeterSummary({ meter }: { meter: Meter }) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const unit = meter.monthlyAverageConsumptionUnit;

  return (
    <View
      className="border-[1px] rounded-md overflow-hidden border-border bg-background">
      <Pressable
        onPress={() => setIsOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`Ficha del medidor ${meter.meterCode}, ${meter.status}`}
        accessibilityState={{ expanded: isOpen }}
        className="flex-row items-center gap-4 px-4 py-4 bg-brand">
        <View className="flex-1">
          <ThemedText type="caption" className="text-on-brand-secondary">
            FICHA DEL MEDIDOR
          </ThemedText>
          <ThemedText type="data" className="text-[22px] leading-[28px] tracking-[1px] text-on-brand">
            {meter.meterCode}
          </ThemedText>
        </View>
        <View className="flex-row items-center gap-1 rounded-full px-[10px] py-1 border-on-brand-secondary" style={{ borderWidth: 1 }}>
          <ThemedText className="text-[12px] leading-[16px] font-bold text-on-brand">
            {meter.status}
          </ThemedText>
        </View>
        <ExpandChevron expanded={isOpen} color={theme.onBrand} />
      </Pressable>

      <View className="p-4 gap-4">
        <View className="flex-row items-start gap-2">
          <MapPin color={theme.infoForeground} size={18} />
          <View className="flex-1">
            <ThemedText type="smallBold">{meter.address}</ThemedText>
          </View>
        </View>
      </View>

      <ExpandableContent expanded={isOpen}>
      <View className="px-4 pb-4 gap-4">
        <ThemedText type="small" themeColor="textSecondary">
          {`Sector ${meter.sector}`}
        </ThemedText>
        <View className="flex-row items-start gap-2">
          <Hash color={theme.infoForeground} size={18} />
          <View className="flex-1">
            <ThemedText type="small" themeColor="textSecondary">
              Número de cuenta
            </ThemedText>
            <ThemedText type="smallBold" className="tabular-nums">
              {meter.accountNumber}
            </ThemedText>
          </View>
        </View>

        <View
          className="flex-row border-[1px] rounded-sm py-3 bg-background-element border-border">
          <StatCell
            label="ÚLTIMA LECTURA"
            value={withUnit(meter.lastReading, unit)}
            detail={formatMeterReadingDate(meter.lastReadingDate)}
          />
          <View className="w-[0.5px] bg-border" />
          <StatCell
            label="PROMEDIO MENSUAL"
            value={withUnit(meter.monthlyAverageConsumption, unit)}
            detail="Consumo"
          />
        </View>
      </View>
      </ExpandableContent>
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
