import { listingAvailabilitySchema, type ListingAvailabilityDto } from '@ee/contracts';
import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api';

const DAY_MS = 24 * 60 * 60 * 1000;
const KOLKATA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** `[from, to)` instants covering whole rental days in Asia/Kolkata, as the api expects. */
export function availabilityRange(startDate: string, endDate: string) {
  const midnight = (date: string, plusDays: number) =>
    new Date(Date.parse(`${date}T00:00:00Z`) + plusDays * DAY_MS - KOLKATA_OFFSET_MS).toISOString();
  return { from: midnight(startDate, 0), to: midnight(endDate, 1) };
}

/**
 * Public unit counts for a listing over the chosen dates. The typed client has no call for
 * this endpoint yet, so it goes through `api.request` with the contract schema.
 */
export function useListingAvailability(
  api: ApiClient,
  listingId: string,
  range: { startDate: string; endDate: string } | null,
) {
  return useQuery({
    queryKey: ['listings', listingId, 'availability', range] as const,
    queryFn: (): Promise<ListingAvailabilityDto> => {
      const { from, to } = availabilityRange(range!.startDate, range!.endDate);
      const qs = new URLSearchParams({ from, to }).toString();
      return api.request(
        `/equipment-listings/${encodeURIComponent(listingId)}/availability?${qs}`,
        {
          schema: listingAvailabilitySchema,
          auth: false,
        },
      );
    },
    enabled: range !== null,
  });
}
