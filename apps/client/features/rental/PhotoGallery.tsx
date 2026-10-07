import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ListingPhotoDto } from '@ee/contracts';
import { useTheme } from '../theme';
import { AuthImage } from './AuthImage';

interface PhotoGalleryProps {
  photos: ListingPhotoDto[];
  title: string;
  authenticated?: boolean;
}

export function PhotoGallery({ photos, title, authenticated = false }: PhotoGalleryProps) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];

  if (!current) {
    return (
      <View
        style={{
          aspectRatio: 4 / 3,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>No photos yet</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AuthImage
        path={current.url}
        authenticated={authenticated}
        accessibilityLabel={`${title}, photo ${index + 1} of ${photos.length}`}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.md }}
      />
      {photos.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {photos.map((photo, i) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Show photo ${i + 1}`}
              onPress={() => setIndex(i)}
              style={{
                borderWidth: 2,
                borderRadius: theme.radius.sm,
                borderColor: i === index ? theme.colors.primary : 'transparent',
              }}
            >
              <AuthImage
                path={photo.url}
                authenticated={authenticated}
                style={{ width: 64, height: 48, borderRadius: theme.radius.sm }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
