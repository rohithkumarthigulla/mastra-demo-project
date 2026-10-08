import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../../features/auth';
import {
  Card,
  CardTitle,
  groupUnitsByListing,
  Muted,
  SectionTitle,
  supplierErrorMessage,
  UnitStatusBadge,
  unitName,
  useUnits,
  useYards,
  YardsSection,
} from '../../../features/supplier';
import { useTheme } from '../../../features/theme';
import {
  Button,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
} from '../../../features/ui';

export default function SupplierFleetScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const yards = useYards(api);
  const units = useUnits(api);

  const groups = groupUnitsByListing(units.data ?? []);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Fleet' }} />
      <Heading title="Fleet" subtitle="Your yards and the machines behind each listing." />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <Button title="My listings" onPress={() => router.push('/supplier/fleet/listings')} />
        <Button
          title="Availability"
          variant="secondary"
          onPress={() => router.push('/supplier/availability')}
        />
      </View>

      {yards.isLoading ? (
        <LoadingIndicator />
      ) : yards.error ? (
        <ErrorMessage message={supplierErrorMessage(yards.error)} />
      ) : (
        <YardsSection yards={yards.data ?? []} />
      )}

      <View style={{ gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          <SectionTitle>Machines</SectionTitle>
          <Button
            title="Add a machine"
            variant="secondary"
            disabled={(yards.data ?? []).length === 0}
            onPress={() => router.push('/supplier/fleet/units/new')}
          />
        </View>
        {yards.data?.length === 0 ? <Muted>Add a yard before adding machines.</Muted> : null}
        {units.isLoading ? (
          <LoadingIndicator />
        ) : units.error ? (
          <ErrorMessage message={supplierErrorMessage(units.error)} />
        ) : groups.length === 0 ? (
          <EmptyState
            title="No machines yet"
            message="A listing can only be published once it has at least one active machine."
          />
        ) : (
          groups.map((group) => (
            <View key={group.listing.id} style={{ gap: theme.spacing.xs }}>
              <CardTitle>{group.listing.title}</CardTitle>
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
                      <Muted>
                        {unit.model.manufacturer.name} {unit.model.modelName} · {unit.yard.name}
                      </Muted>
                    </View>
                    <UnitStatusBadge status={unit.status} />
                  </View>
                </Card>
              ))}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
