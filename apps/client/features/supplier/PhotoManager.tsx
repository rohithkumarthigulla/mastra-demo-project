import { MAX_LISTING_PHOTOS, type EquipmentListingDto } from '@ee/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../../api';
import { useSession } from '../auth';
import { AuthImage } from '../rental';
import { useTheme } from '../theme';
import { Badge, Button, ErrorMessage } from '../ui';
import { checkPhotos, move } from './photos';
import { pickPhotos } from './pickPhotos';
import { useRefreshListings } from './useRefreshListings';

function messageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function PhotoManager({ listing }: { listing: EquipmentListingDto }) {
  const theme = useTheme();
  const { api } = useSession();
  const refresh = useRefreshListings();
  const [problems, setProblems] = useState<string[]>([]);
  const photos = listing.photos;
  const authenticated = listing.status !== 'ACTIVE';
  const room = MAX_LISTING_PHOTOS - photos.length;

  const add = useMutation({
    mutationFn: async () => {
      const picked = await pickPhotos(room);
      const { accepted, rejected } = checkPhotos(picked, photos.length);
      const failures = rejected.map((r) => r.reason);
      // One at a time keeps positions in pick order and lets the rest succeed if one fails.
      for (const photo of accepted) {
        try {
          await api.listingMedia.upload(listing.id, photo.file);
        } catch (error) {
          failures.push(`${photo.name}: ${messageOf(error)}`);
        }
      }
      return failures;
    },
    onMutate: () => setProblems([]),
    onSuccess: (failures) => setProblems(failures),
    onError: (error) => setProblems([messageOf(error)]),
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.listingMedia.reorder(listing.id, ids),
    onMutate: () => setProblems([]),
    onError: (error) => setProblems([messageOf(error)]),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) => api.listingMedia.remove(listing.id, mediaId),
    onMutate: () => setProblems([]),
    onError: (error) => setProblems([messageOf(error)]),
    onSettled: refresh,
  });

  const busy = add.isPending || reorder.isPending || remove.isPending;
  const moveTo = (from: number, to: number) =>
    reorder.mutate(move(photos, from, to).map((p) => p.id));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '600' }}>
        Photos ({photos.length}/{MAX_LISTING_PHOTOS})
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
        JPEG, PNG or WebP, up to 8 MB each. The first photo is the cover.
      </Text>
      {problems.map((problem) => (
        <ErrorMessage key={problem} message={problem} />
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {photos.map((photo, i) => (
          <View
            key={photo.id}
            style={{
              width: 168,
              gap: theme.spacing.xs,
              padding: theme.spacing.xs,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <AuthImage
              path={photo.url}
              authenticated={authenticated}
              accessibilityLabel={`Photo ${i + 1}`}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.sm }}
            />
            {i === 0 ? <Badge label="Cover" tone="positive" /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              <PhotoAction
                label="◀"
                hint="Move earlier"
                disabled={busy || i === 0}
                onPress={() => moveTo(i, i - 1)}
              />
              <PhotoAction
                label="▶"
                hint="Move later"
                disabled={busy || i === photos.length - 1}
                onPress={() => moveTo(i, i + 1)}
              />
              {i > 0 ? (
                <PhotoAction label="Make cover" disabled={busy} onPress={() => moveTo(i, 0)} />
              ) : null}
              <PhotoAction
                label="Delete"
                danger
                disabled={busy}
                onPress={() => remove.mutate(photo.id)}
              />
            </View>
          </View>
        ))}
      </View>
      <Button
        title={room > 0 ? 'Add photos' : 'Photo limit reached'}
        variant="secondary"
        loading={add.isPending}
        disabled={busy || room <= 0}
        onPress={() => add.mutate()}
      />
    </View>
  );
}

interface PhotoActionProps {
  label: string;
  hint?: string;
  danger?: boolean;
  disabled: boolean;
  onPress: () => void;
}

function PhotoAction({ label, hint, danger = false, disabled, onPress }: PhotoActionProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ?? label}
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: danger ? theme.colors.danger : theme.colors.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          color: danger ? theme.colors.danger : theme.colors.text,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
