import type { ListingStatus } from '@ee/contracts';

export type { ListingStatus };
export type ListingAction = 'publish' | 'deactivate';

export interface ListingPhoto {
  id: string;
  mimeType: string;
  position: number;
}

/** A listing joined with everything a reader needs to display it. */
export interface ListingView {
  id: string;
  supplierProfileId: string;
  status: ListingStatus;
  title: string;
  description: string;
  location: string;
  pricePerDay: number;
  model: {
    id: string;
    modelName: string;
    manufacturer: { id: string; name: string };
    category: { code: string; displayName: string };
  };
  city: { geoId: string; name: string };
  supplier: { id: string; displayName: string };
  /** Ordered by position; the first is the cover photo. */
  photos: ListingPhoto[];
  createdAt: Date;
  updatedAt: Date;
}

const TRANSITIONS: Record<ListingAction, Partial<Record<ListingStatus, ListingStatus>>> = {
  publish: { DRAFT: 'ACTIVE', INACTIVE: 'ACTIVE' },
  deactivate: { ACTIVE: 'INACTIVE' },
};

/** The status an action leads to, or null if the action is not allowed from `current`. */
export function nextStatus(current: ListingStatus, action: ListingAction): ListingStatus | null {
  return TRANSITIONS[action][current] ?? null;
}
