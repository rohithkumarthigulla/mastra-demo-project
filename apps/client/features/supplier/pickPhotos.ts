import * as ImagePicker from 'expo-image-picker';
import type { UploadFile } from '../../api';
import type { PickedPhoto } from './photos';

export interface PickedUpload extends PickedPhoto {
  file: UploadFile;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function guessType(name: string): string {
  return (
    MIME_BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
  );
}

/**
 * Opens the photo library (a file picker on web). Returns an empty list if the
 * user cancels; throws if photo access was denied.
 */
export async function pickPhotos(limit: number): Promise<PickedUpload[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error('Allow photo access in your device settings to add photos.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });
  if (result.canceled) return [];

  return result.assets.map((asset, i) => {
    const name = asset.fileName ?? asset.file?.name ?? `photo-${i + 1}.jpg`;
    const type = asset.mimeType ?? asset.file?.type ?? guessType(name);
    const size = asset.fileSize ?? asset.file?.size;
    const file: UploadFile = asset.file ?? { uri: asset.uri, name, type };
    return { name, type, size, file };
  });
}
