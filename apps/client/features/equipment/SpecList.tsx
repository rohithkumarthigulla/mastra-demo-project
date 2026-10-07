import type { EquipmentSpecificationDto } from '@ee/contracts';
import { Text, View } from 'react-native';
import { useSpecificationDefinitions } from '../rental/useCatalogue';
import { useTheme } from '../theme';
import { Badge } from '../ui';
import { describeSpecs } from './specs';

export function SpecList({ specifications }: { specifications: EquipmentSpecificationDto[] }) {
  const theme = useTheme();
  const definitions = useSpecificationDefinitions();
  const rows = describeSpecs(specifications, definitions.data);

  if (rows.length === 0) {
    return (
      <Text style={{ color: theme.colors.textMuted }}>
        No specifications recorded for this model yet.
      </Text>
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {rows.map((row, i) => (
        <View
          key={row.id}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.sm + 2,
            backgroundColor: theme.colors.surface,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Text style={{ flex: 1, minWidth: 140, color: theme.colors.textMuted }}>{row.label}</Text>
          <Text
            style={{
              color: row.known ? theme.colors.text : theme.colors.textMuted,
              fontWeight: row.known ? '600' : '400',
            }}
          >
            {row.value}
          </Text>
          {row.known ? (
            <Badge
              label={row.verified ? 'Verified' : 'Unverified'}
              tone={row.verified ? 'positive' : 'warning'}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
