import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '../auth';
import { queryKeys } from './queryKeys';

// Reference data barely changes; keep it for the session.
const STATIC = { staleTime: 60 * 60 * 1000 } as const;

export function useCities() {
  const { api } = useSession();
  const query = useQuery({ queryKey: queryKeys.reference, queryFn: api.reference.get, ...STATIC });
  const cities = useMemo(() => (query.data?.cities ?? []).filter((c) => c.enabled), [query.data]);
  return { ...query, cities };
}

export function useManufacturers() {
  const { api } = useSession();
  const query = useQuery({
    queryKey: queryKeys.manufacturers,
    queryFn: api.knowledge.manufacturers,
    ...STATIC,
  });
  const byId = useMemo(() => new Map((query.data ?? []).map((m) => [m.id, m])), [query.data]);
  return { ...query, manufacturers: query.data ?? [], byId };
}

export function useCategories() {
  const { api } = useSession();
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: api.knowledge.categories,
    ...STATIC,
  });
  const byId = useMemo(() => new Map((query.data ?? []).map((c) => [c.id, c])), [query.data]);
  return { ...query, categories: query.data ?? [], byId };
}

export function useSpecificationDefinitions() {
  const { api } = useSession();
  return useQuery({
    queryKey: queryKeys.specificationDefinitions,
    queryFn: api.knowledge.specificationDefinitions,
    ...STATIC,
  });
}
