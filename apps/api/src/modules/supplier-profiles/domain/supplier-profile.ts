export const SUPPLIER_PROFILE_REPOSITORY = Symbol('SUPPLIER_PROFILE_REPOSITORY');

export interface SupplierProfile {
  id: string;
  accountId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierProfileRepository {
  findByAccountId(accountId: string): Promise<SupplierProfile | null>;
  /** Throws `SupplierProfileExistsError` if the account already has a profile. */
  create(profile: { accountId: string; displayName: string }): Promise<SupplierProfile>;
  /** Returns null if the account has no profile. */
  updateDisplayName(
    accountId: string,
    displayName: string,
    updatedAt: Date,
  ): Promise<SupplierProfile | null>;
}
