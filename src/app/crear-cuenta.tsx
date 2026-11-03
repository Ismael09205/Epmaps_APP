import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'expo-router';
import {
  Hash,
  LockKeyhole,
  Mail,
  User,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { useSession, type SignUpResult } from '@/auth/session-context';
import { AnimatedButton } from '@/components/motion/animated-button';
import { AnimatedInputFrame, resolveInputState } from '@/components/motion/animated-input-frame';
import { useCircularNavigation } from '@/components/motion/circular-transition';
import { FieldMessage } from '@/components/motion/field-message';
import { Notice } from '@/components/notice';
import { PasswordRequirements } from '@/components/password-requirements';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Colors, Spacing } from '@/constants/theme';
import {
  EMPLOYEE_CODE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  sanitizeNameInput,
  validateSignUp,
  type SignUpForm,
} from '@/domain/auth';

const ERROR_MESSAGES: Record<Exclude<SignUpResult, 'unverified'>, string> = {
  'email-in-use': 'Este correo ya tiene una cuenta. Inicie sesión con su clave.',
  'weak-password': 'Firebase rechazó la clave por insegura. Elija una clave diferente.',
  invalid: 'El correo electrónico no es válido',
  network: 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.',
  'too-many-requests': 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
  unavailable: 'No se pudo crear la cuenta. Intente de nuevo más tarde.',
};

type SignUpField = keyof SignUpForm;

const ALL_FIELDS_TOUCHED: Record<SignUpField, boolean> = {
  name: true,
  surname: true,
  employeeCode: true,
  email: true,
  password: true,
  passwordConfirmation: true,
};

// Los campos y la marca son blancos en ambos modos; se usa la paleta clara para que el texto y
// los iconos conserven el contraste sobre esa superficie.
const SURFACE = Colors.light;

