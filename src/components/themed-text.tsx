import { Platform, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';

type TextVariant = {
  size: string;
  leading?: string;
  weight?: string;
  extra?: string;
  mono?: boolean;
  noFontPadding?: boolean;
};

const VARIANTS = {
  default: { size: 'text-[16px]', leading: 'leading-[24px]', weight: 'font-medium' },
  title: { size: 'text-[48px]', leading: 'leading-[52px]', weight: 'font-semibold' },
  subtitle: { size: 'text-[32px]', leading: 'leading-[44px]', weight: 'font-semibold' },
  small: { size: 'text-[14px]', leading: 'leading-[20px]', weight: 'font-medium' },
  smallBold: { size: 'text-[14px]', leading: 'leading-[20px]', weight: 'font-bold' },
  link: { size: 'text-[14px]', leading: 'leading-[30px]' },
  linkPrimary: { size: 'text-[14px]', leading: 'leading-[30px]', extra: 'text-[#3c87f7]' },
  code: {
    size: 'text-[12px]',
    weight: Platform.OS === 'android' ? 'font-bold' : 'font-medium',
    mono: true,
  },
  // Título de pantalla o sección.
  heading: {
    size: 'text-[24px]',
    leading: 'leading-[30px]',
    weight: 'font-bold',
    noFontPadding: true,
  },
  // Rótulo de sección o de dato: mayúsculas con espaciado.
  caption: {
    size: 'text-[12px]',
    leading: 'leading-[16px]',
    weight: 'font-bold',
    extra: 'tracking-[0.8px] uppercase',
  },
  // Cifras: lecturas, códigos y conteos en monoespaciado con ancho fijo.
  data: {
    size: 'text-[16px]',
    leading: 'leading-[22px]',
    weight: 'font-bold',
    extra: 'tabular-nums',
    mono: true,
  },
  display: {
    size: 'text-[34px]',
    leading: 'leading-[40px]',
    weight: 'font-bold',
    extra: 'tabular-nums',
    mono: true,
    noFontPadding: true,
  },
} as const satisfies Record<string, TextVariant>;

// Los colores se listan completos: Tailwind solo genera las clases que encuentra escritas.
const COLOR_CLASSES: Record<ThemeColor, string> = {
  text: 'text-text',
  background: 'text-background',
  backgroundElement: 'text-background-element',
  backgroundSelected: 'text-background-selected',
  textSecondary: 'text-text-secondary',
  border: 'text-border',
  inputBorder: 'text-input-border',
  accent: 'text-accent',
  onAccent: 'text-on-accent',
  infoBackground: 'text-info-background',
  infoForeground: 'text-info-foreground',
  successBackground: 'text-success-background',
  successForeground: 'text-success-foreground',
  warningBackground: 'text-warning-background',
  warningForeground: 'text-warning-foreground',
  errorBackground: 'text-error-background',
  errorForeground: 'text-error-foreground',
  brand: 'text-brand',
  onBrand: 'text-on-brand',
  onBrandSecondary: 'text-on-brand-secondary',
};

const COLOR_CLASS_PATTERN = new RegExp(
  `(^|\\s)(${Object.values(COLOR_CLASSES).join('|')}|text-surface-[a-z-]+)(\\s|$)`,
);

export type ThemedTextProps = TextProps & {
  type?: keyof typeof VARIANTS;
  themeColor?: ThemeColor;
};

// Dos clases sobre la misma propiedad no tienen un orden garantizado: lo que indique `className`
// reemplaza a la variante en lugar de competir con ella.
function resolveClassName(
  variant: TextVariant,
  themeColor: ThemeColor | undefined,
  className: string,
): string {
  const usesColor = variant.extra?.includes('text-[#') || COLOR_CLASS_PATTERN.test(className);

  return [
    /(^|\s)text-\[\d/.test(className) ? '' : variant.size,
    /(^|\s)leading-\[/.test(className) ? '' : variant.leading,
    /(^|\s)font-(medium|semibold|bold)/.test(className) ? '' : variant.weight,
    variant.extra,
    usesColor ? '' : COLOR_CLASSES[themeColor ?? 'text'],
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export function ThemedText({
  className,
  style,
  type = 'default',
  themeColor,
  ...rest
}: ThemedTextProps) {
  const variant: TextVariant = VARIANTS[type];
  // La fuente depende de la plataforma y `includeFontPadding` no tiene clase equivalente.
  const inlineStyle = {
    ...(variant.mono ? { fontFamily: Fonts.mono } : null),
    ...(variant.noFontPadding ? { includeFontPadding: false } : null),
  };

  return (
    <Text
      className={resolveClassName(variant, themeColor, className ?? '')}
      style={[inlineStyle, style]}
      {...rest}
    />
  );
}
