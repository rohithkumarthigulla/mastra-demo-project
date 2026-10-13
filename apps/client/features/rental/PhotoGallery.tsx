import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { ListingPhotoDto } from '@ee/contracts';
import { EquipmentArt } from '../equipment/art';
import { useTheme } from '../theme';
import { AuthImage } from './AuthImage';

interface PhotoGalleryProps {
  photos: ListingPhotoDto[];
  title: string;
  /** Picks the drawing shown when there are no photos. */
  categoryCode?: string;
  authenticated?: boolean;
}

export function PhotoGallery({
  photos,
  title,
  categoryCode,
  authenticated = false,
}: PhotoGalleryProps) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];

  if (!current) {
    return (
      <EquipmentArt
        categoryCode={categoryCode}
        title={title}
        style={{ aspectRatio: 4 / 3, borderRadius: theme.radius.md }}
      />
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
              accessibilityState={{ selected: i === index }}
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
