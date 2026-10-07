import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../auth';
import { useTheme } from '../theme';
import { Button, ErrorMessage, LoadingIndicator } from '../ui';
import { Card, CardTitle, Muted, SectionTitle } from './Card';
import { supplierErrorMessage } from './errors';
import { useUnits } from './fleetApi';
import { UnitStatusBadge } from './StatusBadge';
import { groupUnitsByListing, unitName } from './unitForm';

/** The machines behind one listing; a listing needs an active one before it can be published. */
export function ListingMachines({ listingId }: { listingId: string }) {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const units = useUnits(api, { listingId });
  const group = groupUnitsByListing(units.data ?? [])[0];

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>Machines</SectionTitle>
      {units.isLoading ? (
        <LoadingIndicator />
      ) : units.error ? (
        <ErrorMessage message={supplierErrorMessage(units.error)} />
      ) : !group ? (
        <Muted>No machines yet. Add at least one before publishing this listing.</Muted>
      ) : (
        <>
          <Muted>
            {group.active} active of {group.units.length}
          </Muted>
          {group.units.map((unit) => (
            <Card
              key={unit.id}
              label={`Machine ${unitName(unit)}`}
              onPress={() =>
                router.push({ pathname: '/supplier/fleet/units/[id]', params: { id: unit.id } })
              }
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <CardTitle>{unitName(unit)}</CardTitle>
                  <Muted>{unit.yard.name}</Muted>
                </View>
                <UnitStatusBadge status={unit.status} />
              </View>
            </Card>
          ))}
        </>
      )}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          title="Add a machine"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/supplier/fleet/units/new', params: { listingId } })
          }
        />
      </View>
    </View>
  );
}
