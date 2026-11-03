import { Keyframe } from 'react-native-reanimated';

// Marca de éxito: gira y crece un poco de más antes de asentarse.
export const SuccessKeyframe = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.2 }, { rotate: '-35deg' }] },
  60: { opacity: 1, transform: [{ scale: 1.25 }, { rotate: '6deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
}).duration(420);
