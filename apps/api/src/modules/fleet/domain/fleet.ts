import type { AssetIdentifier, UnitCondition, UnitStatus } from '@ee/contracts';

export interface CityRef {
  geoId: string;
  name: string;
}

export interface YardFields {
  name: string;
  cityId: string;
  address: string;
}

export interface YardView {
  id: string;
  supplierProfileId: string;
  name: string;
  city: CityRef;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitFields {
  listingId: string;
  yardId: string;
  modelYear: number;
  condition: UnitCondition;
  label: string | null;
}

/** Everything about a unit that can change after creation; the listing is fixed. */
export interface UnitPatch {
  yardId?: string;
  modelYear?: number;
  condition?: UnitCondition;
  label?: string | null;
  /** Replaces the whole set when present. */
  identifiers?: AssetIdentifier[];
}

export interface UnitView {
  id: string;
  supplierProfileId: string;
  listing: { id: string; title: string };
  model: { id: string; modelName: string; manufacturer: { id: string; name: string } };
  yard: { id: string; name: string; city: CityRef };
  modelYear: number;
  condition: UnitCondition;
  label: string | null;
  status: UnitStatus;
  identifiers: AssetIdentifier[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitFilters {
  listingId?: string;
  yardId?: string;
  status?: UnitStatus;
}

export interface YardUnitCounts {
  active: number;
  retired: number;
}

/** Unique constraints whose violations we turn into friendly 409s. */
export const YARD_NAME_CONSTRAINT = 'yards_supplier_name_idx';
export const IDENTIFIER_CONSTRAINT = 'asset_identifiers_supplier_type_value_idx';
