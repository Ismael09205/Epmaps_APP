// Versión para pruebas: conserva la estructura de los componentes y omite el movimiento, que
// necesita el módulo nativo.
const { ScrollView, Text, View } = jest.requireActual('react-native');

const layoutAnimation = new Proxy(
  {},
  { get: () => () => layoutAnimation },
);

class Keyframe {
  duration() {
    return this;
  }
}

module.exports = {
  __esModule: true,
  Keyframe,
  LinearTransition: layoutAnimation,
  default: { ScrollView, Text, View },
  Easing: { in: () => undefined, out: () => undefined, inOut: () => undefined, quad: undefined, cubic: undefined },
  FadeIn: layoutAnimation,
  FadeInDown: layoutAnimation,
  FadeOut: layoutAnimation,
  ZoomIn: layoutAnimation,
  cancelAnimation: jest.fn(),
  interpolate: () => 1,
  interpolateColor: () => '#000000',
  useAnimatedRef: () => ({ current: null }),
  useAnimatedStyle: () => ({}),
  useScrollOffset: () => ({ get: () => 0 }),
  useReducedMotion: jest.fn(() => false),
  useSharedValue: (value) => ({ get: () => value, set: jest.fn() }),
  withDelay: (_delay, value) => value,
  withRepeat: (value) => value,
  withSequence: (value) => value,
  withSpring: (value) => value,
  withTiming: (value) => value,
};
