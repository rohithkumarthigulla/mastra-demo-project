import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../../features/auth';
import {
  addDays,
  AvailabilityCalendar,
  BLOCK_REASON_LABELS,
  BlockEditor,
  clampDays,
  ConfirmDialog,
  defaultRange,
  formatDateRange,
  isCalendarDate,
  Muted,
  rangeToQuery,
  supplierErrorMessage,
  useFleetCalendar,
  useFleetMutation,
  useUnits,
  type DayRange,
  type SlotSegment,
} from '../../features/supplier';
import { useTheme } from '../../features/theme';
import {
  Button,
  Chips,
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Screen,
  TextField,
} from '../../features/ui';

const LENGTHS = [
  { value: '14', label: '2 weeks' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '92', label: '92 days' },
];

export default function AvailabilityScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const [range, setRange] = useState<DayRange>(() => defaultRange());
  const [startText, setStartText] = useState(range.startDate);
  const [blocking, setBlocking] = useState(false);
  const [lifting, setLifting] = useState<SlotSegment | null>(null);

  const calendar = useFleetCalendar(api, rangeToQuery(range));
  const units = useUnits(api, { status: 'ACTIVE' });
  const lift = useFleetMutation(api, (calls, blockId: string) =>
    calls.availability.liftBlock(blockId),
  );

  const onPressSegment = (_unitId: string, segment: SlotSegment) => {
    if (segment.state === 'BOOKED') {
      router.push({ pathname: '/supplier/bookings/[id]', params: { id: segment.sourceId } });
      return;
    }
    lift.reset();
    setLifting(segment);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Availability' }} />
      <Heading
        title="Availability"
        subtitle="Bookings and blocks for every machine. Tap a block to lift it, or a booking to open it."
      />
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ width: 160 }}>
          <TextField
            label="From"
            value={startText}
            onChangeText={(text) => {
              setStartText(text);
              if (isCalendarDate(text.trim())) setRange((r) => ({ ...r, startDate: text.trim() }));
            }}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            error={isCalendarDate(startText.trim()) ? undefined : 'Use YYYY-MM-DD'}
          />
        </View>
        <Chips
          label="Show"
          value={String(range.days)}
          options={LENGTHS}
          onChange={(days) => setRange((r) => ({ ...r, days: Number(days) }))}
        />
      </View>
      <Muted>
        {formatDateRange(range.startDate, addDays(range.startDate, clampDays(range.days) - 1))}
      </Muted>

      {blocking ? (
        <BlockEditor units={units.data ?? []} onDone={() => setBlocking(false)} />
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            title="Block a machine"
            disabled={(units.data ?? []).length === 0}
            onPress={() => setBlocking(true)}
          />
        </View>
      )}

      {calendar.isLoading ? (
        <LoadingIndicator />
      ) : calendar.error ? (
        <ErrorMessage message={supplierErrorMessage(calendar.error)} />
      ) : !calendar.data || calendar.data.lanes.length === 0 ? (
        <EmptyState
          title="No machines yet"
          message="Add machines on the fleet screen to see them here."
        >
          <Button title="Go to fleet" onPress={() => router.push('/supplier/fleet')} />
        </EmptyState>
      ) : (
        <AvailabilityCalendar
          range={range}
          calendar={calendar.data}
          onPressSegment={onPressSegment}
        />
      )}

      <ConfirmDialog
        visible={lifting !== null}
        title="Lift this block?"
        message={
          lifting
            ? `${BLOCK_REASON_LABELS[lifting.reason ?? 'MAINTENANCE']}, ${formatDateRange(lifting.firstDate, lifting.lastDate)}${lifting.note ? ` — ${lifting.note}` : ''}. The machine becomes available for these days again.`
            : ''
        }
        confirmLabel="Lift block"
        loading={lift.isPending}
        error={supplierErrorMessage(lift.error)}
        onCancel={() => setLifting(null)}
        onConfirm={() => {
          if (lifting) lift.mutate(lifting.sourceId, { onSuccess: () => setLifting(null) });
        }}
      />
    </Screen>
  );
}
