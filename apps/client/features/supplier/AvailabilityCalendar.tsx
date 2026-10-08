import type { FleetCalendarDto } from '@ee/contracts';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { useIsWide } from '../ui';
import { BLOCK_REASON_LABELS } from './blockForm';
import { calendarDays, layoutLane, type SlotSegment } from './calendarLayout';
import type { DayRange } from './dateRange';

const LANE_HEIGHT = 44;
const SEGMENT_INSET = 6;

interface AvailabilityCalendarProps {
  range: DayRange;
  calendar: FleetCalendarDto;
  onPressSegment: (unitId: string, segment: SlotSegment) => void;
}

/** One lane per machine across the chosen days; scrolls sideways on narrow screens. */
export function AvailabilityCalendar({
  range,
  calendar,
  onPressSegment,
}: AvailabilityCalendarProps) {
  const theme = useTheme();
  const wide = useIsWide();
  const days = calendarDays(range);
  const dayWidth = wide ? 36 : 32;
  const nameWidth = wide ? 180 : 120;
  const gridWidth = days.length * dayWidth;

  const colours = {
    BLOCKED: { background: theme.colors.textMuted, text: theme.colors.background },
    BOOKED: { background: theme.colors.primary, text: theme.colors.onPrimary },
  } as const;

  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: nameWidth, borderRightWidth: 1, borderColor: theme.colors.border }}>
        <View style={{ height: LANE_HEIGHT }} />
        {calendar.lanes.map((lane) => (
          <View
            key={lane.unitId}
            style={{
              height: LANE_HEIGHT,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.sm,
              borderTopWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}
            >
              {lane.label ?? 'Unlabelled'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}
            >
              {lane.yard.name}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal>
        <View style={{ width: gridWidth }}>
          <View style={{ height: LANE_HEIGHT, flexDirection: 'row' }}>
            {days.map((day) => (
              <View
                key={day.date}
                style={{ width: dayWidth, alignItems: 'center', justifyContent: 'flex-end' }}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}>
                  {day.month ?? ' '}
                </Text>
                <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.sm }}>
                  {day.label}
                </Text>
              </View>
            ))}
          </View>
          {calendar.lanes.map((lane) => (
            <View
              key={lane.unitId}
              style={{ height: LANE_HEIGHT, borderTopWidth: 1, borderColor: theme.colors.border }}
            >
              {layoutLane(range, lane.slots).map((segment) => {
                const label =
                  segment.state === 'BOOKED'
                    ? 'Booked'
                    : BLOCK_REASON_LABELS[segment.reason ?? 'MAINTENANCE'];
                return (
                  <Pressable
                    key={`${segment.sourceId}-${segment.startCol}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${lane.label ?? 'Machine'}: ${label} ${segment.firstDate} to ${segment.lastDate}`}
                    onPress={() => onPressSegment(lane.unitId, segment)}
                    // The bar is inset for legibility; the hit area still spans the full lane.
                    hitSlop={{ top: SEGMENT_INSET, bottom: SEGMENT_INSET }}
                    style={({ pressed }) => ({
                      position: 'absolute',
                      top: SEGMENT_INSET,
                      bottom: SEGMENT_INSET,
                      left: segment.startCol * dayWidth + 1,
                      width: segment.span * dayWidth - 2,
                      justifyContent: 'center',
                      paddingHorizontal: theme.spacing.xs,
                      backgroundColor: colours[segment.state].background,
                      opacity: pressed ? 0.7 : 1,
                      borderTopLeftRadius: segment.clippedStart ? 0 : theme.radius.sm,
                      borderBottomLeftRadius: segment.clippedStart ? 0 : theme.radius.sm,
                      borderTopRightRadius: segment.clippedEnd ? 0 : theme.radius.sm,
                      borderBottomRightRadius: segment.clippedEnd ? 0 : theme.radius.sm,
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colours[segment.state].text,
                        fontSize: theme.fontSize.xs,
                        fontWeight: theme.fontWeight.semibold,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
