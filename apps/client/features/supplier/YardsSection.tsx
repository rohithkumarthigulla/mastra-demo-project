import type { YardDto } from '@ee/contracts';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../auth';
import { useCities } from '../rental';
import { useTheme } from '../theme';
import { Button, ErrorMessage, Select, TextField } from '../ui';
import { Card, CardTitle, Muted, SectionTitle } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { supplierErrorMessage, supplierErrors } from './errors';
import { useFleetMutation } from './fleetApi';
import { validateYard, yardToForm, type YardFormValues } from './unitForm';
import type { FieldErrors } from '../auth/formErrors';

type Editing = { kind: 'new' } | { kind: 'edit'; yard: YardDto } | null;

/** The supplier's yards with inline add, rename and delete. */
export function YardsSection({ yards }: { yards: YardDto[] }) {
  const { api } = useSession();
  const theme = useTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<YardDto | null>(null);

  const remove = useFleetMutation(api, (calls, yardId: string) => calls.yards.remove(yardId));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>Yards</SectionTitle>
      <Muted>Where your machines are kept. Every machine belongs to one yard.</Muted>
      {yards.map((yard) =>
        editing?.kind === 'edit' && editing.yard.id === yard.id ? (
          <YardEditor key={yard.id} yard={yard} onDone={() => setEditing(null)} />
        ) : (
          <Card key={yard.id}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: theme.spacing.sm,
                flexWrap: 'wrap',
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <CardTitle>{yard.name}</CardTitle>
                <Muted>{[yard.address, yard.city.name].filter(Boolean).join(', ')}</Muted>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button
                  title="Edit"
                  variant="secondary"
                  onPress={() => setEditing({ kind: 'edit', yard })}
                />
                <Button
                  title="Delete"
                  variant="secondary"
                  onPress={() => {
                    remove.reset();
                    setDeleting(yard);
                  }}
                />
              </View>
            </View>
          </Card>
        ),
      )}
      {editing?.kind === 'new' ? (
        <YardEditor onDone={() => setEditing(null)} />
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            title={yards.length === 0 ? 'Add your first yard' : 'Add a yard'}
            variant={yards.length === 0 ? 'primary' : 'secondary'}
            onPress={() => setEditing({ kind: 'new' })}
          />
        </View>
      )}
      <ConfirmDialog
        visible={deleting !== null}
        title="Delete yard?"
        message={`${deleting?.name ?? 'This yard'} will be removed. Yards that still hold machines cannot be deleted.`}
        confirmLabel="Delete yard"
        loading={remove.isPending}
        error={supplierErrorMessage(remove.error)}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </View>
  );
}

function YardEditor({ yard, onDone }: { yard?: YardDto; onDone: () => void }) {
  const { api } = useSession();
  const theme = useTheme();
  const { cities, isLoading } = useCities();
  const [values, setValues] = useState<YardFormValues>(yardToForm(yard));
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = useFleetMutation(api, (calls, body: YardFormValues) =>
    yard ? calls.yards.update(yard.id, body) : calls.yards.create(body),
  );
  const apiErrors = save.error ? supplierErrors(save.error) : { fields: {} };
  const set = (key: keyof YardFormValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <Card>
      <View style={{ gap: theme.spacing.sm }}>
        <TextField
          label="Yard name"
          value={values.name}
          onChangeText={set('name')}
          maxLength={80}
          error={errors.name ?? apiErrors.fields.name}
        />
        <Select
          label="City"
          value={values.cityGeoId}
          options={cities.map((c) => ({ value: c.geoId, label: c.name, description: c.state }))}
          loading={isLoading}
          onChange={set('cityGeoId')}
          error={errors.cityGeoId ?? apiErrors.fields.cityGeoId}
        />
        <TextField
          label="Address (optional)"
          value={values.address}
          onChangeText={set('address')}
          maxLength={300}
        />
        <ErrorMessage message={apiErrors.form ?? null} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            title={yard ? 'Save yard' : 'Add yard'}
            loading={save.isPending}
            onPress={() => {
              const result = validateYard(values);
              setErrors(result.ok ? {} : result.errors);
              if (result.ok) save.mutate(result.value, { onSuccess: onDone });
            }}
          />
          <Button title="Cancel" variant="secondary" onPress={onDone} />
        </View>
      </View>
    </Card>
  );
}
