import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  calendarRangeQuerySchema,
  createBlockRequestSchema,
  type CalendarRangeQuery,
  type CreateBlockRequest,
  type FleetCalendarDto,
  type MaintenanceBlockDto,
  type UnitCalendarDto,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { UnitIdPipe } from '../../fleet/http/dto';
import { AvailabilityService } from '../application';
import { BlockIdPipe, toBlockDto, toUnitCalendarDto } from './dto';

const toRange = (query: CalendarRangeQuery) => ({
  start: new Date(query.from),
  end: new Date(query.to),
});

@Controller('availability')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post('units/:unitId/blocks')
  async createBlock(
    @CurrentUser() user: AuthUser,
    @Param('unitId', UnitIdPipe) unitId: string,
    @Body(new ZodValidationPipe(createBlockRequestSchema)) body: CreateBlockRequest,
  ): Promise<MaintenanceBlockDto> {
    return toBlockDto(await this.availability.createBlock(user.accountId, unitId, body));
  }

  /** Lifts the block; it is kept for history. */
  @Delete('blocks/:blockId')
  async liftBlock(
    @CurrentUser() user: AuthUser,
    @Param('blockId', BlockIdPipe) blockId: string,
  ): Promise<MaintenanceBlockDto> {
    return toBlockDto(await this.availability.liftBlock(user.accountId, blockId));
  }

  @Get('units/:unitId')
  async unitCalendar(
    @CurrentUser() user: AuthUser,
    @Param('unitId', UnitIdPipe) unitId: string,
    @Query(new ZodValidationPipe(calendarRangeQuerySchema)) query: CalendarRangeQuery,
  ): Promise<UnitCalendarDto> {
    return toUnitCalendarDto(
      await this.availability.unitCalendar(user.accountId, unitId, toRange(query)),
    );
  }

  @Get('fleet')
  async fleetCalendar(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(calendarRangeQuerySchema)) query: CalendarRangeQuery,
  ): Promise<FleetCalendarDto> {
    const range = toRange(query);
    const lanes = await this.availability.fleetCalendar(user.accountId, range);
    return {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      lanes: lanes.map(toUnitCalendarDto),
    };
  }
}
