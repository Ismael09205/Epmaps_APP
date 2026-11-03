import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';

import { AnimatedButton } from '@/components/motion/animated-button';
import { Notice } from '@/components/notice';
import { Image, SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';

type MeterPhotoCaptureProps = {
  photoUri: string | null;
  required: boolean;
  onCapture: (uri: string) => Promise<void>;
};

export function MeterPhotoCapture({ photoUri, required, onCapture }: MeterPhotoCaptureProps) {
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
    <View className="gap-2">
      <ThemedText type="smallBold">
        {required ? 'Foto del medidor (obligatoria)' : 'Foto del medidor (opcional)'}
      </ThemedText>
      {photoUri && (
        <Image
          accessibilityLabel="Foto tomada del medidor"
          contentFit="cover"
          source={{ uri: photoUri }}
          className="w-full rounded-sm aspect-[4/3]"
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
      <AnimatedButton
        label={photoUri ? 'Tomar otra foto' : 'Tomar foto del medidor'}
        icon={Camera}
        variant="secondary"
        disabled={permissionDenied}
        onPress={() => void handleOpenCamera()}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setIsCameraOpen(false)}
        visible={isCameraOpen}>
        <View className="flex-1 bg-[#000000]">
          <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
          <SafeAreaView edges={['bottom']} className="flex-row justify-between gap-4 p-6">
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsCameraOpen(false)}
              className="flex-1 min-h-[56px] rounded-sm items-center justify-center active:opacity-80">
              <ThemedText className="text-[#ffffff]">Cancelar</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capturar foto del medidor"
              accessibilityState={{ busy: isCapturing }}
              disabled={isCapturing}
              onPress={() => void handleTakePicture()}
              className="flex-1 min-h-[56px] rounded-sm items-center justify-center bg-[#ffffff] active:opacity-80">
              {isCapturing ? (
                <ActivityIndicator color="#243376" />
              ) : (
                <ThemedText className="text-[#243376] font-semibold">Capturar</ThemedText>
              )}
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

