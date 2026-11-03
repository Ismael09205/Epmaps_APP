import { useEffect } from 'react';
import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ExpandableContent } from '@/components/motion/expandable';
import { ThemedText } from '@/components/themed-text';
import { getPasswordRequirements } from '@/domain/auth';
import { useTheme } from '@/hooks/use-theme';

const TRANSITION_MS = 200;
const ICON_SIZE = 13;
const ICON_STROKE = 3;

export function PasswordRequirements({ password, visible }: { password: string; visible: boolean }) {

  return (
    <ExpandableContent expanded={visible} testID="password-requirements">
      <View className="pt-2">
        <View
          className="gap-2 border-[1px] rounded-sm p-4 bg-background-element border-border">
          <ThemedText type="smallBold">Su clave debe tener:</ThemedText>
          {getPasswordRequirements(password).map(({ label, met }) => (
            <RequirementRow key={label} label={label} met={met} />
          ))}
        </View>
      </View>
    </ExpandableContent>
  );
}

function RequirementRow({ label, met }: { label: string; met: boolean }) {
  const theme = useTheme();
  const pendingColor = theme.errorForeground;
  const metColor = theme.successForeground;
  const progress = useSharedValue(met ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(met ? 1 : 0, { duration: TRANSITION_MS }));
  }, [met, progress]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [pendingColor, metColor]),
  }));
  const pendingBadgeStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [1, 0.5]) }],
  }));
  const metBadgeStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.5, 1]) }],
  }));

  // El estado también se anuncia en texto: el color y el icono no llegan al lector de pantalla.
  return (
    <View
      accessible
      accessibilityLabel={`${met ? 'Cumplido' : 'Pendiente'}: ${label}`}
      className="flex-row items-center gap-2">
      <View className="w-[20px] h-[20px]">
        <Animated.View
          className="absolute inset-0 rounded-full items-center justify-center bg-error-background" style={pendingBadgeStyle}>
          <X color={pendingColor} size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </Animated.View>
        <Animated.View
          className="absolute inset-0 rounded-full items-center justify-center bg-success-background" style={metBadgeStyle}>
          <Check color={metColor} size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </Animated.View>
      </View>
      <Animated.Text className="flex-1 text-[14px] leading-[20px] font-medium" style={labelStyle}>{label}</Animated.Text>
    </View>
  );
}


