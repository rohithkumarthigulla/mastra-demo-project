import {
  MAX_CALENDAR_DAYS,
  QUOTE_MAX_LINES,
  QUOTE_NOTES_MAX,
  QUOTE_TAX_PERCENT,
  type QuoteLineType,
} from '@ee/contracts';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../auth';
import { formatRupees } from '../rental';
import { useTheme } from '../theme';
import { Button, ErrorMessage, Select, TextField, useIsWide } from '../ui';
import { Card, Field, SectionTitle } from './Card';
import { freeUnitIds } from './calendarLayout';
import { rangeToQuery } from './dateRange';
import { useFleetCalendar, useUnits } from './fleetApi';
import {
  emptyLine,
  LINE_TYPE_LABELS,
  machineChoices,
  previewableLines,
  validateQuoteDraft,
  validateQuoteForSend,
  type ParsedQuote,
  type QuoteDraft,
  type QuoteErrors,
  type QuoteLineDraft,
} from './quoteForm';
import { lineAmount, previewTotals } from './quoteMath';

const LINE_TYPES = Object.entries(LINE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface QuoteBuilderProps {
  listingId: string;
  startDate: string;
  endDate: string;
  days: number;
  initial: QuoteDraft;
  saving: boolean;
  sending: boolean;
  /** Field errors from the server, keyed like {@link QuoteErrors}. */
  serverErrors?: QuoteErrors;
  formError?: string | null;
  onSave: (quote: ParsedQuote) => void;
  onSend: (quote: ParsedQuote) => void;
}

/** Edits a quote's machine, lines, notes and expiry, with a live preview of the totals. */
export function QuoteBuilder(props: QuoteBuilderProps) {
  const { api } = useSession();
  const theme = useTheme();
  const wide = useIsWide();
  const [draft, setDraft] = useState(props.initial);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const shown = { ...props.serverErrors, ...errors };

  const units = useUnits(api, { listingId: props.listingId, status: 'ACTIVE' });
  const coverable = props.days <= MAX_CALENDAR_DAYS;
  const calendar = useFleetCalendar(
    api,
    rangeToQuery({ startDate: props.startDate, days: props.days }),
    coverable,
  );
  const free = calendar.data ? freeUnitIds(calendar.data, props.startDate, props.endDate) : null;
  const choices = machineChoices(units.data ?? [], free);
  const totals = previewTotals(previewableLines(draft.lines));

  const setLine = (key: string, patch: Partial<QuoteLineDraft>) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  const submit = (send: boolean) => {
    const result = send ? validateQuoteForSend(draft) : validateQuoteDraft(draft);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) (send ? props.onSend : props.onSave)(result.value);
  };

  const editor = (
    <View style={{ flex: wide ? 3 : undefined, gap: theme.spacing.md }}>
      <Select
        label="Machine"
        value={draft.equipmentUnitId}
        options={choices}
        loading={units.isLoading}
        placeholder={
          units.data && units.data.length === 0
            ? 'No active machines on this listing'
            : 'Choose the machine to send'
        }
        allowClear
        onChange={(equipmentUnitId) => setDraft((d) => ({ ...d, equipmentUnitId }))}
        error={shown.equipmentUnitId}
      />

      <SectionTitle>Lines</SectionTitle>
      {draft.lines.map((line, index) => {
        const [complete] = previewableLines([line]);
        const amount = complete ? lineAmount(complete) : null;
        return (
          <Card key={line.key}>
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <View style={{ minWidth: 150, flex: 1 }}>
                  <Select
                    label="Type"
                    value={line.type}
                    options={LINE_TYPES}
                    onChange={(type) => setLine(line.key, { type: type as QuoteLineType })}
                  />
                </View>
                <View style={{ minWidth: 200, flex: 2 }}>
                  <TextField
                    label="Description"
                    value={line.description}
                    maxLength={200}
                    onChangeText={(description) => setLine(line.key, { description })}
                    error={shown[`lines.${index}.description`]}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <View style={{ width: 110 }}>
                  <TextField
                    label="Quantity"
                    value={line.quantity}
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(q) => setLine(line.key, { quantity: q })}
                    error={shown[`lines.${index}.quantity`]}
                  />
                </View>
                <View style={{ minWidth: 140, flex: 1 }}>
                  <TextField
                    label={line.type === 'DISCOUNT' ? 'Discount each (₹)' : 'Amount each (₹)'}
                    value={line.unitAmount}
                    keyboardType="decimal-pad"
                    onChangeText={(unitAmount) => setLine(line.key, { unitAmount })}
                    error={shown[`lines.${index}.unitAmount`]}
                  />
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                  {amount === null ? '—' : formatRupees(amount)}
                </Text>
                <Button
                  title="Remove"
                  variant="secondary"
                  disabled={draft.lines.length === 1}
                  onPress={() =>
                    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== line.key) }))
                  }
                />
              </View>
            </View>
          </Card>
        );
      })}
      <ErrorMessage message={shown.lines ?? null} />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          title="Add line"
          variant="secondary"
          disabled={draft.lines.length >= QUOTE_MAX_LINES}
          onPress={() => setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine('TRANSPORT')] }))}
        />
      </View>

      <TextField
        label="Notes for the builder (optional)"
        value={draft.notes}
        multiline
        maxLength={QUOTE_NOTES_MAX}
        onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
        error={shown.notes}
      />
      <TextField
        label="Valid until (optional)"
        value={draft.validUntil}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        onChangeText={(validUntil) => setDraft((d) => ({ ...d, validUntil }))}
        error={shown.validUntil}
      />
    </View>
  );

  const preview = (
    <View style={{ flex: wide ? 2 : undefined, gap: theme.spacing.md }}>
      <Card>
        <SectionTitle>Preview</SectionTitle>
        <Field label="Subtotal" value={formatRupees(totals.subtotal)} />
        <Field label={`GST ${QUOTE_TAX_PERCENT}%`} value={formatRupees(totals.taxAmount)} />
        <Field label="Deposit" value={formatRupees(totals.depositAmount)} />
        <Field
          label="Total"
          value={
            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
              {formatRupees(totals.total)}
            </Text>
          }
        />
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          GST is charged on everything except the deposit. The saved quote shows the final figures.
        </Text>
      </Card>
      <ErrorMessage message={props.formError ?? null} />
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          title="Send to builder"
          loading={props.sending}
          disabled={props.saving}
          onPress={() => submit(true)}
        />
        <Button
          title="Save draft"
          variant="secondary"
          loading={props.saving}
          disabled={props.sending}
          onPress={() => submit(false)}
        />
      </View>
    </View>
  );

  return (
    <View
      style={{
        flexDirection: wide ? 'row' : 'column',
        gap: theme.spacing.lg,
        alignItems: 'flex-start',
      }}
    >
      {editor}
      {preview}
    </View>
  );
}
