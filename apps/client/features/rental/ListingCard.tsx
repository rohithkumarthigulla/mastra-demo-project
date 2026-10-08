import { Pressable, Text, View } from 'react-native';
import type { EquipmentListingDto } from '@ee/contracts';
import { useTheme } from '../theme';
import { AuthImage } from './AuthImage';
import { formatDailyRate } from './format';
import { ListingStatusBadge } from './ListingStatusBadge';

interface ListingCardProps {
  listing: EquipmentListingDto;
  onPress: () => void;
  /** Supplier view: show status and load non-public photos with the owner's token. */
  owner?: boolean;
}

export function ListingCard({ listing, onPress, owner = false }: ListingCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listing.title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 260,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {listing.coverPhotoUrl ? (
        <AuthImage
          path={listing.coverPhotoUrl}
          authenticated={owner && listing.status !== 'ACTIVE'}
          style={{ width: '100%', aspectRatio: 16 / 9 }}
        />
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.textMuted }}>No photo</Text>
        </View>
      )}
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}>
        {owner ? <ListingStatusBadge status={listing.status} /> : null}
        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          {listing.title}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          {listing.model.manufacturer.name} {listing.model.modelName} · {listing.city.name}
        </Text>
        <Text
          style={{
            color: theme.colors.link,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.bold,
          }}
        >
          {formatDailyRate(listing.pricePerDay)}
        </Text>
      </View>
    </Pressable>
  );
}
