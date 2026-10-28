import { deleteReadingPhoto, persistReadingPhoto } from '../photos';

const mockCreateDirectory = jest.fn();
const mockCopy = jest.fn();
const mockDelete = jest.fn();
let mockFileExists = true;

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');

  return {
    Paths: { document: { uri: 'file:///documents' } },
    Directory: jest.fn().mockImplementation((...parts: unknown[]) => ({
      uri: join(parts),
      create: mockCreateDirectory,
    })),
    File: jest.fn().mockImplementation((...parts: unknown[]) => ({
      uri: join(parts),
      copy: mockCopy,
      delete: mockDelete,
      get exists() {
        return mockFileExists;
      },
    })),
  };
});

beforeEach(() => {
  mockCreateDirectory.mockReset();
  mockCopy.mockReset().mockResolvedValue(undefined);
  mockDelete.mockReset();
  mockFileExists = true;
});

describe('persistReadingPhoto', () => {
  it('copia la foto temporal a la carpeta persistente con el código del medidor', async () => {
    await expect(
      persistReadingPhoto(
        'file:///cache/Camera/tmp.jpg',
        ' med-123456 ',
        new Date('2026-10-27T15:30:00.000Z'),
      ),
    ).resolves.toBe('file:///documents/reading-photos/MED-123456-1793115000000.jpg');

    expect(mockCreateDirectory).toHaveBeenCalledWith({ idempotent: true, intermediates: true });
    expect(mockCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///documents/reading-photos/MED-123456-1793115000000.jpg',
      }),
    );
  });

  it('propaga el error si la foto no se pudo copiar', async () => {
    mockCopy.mockRejectedValue(new Error('Sin espacio'));

    await expect(persistReadingPhoto('file:///cache/tmp.jpg', 'MED-123456')).rejects.toThrow(
      'Sin espacio',
    );
  });
});

describe('deleteReadingPhoto', () => {
  it('elimina la foto si existe y no falla si ya no existe', () => {
    deleteReadingPhoto('file:///documents/reading-photos/MED-123456-1.jpg');
    mockFileExists = false;
    deleteReadingPhoto('file:///documents/reading-photos/MED-123456-1.jpg');

    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
