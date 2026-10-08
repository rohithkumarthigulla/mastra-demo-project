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
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: theme.size.touch,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.size.touch / 2,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? theme.colors.onPrimary : theme.colors.text,
                fontSize: theme.fontSize.sm,
                fontWeight: theme.fontWeight.semibold,
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
