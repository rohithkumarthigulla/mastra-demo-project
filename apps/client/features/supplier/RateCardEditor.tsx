import { usePutRateCard, useRateCard } from '../../api/rate-cards';
import { useState } from 'react';
import { View } from 'react-native';
import { useSession } from '../auth';
import type { FieldErrors } from '../auth/formErrors';
import { useTheme } from '../theme';
import { Button, ErrorMessage, LoadingIndicator, TextField } from '../ui';
import { Muted, SectionTitle } from './Card';
import { supplierErrorMessage, supplierErrors } from './errors';
import {
  RATE_CARD_FIELDS,
  rateCardToForm,
  validateRateCard,
  type RateCardFormValues,
} from './rateCardForm';
import type { RateCardDto } from '@ee/contracts';

/** Optional extras quotes are drafted from: longer-hire rates, transport, operator and deposit. */
export function RateCardEditor({ listingId }: { listingId: string }) {
  const { api } = useSession();
  const theme = useTheme();
  const card = useRateCard(api, listingId);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle>Rate card</SectionTitle>
      <Muted>Optional. Leave a field blank if you don&apos;t offer it.</Muted>
      {card.isLoading ? (
        <LoadingIndicator />
      ) : card.error ? (
        <ErrorMessage message={supplierErrorMessage(card.error)} />
      ) : (
        <RateCardFields
          key={card.data?.updatedAt ?? 'new'}
          listingId={listingId}
          card={card.data}
        />
      )}
    </View>
  );
}

function RateCardFields({ listingId, card }: { listingId: string; card?: RateCardDto }) {
  const { api } = useSession();
  const theme = useTheme();
  const put = usePutRateCard(api);
  const [values, setValues] = useState<RateCardFormValues>(rateCardToForm(card));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const apiErrors = put.error ? supplierErrors(put.error) : { fields: {} };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {RATE_CARD_FIELDS.map(({ key, label }) => (
        <TextField
          key={key}
          label={`${label} (₹)`}
          value={values[key]}
          onChangeText={(text) => setValues((v) => ({ ...v, [key]: text }))}
          keyboardType="decimal-pad"
          error={errors[key] ?? apiErrors.fields[key]}
        />
      ))}
      <ErrorMessage message={apiErrors.form ?? null} />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          title="Save rate card"
          variant="secondary"
          loading={put.isPending}
          onPress={() => {
            setSaved(false);
            const result = validateRateCard(values);
            setErrors(result.ok ? {} : result.errors);
            if (result.ok) {
              put.mutate({ listingId, body: result.value }, { onSuccess: () => setSaved(true) });
            }
          }}
        />
      </View>
      {saved ? <Muted>Rate card saved.</Muted> : null}
    </View>
  );
}
