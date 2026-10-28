import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

// Mensaje de estado: el color y el icono indican el tipo; el texto siempre usa el color principal
// para conservar el contraste sobre el fondo tenue.
export function Notice({
  tone,
  title,
  children,
  style,
}: {
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette =
    tone === 'loading' || tone === 'info'
      ? { background: theme.infoBackground, foreground: theme.infoForeground }
      : tone === 'success'
        ? { background: theme.successBackground, foreground: theme.successForeground }
        : tone === 'warning'
          ? { background: theme.warningBackground, foreground: theme.warningForeground }
          : { background: theme.errorBackground, foreground: theme.errorForeground };

  const Icon = tone === 'loading' ? null : ICONS[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        { backgroundColor: palette.background, borderLeftColor: palette.foreground },
        style,
      ]}>
      <View style={styles.icon}>
        {Icon ? (
          <Icon color={palette.foreground} size={20} strokeWidth={2.25} />
        ) : (
          <ActivityIndicator color={palette.foreground} size="small" />
        )}
      </View>
      <View style={styles.body}>
        {title !== undefined && <ThemedText type="smallBold">{title}</ThemedText>}
        {typeof children === 'string' ? <ThemedText type="small">{children}</ThemedText> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  icon: {
    width: 20,
    minHeight: 20,
    alignItems: 'center',
    paddingTop: 1,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
});
