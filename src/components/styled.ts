import { Image as BaseImage } from 'expo-image';
import { MaskedTextInput as BaseMaskedTextInput } from 'react-native-mask-text';
import { SafeAreaView as BaseSafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

// Componentes de otras librerías con soporte de `className`. Cada uno se envuelve una sola vez.
// CameraView queda fuera: se controla por referencia para tomar la foto.
export const Image = withUniwind(BaseImage);
export const MaskedTextInput = withUniwind(BaseMaskedTextInput);
export const SafeAreaView = withUniwind(BaseSafeAreaView);
