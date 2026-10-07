import type { BlockReason, CreateBlockRequest, EquipmentUnitDto } from '@ee/contracts';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../auth';
import type { FieldErrors } from '../auth/formErrors';
import { useTheme } from '../theme';
import { Button, Chips, ErrorMessage, Select, TextField } from '../ui';
import { Card, SectionTitle } from './Card';
import { BLOCK_REASON_LABELS, emptyBlockForm, validateBlock } from './blockForm';
import { supplierErrors } from './errors';
import { useFleetMutation } from './fleetApi';
import { unitName } from './unitForm';

const REASONS = Object.entries(BLOCK_REASON_LABELS).map(([value, label]) => ({
  value: value as BlockReason,
  label,
}));

/** Takes a machine out of service for whole days. */
export function BlockEditor({ units, onDone }: { units: EquipmentUnitDto[]; onDone: () => void }) {
  const { api } = useSession();
  const theme = useTheme();
  const [values, setValues] = useState(() =>
    emptyBlockForm(units.length === 1 ? units[0]!.id : ''),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useFleetMutation(
    api,
    (calls, args: { unitId: string; body: CreateBlockRequest }) =>
      calls.availability.createBlock(args.unitId, args.body),
  );
  const apiErrors = create.error ? supplierErrors(create.error) : { fields: {} };
  const set =
    <K extends keyof typeof values>(key: K) =>
    (value: (typeof values)[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  return (
    <Card>
      <View style={{ gap: theme.spacing.sm, maxWidth: 520 }}>
        <SectionTitle>Block a machine</SectionTitle>
        <Select
          label="Machine"
          value={values.unitId}
          options={units.map((u) => ({
            value: u.id,
            label: unitName(u),
            description: `${u.listing.title} · ${u.yard.name}`,
          }))}
          onChange={set('unitId')}
          error={errors.unitId}
        />
        <Chips label="Reason" value={values.reason} options={REASONS} onChange={set('reason')} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="First day"
              value={values.startDate}
              onChangeText={set('startDate')}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              error={errors.startDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Last day"
              value={values.endDate}
              onChangeText={set('endDate')}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              error={errors.endDate}
            />
          </View>
        </View>
        <TextField
          label="Note (optional)"
          value={values.note}
          onChangeText={set('note')}
          maxLength={500}
          multiline
          error={errors.note}
        />
        <ErrorMessage message={errors.form ?? apiErrors.form ?? null} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            title="Block days"
            loading={create.isPending}
            onPress={() => {
              const result = validateBlock(values);
              setErrors(result.ok ? {} : result.errors);
              if (result.ok) {
                create.mutate({ unitId: result.unitId, body: result.value }, { onSuccess: onDone });
              }
            }}
          />
          <Button title="Cancel" variant="secondary" onPress={onDone} />
        </View>
      </View>
    </Card>
  );
}
