import { View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ className, style, type, ...rest }: ThemedViewProps) {
  const theme = useTheme();

  return (
    <View
      className={`${type ? '' : 'bg-background'} ${className ?? ''}`}
      style={[type ? { backgroundColor: theme[type] } : null, style]}
      {...rest}
    />
  );
}
