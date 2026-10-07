import { ConflictError, DomainError, NotFoundError } from '../../../platform/http';

export class BlockNotFoundError extends NotFoundError {
  constructor() {
    super('block_not_found', 'Block not found');
  }
}

export class BlockOverlapError extends ConflictError {
  constructor() {
    super('block_overlap', 'This machine is already blocked for part of that time');
  }
}

export class BlockAlreadyLiftedError extends ConflictError {
  constructor() {
    super('block_already_lifted', 'This block has already been lifted');
  }
}

export class BlockInPastError extends DomainError {
  constructor() {
    super('block_in_past', 'A block cannot start in the past');
  }
}

export class PublicListingNotFoundError extends NotFoundError {
  constructor() {
    super('listing_not_found', 'Listing not found');
  }
}
