import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const theme = useTheme();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.md,
      }}
    >
      <Button
        title="Previous"
        variant="secondary"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md }}>
        Page {page} of {pages}
      </Text>
      <Button
        title="Next"
        variant="secondary"
        disabled={page >= pages}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
