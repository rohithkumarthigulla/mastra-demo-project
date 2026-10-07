import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { useIsWide } from '../ui';
import { STAGES, stageIndex, type StageState } from './stages';

/**
 * The rental flow, Requested → Returned, with the current step highlighted. Role-neutral so
 * the supplier screens can reuse it. A closed request/booking shows where it stopped.
 */
export function StageBar({ state, compact = false }: { state: StageState; compact?: boolean }) {
  const theme = useTheme();
  const wide = useIsWide() && !compact;
  const current = stageIndex(state.current);
  const label = STAGES[current]!.label;
  const done = state.current === 'returned' && !state.closed;

  const dotColor = (i: number) => {
    if (i > current) return theme.colors.border;
    if (i === current && state.closed) return theme.colors.danger;
    return theme.colors.primary;
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={state.closed ? `Stopped at ${label}: ${state.closed}` : `Stage: ${label}`}
      style={{ gap: theme.spacing.xs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {STAGES.map((stage, i) => (
          <View
            key={stage.key}
            style={{ flex: i === 0 ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}
          >
            {i > 0 ? (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: i <= current ? theme.colors.primary : theme.colors.border,
                }}
              />
            ) : null}
            <View
              style={{
                width: i === current ? 12 : 8,
                height: i === current ? 12 : 8,
                borderRadius: 6,
                backgroundColor: dotColor(i),
              }}
            />
          </View>
        ))}
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {STAGES.map((stage, i) => (
            <Text
              key={stage.key}
              style={{
                fontSize: theme.fontSize.sm,
                color: i === current ? theme.colors.text : theme.colors.textMuted,
                fontWeight: i === current ? '600' : '400',
              }}
            >
              {stage.label}
            </Text>
          ))}
        </View>
      ) : null}
      {state.closed ? (
        <Text style={{ fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
          {`Stopped at ${label.toLowerCase()} — ${state.closed}`}
        </Text>
      ) : !wide ? (
        <Text style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
          {done
            ? 'Returned — rental complete'
            : `Step ${current + 1} of ${STAGES.length}: ${label}`}
        </Text>
      ) : null}
    </View>
  );
}
