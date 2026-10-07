import type { CalendarDate, RequirementStatus } from '@ee/contracts';
import type { DbExecutor } from '../../notifications/domain';
import type {
  Invitation,
  Requirement,
  RequirementMatch,
  SendTarget,
  TimeRange,
} from './requirement';

export const REQUIREMENTS_REPOSITORY = Symbol('REQUIREMENTS_REPOSITORY');

export interface ReferenceCodes {
  categoryCode?: string;
  equipmentModelId?: string | null;
  constructionTaskCode?: string | null;
  cityGeoId?: string;
}

/** Ids for the codes that were given; `null` where a given code is unknown or unusable. */
export interface ResolvedReferences {
  categoryId?: string | null;
  /** Category of the model, so the service can check it matches the requirement. */
  equipmentModel?: { id: string; categoryId: string } | null;
  constructionTaskId?: string | null;
  cityId?: string | null;
}

export interface RequirementFields {
  title: string;
  categoryId: string;
  equipmentModelId: string | null;
  constructionTaskId: string | null;
  cityId: string;
  startDate: CalendarDate;
  endDate: CalendarDate;
  quantity: number;
  budgetPerDay: number | null;
  notes: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
}

export interface Paging {
  limit: number;
  offset: number;
}

/** A pending invitation closed by a cancellation, with who to tell. */
export interface WithdrawnInvitation {
  rentalRequestId: string;
  listingTitle: string;
  supplierAccountId: string;
}

export interface RequirementsRepository {
  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;

  resolveReferences(codes: ReferenceCodes): Promise<ResolvedReferences>;
  /** Category id of a stored requirement, used when a PATCH changes only the model. */
  categoryIdOf(requirementId: string): Promise<string>;

  create(builderAccountId: string, fields: RequirementFields, now: Date): Promise<string>;
  update(id: string, fields: Partial<RequirementFields>, now: Date): Promise<void>;

  /** Only the builder's own requirement; `lock` takes a row lock inside `tx`. */
  find(
    builderAccountId: string,
    id: string,
    opts?: { tx?: DbExecutor; lock?: boolean },
  ): Promise<Requirement | null>;
  list(
    builderAccountId: string,
    query: Paging & { status?: RequirementStatus },
  ): Promise<Page<Requirement>>;
  invitations(requirementId: string, tx?: DbExecutor): Promise<Invitation[]>;

  matches(
    requirement: Requirement,
    range: TimeRange,
    paging: Paging,
  ): Promise<Page<RequirementMatch>>;

  invitedListingIds(requirementId: string, tx: DbExecutor): Promise<Set<string>>;
  sendTargets(listingIds: string[], range: TimeRange, tx: DbExecutor): Promise<SendTarget[]>;
  /** Inserts `PENDING` rental requests; returns the listing ids that were actually inserted. */
  insertInvitations(
    requirement: Requirement,
    listingIds: string[],
    message: string | null,
    now: Date,
    tx: DbExecutor,
  ): Promise<string[]>;
  markOpen(id: string, now: Date, tx: DbExecutor): Promise<void>;

  /**
   * Cancels the requirement, withdraws its `PENDING` invitations and expires their open
   * quotes. Returns the withdrawn invitations.
   */
  cancel(id: string, now: Date, tx: DbExecutor): Promise<WithdrawnInvitation[]>;
}
