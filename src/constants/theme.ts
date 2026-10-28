import '@/global.css';

import { Platform } from 'react-native';

// Paleta EPMAPS: blanco dominante, #243376 para texto y estructura, #1E72BA solo para la acción
// principal. Los tonos de aviso (éxito, advertencia, error) se agregan porque el técnico debe
// distinguir el tipo de mensaje de un vistazo en campo; siempre van acompañados de un icono.
// `brand` es el azul institucional fijo en ambos modos para los bloques de identidad.
export const Colors = {
  light: {
    text: '#243376',
    background: '#FFFFFF',
    backgroundElement: '#F5F7FB',
    backgroundSelected: '#E8EEF7',
    textSecondary: '#5A6595',
    border: '#DCE0EC',
    inputBorder: '#7A84AE',
    accent: '#1E72BA',
    onAccent: '#FFFFFF',
    infoBackground: '#EAF2FA',
    infoForeground: '#1E72BA',
    successBackground: '#E8F4EE',
    successForeground: '#1F7A4D',
    warningBackground: '#FFF5E1',
    warningForeground: '#8A5A00',
    errorBackground: '#FDECEA',
    errorForeground: '#B3261E',
    brand: '#243376',
    onBrand: '#FFFFFF',
    onBrandSecondary: '#C9D3EE',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0E1430',
    backgroundElement: '#18214A',
    backgroundSelected: '#222D5E',
    textSecondary: '#B9C1E0',
    border: '#2C3768',
    inputBorder: '#8A94C2',
    accent: '#5FA3E0',
    onAccent: '#0E1430',
    infoBackground: '#14254A',
    infoForeground: '#8FC1EE',
    successBackground: '#123326',
    successForeground: '#7FD1A6',
    warningBackground: '#3A2C10',
    warningForeground: '#F2C46B',
    errorBackground: '#3B1517',
    errorForeground: '#FFB4AB',
    brand: '#243376',
    onBrand: '#FFFFFF',
    onBrandSecondary: '#C9D3EE',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Escala de radios por rol: sm para controles, md para paneles, lg para bloques de marca.
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// Margen horizontal de pantalla, igual en todas las vistas.
export const ScreenPadding = 20;

// Límite de escalado de texto en botones y etiquetas de interfaz; el texto de lectura escala libre.
export const ChromeFontScale = 1.4;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
