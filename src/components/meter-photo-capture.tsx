import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MeterPhotoCaptureProps = {
  photoUri: string | null;
  required: boolean;
  onCapture: (uri: string) => Promise<void>;
};

export function MeterPhotoCapture({ photoUri, required, onCapture }: MeterPhotoCaptureProps) {
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const permissionDenied = permission !== null && !permission.granted && !permission.canAskAgain;

  const handleOpenCamera = async () => {
    setCaptureFailed(false);
    const current = permission?.granted ? permission : await requestPermission();
    if (current.granted) {
      setIsCameraOpen(true);
    }
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }

    setIsCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      await onCapture(picture.uri);
      setIsCameraOpen(false);
    } catch (error: unknown) {
      console.error('No se pudo tomar la foto del medidor.', error);
      setCaptureFailed(true);
      setIsCameraOpen(false);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">
        {required ? 'Foto del medidor (obligatoria)' : 'Foto del medidor (opcional)'}
      </ThemedText>
      {photoUri && (
        <Image
          accessibilityLabel="Foto tomada del medidor"
          contentFit="cover"
          source={{ uri: photoUri }}
          style={styles.preview}
        />
      )}
      {permission !== null && !permission.granted && (
        <Notice tone={permissionDenied ? 'warning' : 'info'}>
          {`La cámara se usa para tomar la foto del medidor como evidencia de la lectura. ${
            required
              ? 'En este registro la foto es obligatoria.'
              : 'La foto es opcional: puede registrar sin ella.'
          }${permissionDenied ? ' Para tomarla, active el permiso en los ajustes del teléfono.' : ''}`}
        </Notice>
      )}
      {captureFailed && <Notice tone="error">No se pudo tomar la foto. Inténtelo de nuevo.</Notice>}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: permissionDenied }}
        disabled={permissionDenied}
        onPress={() => void handleOpenCamera()}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.accent },
          (pressed || permissionDenied) && styles.pressed,
        ]}>
        <Camera color={theme.infoForeground} size={20} />
        <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.infoForeground }]}>
          {photoUri ? 'Tomar otra foto' : 'Tomar foto del medidor'}
        </ThemedText>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsCameraOpen(false)}
        visible={isCameraOpen}>
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} facing="back" style={styles.camera} />
          <SafeAreaView edges={['bottom']} style={styles.cameraActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsCameraOpen(false)}
              style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}>
              <ThemedText style={styles.cameraButtonText}>Cancelar</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capturar foto del medidor"
              accessibilityState={{ busy: isCapturing }}
              disabled={isCapturing}
              onPress={() => void handleTakePicture()}
              style={({ pressed }) => [
                styles.cameraButton,
                styles.captureButton,
                pressed && styles.pressed,
              ]}>
              {isCapturing ? (
                <ActivityIndicator color="#243376" />
              ) : (
                <ThemedText style={styles.captureButtonText}>Capturar</ThemedText>
              )}
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.two,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonLabel: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  cameraButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonText: {
    color: '#ffffff',
  },
  captureButton: {
    backgroundColor: '#ffffff',
  },
  captureButtonText: {
    color: '#243376',
    fontWeight: '600',
  },
});
