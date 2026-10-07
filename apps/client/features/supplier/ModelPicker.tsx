import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSession } from '../auth';
import { queryKeys, useManufacturers } from '../rental';
import { Select, useDebounced } from '../ui';

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  error?: string;
  /** Shown when the current model isn't in the latest search results. */
  selectedLabel?: string;
}

/** Searches the equipment catalogue by model name, server-side. */
export function ModelPicker({ value, onChange, error, selectedLabel }: ModelPickerProps) {
  const { api } = useSession();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const { byId: manufacturers } = useManufacturers();
  const query = { model: term || undefined, limit: 50 };
  const models = useQuery({
    queryKey: queryKeys.models(query),
    queryFn: () => api.knowledge.models(query),
  });
  const [picked, setPicked] = useState<string>();

  const options = useMemo(
    () =>
      (models.data?.items ?? []).map((m) => {
        const maker = manufacturers.get(m.manufacturerId)?.name;
        return {
          value: m.id,
          label: maker ? `${maker} ${m.modelName}` : m.modelName,
          description: m.modelCode ?? undefined,
        };
      }),
    [models.data, manufacturers],
  );

  return (
    <Select
      label="Equipment model"
      placeholder="Search models"
      value={value}
      options={options}
      loading={models.isFetching}
      onSearch={setSearch}
      onChange={(next) => {
        setPicked(options.find((o) => o.value === next)?.label);
        onChange(next);
      }}
      selectedLabel={picked ?? selectedLabel}
      error={error}
    />
  );
}
