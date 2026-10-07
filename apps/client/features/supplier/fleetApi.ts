// Typed calls for the live fleet and availability endpoints. apps/client/api has no
// module for these yet, so they wrap api.request with the contract schemas here.
import {
  equipmentUnitSchema,
  fleetCalendarSchema,
  maintenanceBlockSchema,
  unitCalendarSchema,
  yardSchema,
  type CalendarRangeQuery,
  type CreateBlockRequest,
  type CreateUnitRequest,
  type CreateYardRequest,
  type EquipmentUnitDto,
  type FleetCalendarDto,
  type ListUnitsQuery,
  type MaintenanceBlockDto,
  type UnitCalendarDto,
  type UpdateUnitRequest,
  type UpdateYardRequest,
  type YardDto,
} from '@ee/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toQueryString, type ApiClient } from '../../api/client';

const id = encodeURIComponent;
const yardsSchema = z.array(yardSchema);
const unitsSchema = z.array(equipmentUnitSchema);

export function fleetApi(api: ApiClient) {
  const { request } = api;
  return {
    yards: {
      list: (): Promise<YardDto[]> => request('/fleet/yards', { schema: yardsSchema }),
      create: (body: CreateYardRequest): Promise<YardDto> =>
        request('/fleet/yards', { method: 'POST', body, schema: yardSchema }),
      update: (yardId: string, body: UpdateYardRequest): Promise<YardDto> =>
        request(`/fleet/yards/${id(yardId)}`, { method: 'PATCH', body, schema: yardSchema }),
      remove: (yardId: string): Promise<void> =>
        request(`/fleet/yards/${id(yardId)}`, { method: 'DELETE' }),
    },
    units: {
      list: (query: ListUnitsQuery = {}): Promise<EquipmentUnitDto[]> =>
        request(`/fleet/units${toQueryString(query)}`, { schema: unitsSchema }),
      get: (unitId: string): Promise<EquipmentUnitDto> =>
        request(`/fleet/units/${id(unitId)}`, { schema: equipmentUnitSchema }),
      create: (body: CreateUnitRequest): Promise<EquipmentUnitDto> =>
        request('/fleet/units', { method: 'POST', body, schema: equipmentUnitSchema }),
      update: (unitId: string, body: UpdateUnitRequest): Promise<EquipmentUnitDto> =>
        request(`/fleet/units/${id(unitId)}`, {
          method: 'PATCH',
          body,
          schema: equipmentUnitSchema,
        }),
      retire: (unitId: string): Promise<EquipmentUnitDto> =>
        request(`/fleet/units/${id(unitId)}/retire`, {
          method: 'POST',
          schema: equipmentUnitSchema,
        }),
    },
    availability: {
      fleet: (range: CalendarRangeQuery): Promise<FleetCalendarDto> =>
        request(`/availability/fleet${toQueryString(range)}`, { schema: fleetCalendarSchema }),
      unit: (unitId: string, range: CalendarRangeQuery): Promise<UnitCalendarDto> =>
        request(`/availability/units/${id(unitId)}${toQueryString(range)}`, {
          schema: unitCalendarSchema,
        }),
      createBlock: (unitId: string, body: CreateBlockRequest): Promise<MaintenanceBlockDto> =>
        request(`/availability/units/${id(unitId)}/blocks`, {
          method: 'POST',
          body,
          schema: maintenanceBlockSchema,
        }),
      liftBlock: (blockId: string): Promise<MaintenanceBlockDto> =>
        request(`/availability/blocks/${id(blockId)}`, {
          method: 'DELETE',
          schema: maintenanceBlockSchema,
        }),
    },
  };
}

export const fleetKeys = {
  all: ['fleet'] as const,
  yards: ['fleet', 'yards'] as const,
  units: (query: ListUnitsQuery = {}) => ['fleet', 'units', query] as const,
  unit: (unitId: string) => ['fleet', 'unit', unitId] as const,
  calendar: (range: CalendarRangeQuery) => ['fleet', 'calendar', range] as const,
};

/** Fleet changes affect yards, units and calendars, so refetch all of them. */
export function useRefreshFleet() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: fleetKeys.all });
}

export function useYards(api: ApiClient) {
  return useQuery({ queryKey: fleetKeys.yards, queryFn: () => fleetApi(api).yards.list() });
}

export function useUnits(api: ApiClient, query: ListUnitsQuery = {}, enabled = true) {
  return useQuery({
    queryKey: fleetKeys.units(query),
    queryFn: () => fleetApi(api).units.list(query),
    enabled,
  });
}

export function useUnit(api: ApiClient, unitId: string) {
  return useQuery({
    queryKey: fleetKeys.unit(unitId),
    queryFn: () => fleetApi(api).units.get(unitId),
  });
}

export function useFleetCalendar(api: ApiClient, range: CalendarRangeQuery, enabled = true) {
  return useQuery({
    queryKey: fleetKeys.calendar(range),
    queryFn: () => fleetApi(api).availability.fleet(range),
    enabled,
  });
}

/** A mutation over the fleet api that refetches fleet data when it succeeds. */
export function useFleetMutation<TArgs, TResult>(
  api: ApiClient,
  run: (calls: ReturnType<typeof fleetApi>, args: TArgs) => Promise<TResult>,
) {
  const refresh = useRefreshFleet();
  return useMutation({ mutationFn: (args: TArgs) => run(fleetApi(api), args), onSuccess: refresh });
}
