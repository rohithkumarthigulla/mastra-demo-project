import { EquipmentArt } from '../equipment/art';
import { useTheme } from '../theme';
import { AuthImage } from './AuthImage';

const SIZE = 64;

interface ListingThumbProps {
  /** A listing summary: the cover photo when there is one, otherwise the drawing read from the title. */
  listing: { title: string; coverPhotoUrl: string | null };
  authenticated?: boolean;
}

/** Square thumbnail for list rows about a listing, such as requests and bookings. */
export function ListingThumb({ listing, authenticated = false }: ListingThumbProps) {
  const theme = useTheme();
  const style = { width: SIZE, height: SIZE, borderRadius: theme.radius.sm };
  return listing.coverPhotoUrl ? (
    <AuthImage
      path={listing.coverPhotoUrl}
      authenticated={authenticated}
      style={style}
      accessibilityLabel={listing.title}
    />
  ) : (
    <EquipmentArt title={listing.title} style={style} />
  );
}
