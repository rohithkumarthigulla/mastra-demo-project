import type { QuoteDto, QuoteLineType } from '@ee/contracts';
import { Text, View } from 'react-native';
import { formatRupees } from '../rental';
import { useTheme } from '../theme';

const LINE_TYPE: Record<QuoteLineType, string> = {
  RENTAL: 'Rental',
  TRANSPORT: 'Transport',
  OPERATOR: 'Operator',
  DEPOSIT: 'Deposit',
  DISCOUNT: 'Discount',
};

/** Line items and totals, exactly as priced by the supplier. Role-neutral. */
export function QuoteBreakdown({ quote }: { quote: QuoteDto }) {
  const theme = useTheme();
  const lines = [...quote.lines].sort((a, b) => a.position - b.position);

  const row = (label: string, amount: number, strong = false, detail?: string) => (
    <View key={label + (detail ?? '')} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
            fontWeight: strong ? '700' : '400',
          }}
        >
          {label}
        </Text>
        {detail ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.md,
          fontWeight: strong ? '700' : '400',
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatRupees(amount)}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
      }}
    >
      {lines.map((line) =>
        row(
          line.description || LINE_TYPE[line.type],
          line.amount,
          false,
          `${LINE_TYPE[line.type]} · ${line.quantity} × ${formatRupees(line.unitAmount)}`,
        ),
      )}
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />
      {row('Subtotal', quote.subtotal)}
      {row(`GST (${quote.taxPercent}%)`, quote.taxAmount)}
      {quote.depositAmount > 0 ? row('Refundable deposit', quote.depositAmount) : null}
      {row('Total', quote.total, true)}
    </View>
  );
}