export default function CreateAccountScreen() {
  const { signUp } = useSession();
  const router = useRouter();
  const { navigateWithReveal } = useCircularNavigation();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [touchedFields, setTouchedFields] = useState<Partial<Record<SignUpField, boolean>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<SignUpField | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const fieldPositions = useRef<Partial<Record<SignUpField, number>>>({});
  const surnameRef = useRef<TextInput>(null);
  const employeeCodeRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmationRef = useRef<TextInput>(null);

  // Lleva el campo activo a la parte superior para que el teclado no lo tape, ni tampoco el cuadro
  // de requisitos de la clave. Se repite al abrirse el teclado, porque reduce el área visible.
  useEffect(() => {
    if (!focusedField) {
      return;
    }

    const showFocusedField = () => {
      const fieldY = fieldPositions.current[focusedField];
      if (fieldY !== undefined) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, formY.current + fieldY - Spacing.two),
          animated: true,
        });
      }
    };

    showFocusedField();
    const subscription = Keyboard.addListener('keyboardDidShow', showFocusedField);
    return () => subscription.remove();
  }, [focusedField]);

  // Los errores se calculan en cada escritura y no se guardan: un mensaje vigente permanece en
  // pantalla sin parpadear, y desaparece solo cuando el dato queda corregido.
  const validation = validateSignUp({
    name,
    surname,
    employeeCode,
    email,
    password,
    passwordConfirmation,
  });

  const isFieldValid = (field: SignUpField, value: string) =>
    Boolean(touchedFields[field]) &&
    value.trim() !== '' &&
    (validation.status === 'valid' || validation.errors[field] === undefined);

  const errorFor = (field: SignUpField) =>
    touchedFields[field] && validation.status === 'invalid' ? validation.errors[field] : undefined;

  const markTouched = (field: SignUpField) => {
    setTouchedFields((current) => (current[field] ? current : { ...current, [field]: true }));
  };

  const handleFieldBlur = (field: SignUpField) => {
    setFocusedField((current) => (current === field ? null : current));
    markTouched(field);
  };

  const recordFieldPosition = (field: SignUpField, y: number) => {
    fieldPositions.current[field] = y;
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    if (validation.status === 'invalid') {
      setTouchedFields(ALL_FIELDS_TOUCHED);
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(validation.data);
    setIsSubmitting(false);

    if (result !== 'unverified') {
      setErrorMessage(ERROR_MESSAGES[result]);
    }
  };

  const updateField =
    (field: SignUpField, setter: (value: string) => void) => (value: string) => {
      setter(value);
      setErrorMessage(null);
      markTouched(field);
    };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1 px-5" edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior="padding">
          <ScrollView
            ref={scrollRef}
            contentContainerClassName="grow gap-6 py-6"
            keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center gap-4">
              <View className="w-[56px] h-[56px] rounded-full items-center justify-center bg-surface-info-background">
                <UserPlus color={SURFACE.accent} size={28} strokeWidth={2} />
              </View>
              <View className="flex-1 gap-[2px]">
                <ThemedText type="caption" themeColor="infoForeground">
                  EPMAPS · Quito
                </ThemedText>
                <ThemedText type="heading">Crear cuenta</ThemedText>
              </View>
            </View>
            <View className="w-[48px] h-[3px] rounded-full bg-accent" />

            <View
              className="gap-4"
              onLayout={(event) => {
                formY.current = event.nativeEvent.layout.y;
              }}>
              <FormField
                label="Nombre"
                icon={User}
                value={name}
                error={errorFor('name')}
                name="name"
                isValid={isFieldValid('name', name)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                maxLength={NAME_MAX_LENGTH}
                onChangeText={(value) => updateField('name', setName)(sanitizeNameInput(value))}
                onSubmitEditing={() => surnameRef.current?.focus()}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
              />
              <FormField
                label="Apellido"
                icon={User}
                inputRef={surnameRef}
                value={surname}
                error={errorFor('surname')}
                name="surname"
                isValid={isFieldValid('surname', surname)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                maxLength={NAME_MAX_LENGTH}
                onChangeText={(value) =>
                  updateField('surname', setSurname)(sanitizeNameInput(value))
                }
                onSubmitEditing={() => employeeCodeRef.current?.focus()}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
              />
              <FormField
                label="Código de empleado"
                icon={Hash}
                inputRef={employeeCodeRef}
                value={employeeCode}
                error={errorFor('employeeCode')}
                name="employeeCode"
                isValid={isFieldValid('employeeCode', employeeCode)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                maxLength={EMPLOYEE_CODE_MAX_LENGTH}
                onChangeText={updateField('employeeCode', setEmployeeCode)}
                onSubmitEditing={() => emailRef.current?.focus()}
                autoCapitalize="characters"
                autoComplete="off"
              />
              <FormField
                label="Correo electrónico"
                icon={Mail}
                inputRef={emailRef}
                value={email}
                error={errorFor('email')}
                name="email"
                isValid={isFieldValid('email', email)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                onChangeText={updateField('email', setEmail)}
                onSubmitEditing={() => passwordRef.current?.focus()}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
              />
              <FormField
                label="Clave"
                icon={LockKeyhole}
                inputRef={passwordRef}
                value={password}
                footer={
                  <PasswordRequirements password={password} visible={focusedField === 'password'} />
                }
                error={errorFor('password')}
                hideErrorText={focusedField === 'password'}
                name="password"
                isValid={isFieldValid('password', password)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                onChangeText={updateField('password', setPassword)}
                onSubmitEditing={() => passwordConfirmationRef.current?.focus()}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <FormField
                label="Confirmar clave"
                icon={LockKeyhole}
                inputRef={passwordConfirmationRef}
                value={passwordConfirmation}
                error={errorFor('passwordConfirmation')}
                name="passwordConfirmation"
                isValid={isFieldValid('passwordConfirmation', passwordConfirmation)}
                onFieldFocus={setFocusedField}
                onFieldBlur={handleFieldBlur}
                onFieldLayout={recordFieldPosition}
                onChangeText={updateField('passwordConfirmation', setPasswordConfirmation)}
                onSubmitEditing={handleSubmit}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
              />

              {errorMessage !== null && <Notice tone="error">{errorMessage}</Notice>}
              <AnimatedButton
                label="Crear cuenta"
                busyLabel="Creando cuenta…"
                icon={UserPlus}
                status={isSubmitting ? 'busy' : 'idle'}
                onPress={handleSubmit}
                className="mt-2"
              />

              <Pressable
                onPress={(event) => navigateWithReveal(event, () => router.back())}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Ya tengo una cuenta"
                className="min-h-[48px] items-center justify-center active:scale-[0.98]">
                <ThemedText
                  type="smallBold"
                  maxFontSizeMultiplier={ChromeFontScale}
                  themeColor="infoForeground">
                  Ya tengo una cuenta
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FormField({
  name,
  label,
  icon: Icon,
  inputRef,
  error,
  footer,
  isValid,
  hideErrorText = false,
  onFieldBlur,
  onFieldFocus,
  onFieldLayout,
  ...inputProps
}: {
  name: SignUpField;
  label: string;
  icon: LucideIcon;
  error?: string;
  footer?: ReactNode;
  isValid: boolean;
  hideErrorText?: boolean;
  onFieldBlur: (field: SignUpField) => void;
  onFieldFocus: (field: SignUpField) => void;
  onFieldLayout: (field: SignUpField, y: number) => void;
  inputRef?: RefObject<TextInput | null>;
} & ComponentProps<typeof TextInput>) {
  const [isFocused, setIsFocused] = useState(false);
  const inputState = resolveInputState({ isFocused, isInvalid: Boolean(error), isValid });

  return (
    <View onLayout={(event) => onFieldLayout(name, event.nativeEvent.layout.y)}>
      <View className="gap-2">
        <ThemedText type="smallBold">{label}</ThemedText>
        <AnimatedInputFrame state={inputState} palette={SURFACE} className="min-h-[52px] flex-row items-center gap-2 rounded-sm border-[1px] px-4">
          <Icon color={SURFACE.accent} size={20} />
          <TextInput
            ref={inputRef}
            className="flex-1 min-h-[48px] py-2 text-[16px] text-surface-text"
            selectionColor={SURFACE.accent}
            cursorColor={SURFACE.accent}
            onFocus={() => {
              setIsFocused(true);
              onFieldFocus(name);
            }}
            onBlur={() => {
              setIsFocused(false);
              onFieldBlur(name);
            }}
            submitBehavior="submit"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel={label}
            {...inputProps}
          />
        </AnimatedInputFrame>
        {error && !hideErrorText && (
          <FieldMessage>
            <ThemedText type="small" themeColor="errorForeground" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          </FieldMessage>
        )}
      </View>
      {footer}
    </View>
  );
}

