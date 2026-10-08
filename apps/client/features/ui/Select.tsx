import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  loading?: boolean;
  /** Offer an "Any" choice that clears the value (for filters). */
  allowClear?: boolean;
  /**
   * Called as the user types. When given, the caller filters `options` (e.g. server-side);
   * otherwise options are filtered locally by label.
   */
  onSearch?: (text: string) => void;
  /** Label for the current value when it is not in `options` (e.g. a remote result no longer listed). */
  selectedLabel?: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  error,
  loading = false,
  allowClear = false,
  onSearch,
  selectedLabel,
}: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const current =
    options.find((o) => o.value === value)?.label ?? (value ? selectedLabel : undefined);
  const visible = useMemo(() => {
    if (onSearch) return options;
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, search, onSearch]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch('');
  };

  const inputStyle = {
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.sm + 2,
    minHeight: theme.size.touch,
    justifyContent: 'center' as const,
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
        }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={inputStyle}
      >
        <Text
          numberOfLines={1}
          style={{
            color: current ? theme.colors.text : theme.colors.textMuted,
            fontSize: theme.fontSize.md,
          }}
        >
          {current ?? placeholder}
        </Text>
      </Pressable>
      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm }}>{error}</Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.background,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.semibold,
              }}
            >
              {label}
            </Text>
            <TextInput
              autoFocus
              accessibilityLabel={`Search ${label}`}
              placeholder="Search"
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                onSearch?.(text);
              }}
              style={[
                inputStyle,
                { borderColor: theme.colors.borderStrong, fontSize: theme.fontSize.md },
              ]}
            />
            {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
            <FlatList
              data={allowClear ? [{ value: '', label: 'Any' }, ...visible] : visible}
              keyExtractor={(item) => item.value || '__any'}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              ListEmptyComponent={
                loading ? null : (
                  <Text style={{ color: theme.colors.textMuted, padding: theme.spacing.sm }}>
                    No matches
                  </Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.value === value }}
                  onPress={() => choose(item.value)}
                  style={({ pressed }) => ({
                    minHeight: theme.size.touch,
                    justifyContent: 'center',
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.sm,
                    backgroundColor:
                      item.value === value
                        ? theme.colors.surface
                        : pressed
                          ? theme.colors.border
                          : 'transparent',
                  })}
                >
                  <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md }}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                      {item.description}
                    </Text>
                  ) : null}
                </Pressable>
              )}
            />
            <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '85%' },
});
