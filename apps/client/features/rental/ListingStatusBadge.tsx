import type { ListingStatus } from '@ee/contracts';
import { Badge, type BadgeTone } from '../ui';

const STATUS: Record<ListingStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ACTIVE: { label: 'Active', tone: 'positive' },
  INACTIVE: { label: 'Inactive', tone: 'warning' },
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge {...STATUS[status]} />;
}
