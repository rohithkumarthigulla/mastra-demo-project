import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { formErrorsFromApi, useSession } from '../../features/auth';
import { queryKeys, useCategories, useManufacturers } from '../../features/rental';
import { useTheme } from '../../features/theme';
import {
  EmptyState,
  ErrorMessage,
  Heading,
  LoadingIndicator,
  Pagination,
  Screen,
  Select,
  useIsWide,
} from '../../features/ui';

const PAGE_SIZE = 24;

function single(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim() || undefined;
}

export default function EquipmentCatalogueScreen() {
  const { api } = useSession();
  const theme = useTheme();
  const wide = useIsWide();
  const router = useRouter();
  const params = useLocalSearchParams();
  const category = single(params.category);
  const manufacturerId = single(params.manufacturer);
  const pageParam = Number(single(params.page));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;

  const { categories, byId: categoriesById, isLoading: categoriesLoading } = useCategories();
  const {
    manufacturers,
    byId: manufacturersById,
    isLoading: manufacturersLoading,
  } = useManufacturers();
  // The models API filters by manufacturer name; the URL keeps the stable id.
  const manufacturer = manufacturerId ? manufacturersById.get(manufacturerId)?.name : undefined;
  const waitingForName =
    manufacturerId !== undefined && manufacturer === undefined && manufacturersLoading;

  const search = { category, manufacturer, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  const models = useQuery({
    queryKey: queryKeys.models(search),
    queryFn: () => api.knowledge.models(search),
    enabled: !waitingForName,
    placeholderData: (previous) => previous,
  });

  const show = (next: { category?: string; manufacturer?: string; page?: number }) => {
    const out: Record<string, string> = {};
    if (next.category) out.category = next.category;
    if (next.manufacturer) out.manufacturer = next.manufacturer;
    if (next.page && next.page > 1) out.page = String(next.page);
    router.replace({ pathname: '/equipment', params: out });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Equipment catalogue' }} />
      <Heading
        title="Equipment catalogue"
        subtitle="Browse machine models and their specifications."
      />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.sm }}>
        <View style={{ flex: wide ? 1 : undefined }}>
          <Select
            label="Category"
            value={category ?? ''}
            allowClear
            placeholder="Any category"
            loading={categoriesLoading}
            options={categories.map((c) => ({ value: c.code, label: c.displayName }))}
            onChange={(next) => show({ category: next, manufacturer: manufacturerId })}
          />
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <Select
            label="Manufacturer"
            value={manufacturerId ?? ''}
            allowClear
            placeholder="Any manufacturer"
            loading={manufacturersLoading}
            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(next) => show({ category, manufacturer: next })}
          />
        </View>
      </View>
      <ErrorMessage message={models.error ? formErrorsFromApi(models.error).form : null} />
      {models.isLoading || waitingForName ? (
        <LoadingIndicator />
      ) : models.data && models.data.items.length > 0 ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {models.data.items.map((model) => (
              <Pressable
                key={model.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: '/equipment/[id]', params: { id: model.id } })
                }
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 220,
                  padding: theme.spacing.md,
                  gap: theme.spacing.xs,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.md,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                  {manufacturersById.get(model.manufacturerId)?.name ?? ''}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSize.md,
                    fontWeight: '600',
                  }}
                >
                  {model.modelName}
                  {model.modelCode ? ` (${model.modelCode})` : ''}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                  {categoriesById.get(model.categoryId)?.displayName ?? ''}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={models.data.total}
            onChange={(next) => show({ category, manufacturer: manufacturerId, page: next })}
          />
        </>
      ) : models.data ? (
        <EmptyState title="No models found" message="Try a different category or manufacturer." />
      ) : null}
    </Screen>
  );
}
