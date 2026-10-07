import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A row of single-choice chips, e.g. a status filter. */
export function Chips<T extends string>({ label, value, options, onChange }: ChipsProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs + 2,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
            }}
          >
            <Text
              style={{
                color: selected ? theme.colors.onPrimary : theme.colors.text,
                fontSize: theme.fontSize.sm,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
