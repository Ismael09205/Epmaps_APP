import { Hand, Satellite } from 'lucide-react-native';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatReadingTimestamp } from '@/domain/reading';
import {
  assessLocationQuality,
  describeLocationMargin,
  LOCATION_QUALITY_LABELS,
  type LocationQuality,
  type ReadingLocation,
} from '@/domain/reading-location';
import { useTheme } from '@/hooks/use-theme';

const QUALITY_LEVELS: Record<LocationQuality, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
const SEGMENTS = [1, 2, 3];

// Cómo y cuándo se obtuvo la ubicación del medidor y, si es del GPS, qué tan precisa es.
export function LocationSummary({ location }: { location: ReadingLocation }) {
  const theme = useTheme();
  const quality = assessLocationQuality(location);
  const isGps = location.source === 'gps';
  const Icon = isGps ? Satellite : Hand;
  const qualityColor =
    quality === 'high'
      ? theme.successForeground
      : quality === 'medium'
        ? theme.infoForeground
        : theme.warningForeground;
  const title = isGps ? 'Ubicación por GPS' : 'Ubicación marcada en el mapa';
  const precision =
    quality === null
      ? null
      : `${LOCATION_QUALITY_LABELS[quality]}${
          location.accuracy === null ? '' : ` · ±${Math.round(location.accuracy)} m`
        }`;

  return (
    <View
      accessible
      accessibilityLabel={[
        title,
        `registrada el ${formatReadingTimestamp(location.capturedAt)}`,
        precision && `precisión ${precision}`,
        describeLocationMargin(location),
      ]
        .filter(Boolean)
        .join('. ')}
      className="border-[1px] rounded-sm p-4 gap-3 bg-background-element border-border">
      <View className="flex-row items-center gap-3">
        <View className="w-[36px] h-[36px] rounded-full items-center justify-center bg-background-selected">
          <Icon color={theme.text} size={18} />
        </View>
        <View className="flex-1">
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Registrada el ${formatReadingTimestamp(location.capturedAt)}`}
          </ThemedText>
        </View>
      </View>

      {quality !== null && (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <ThemedText type="caption" themeColor="textSecondary">
              PRECISIÓN DEL GPS
            </ThemedText>
            <ThemedText type="smallBold" className="tabular-nums" style={{ color: qualityColor }}>
              {precision}
            </ThemedText>
          </View>
          <View className="flex-row gap-1">
            {SEGMENTS.map((segment) => (
              <View
                key={segment}
                className="flex-1 h-[6px] rounded-full"
                style={{
                  backgroundColor:
                    segment <= QUALITY_LEVELS[quality] ? qualityColor : theme.border,
                }}
              />
            ))}
          </View>
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {describeLocationMargin(location)}
      </ThemedText>
    </View>
  );
}
