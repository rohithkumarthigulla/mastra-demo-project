import type { City, EntityType } from '../domain';

const city = (geoId: string, name: string, state: string, enabled = false): City => ({
  geoId,
  name,
  state,
  enabled,
});

/** Major Indian cities; the marketplace launches in the enabled ones. */
export const seedCities: City[] = [
  city('IN-HYD', 'Hyderabad', 'Telangana', true),
  city('IN-BLR', 'Bengaluru', 'Karnataka', true),
  city('IN-BOM', 'Mumbai', 'Maharashtra', true),
  city('IN-DEL', 'Delhi', 'Delhi', true),
  city('IN-MAA', 'Chennai', 'Tamil Nadu', true),
  city('IN-PNQ', 'Pune', 'Maharashtra', true),
  city('IN-CCU', 'Kolkata', 'West Bengal'),
  city('IN-AMD', 'Ahmedabad', 'Gujarat'),
  city('IN-JAI', 'Jaipur', 'Rajasthan'),
  city('IN-LKO', 'Lucknow', 'Uttar Pradesh'),
  city('IN-COK', 'Kochi', 'Kerala'),
  city('IN-VTZ', 'Visakhapatnam', 'Andhra Pradesh'),
  city('IN-NAG', 'Nagpur', 'Maharashtra'),
  city('IN-IDR', 'Indore', 'Madhya Pradesh'),
  city('IN-CJB', 'Coimbatore', 'Tamil Nadu'),
  city('IN-IXC', 'Chandigarh', 'Chandigarh'),
];

export const seedEntityTypes: EntityType[] = [
  { code: 'SOLE_PROPRIETORSHIP', name: 'Sole proprietorship' },
  { code: 'PARTNERSHIP', name: 'Partnership firm' },
  { code: 'LLP', name: 'Limited liability partnership' },
  { code: 'PRIVATE_LIMITED', name: 'Private limited company' },
  { code: 'PUBLIC_LIMITED', name: 'Public limited company' },
];
