import { useMutation } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { formErrorsFromApi, useSession } from '../../../../features/auth';
import { ListingEditor, useRefreshListings } from '../../../../features/supplier';
import { Heading, Screen } from '../../../../features/ui';

export default function NewListingScreen() {
  const { api } = useSession();
  const router = useRouter();
  const refresh = useRefreshListings();

  const create = useMutation({
    mutationFn: api.supplierListings.create,
    onSuccess: (listing) => {
      void refresh();
      // Straight to the editor so the supplier can add photos next.
      router.replace({ pathname: '/supplier/fleet/listings/[id]', params: { id: listing.id } });
    },
  });
  const apiErrors = create.error ? formErrorsFromApi(create.error) : { fields: {} };

  return (
    <Screen centered>
      <Stack.Screen options={{ title: 'New listing' }} />
      <Heading title="New listing" subtitle="It stays a draft until you publish it." />
      <ListingEditor
        submitLabel="Create draft"
        submitting={create.isPending}
        fieldErrors={apiErrors.fields}
        formError={apiErrors.form}
        onSubmit={(value) => create.mutate(value)}
      />
    </Screen>
  );
}
