import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { LISTING_KEY_ROOTS } from '../rental';

/** Refetches every listing list and detail after a supplier changes one. */
export function useRefreshListings() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all(
        LISTING_KEY_ROOTS.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      ),
    [queryClient],
  );
}
