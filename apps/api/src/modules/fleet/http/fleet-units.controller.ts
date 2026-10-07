import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createUnitRequestSchema,
  listUnitsQuerySchema,
  updateUnitRequestSchema,
  type CreateUnitRequest,
  type EquipmentUnitDto,
  type ListUnitsQuery,
  type UpdateUnitRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { FleetService } from '../application';
import { UnitIdPipe, toUnitDto } from './dto';

@Controller('fleet/units')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class FleetUnitsController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listUnitsQuerySchema)) query: ListUnitsQuery,
  ): Promise<EquipmentUnitDto[]> {
    return (await this.fleet.listUnits(user.accountId, query)).map(toUnitDto);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createUnitRequestSchema)) body: CreateUnitRequest,
  ): Promise<EquipmentUnitDto> {
    return toUnitDto(await this.fleet.createUnit(user.accountId, body));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', UnitIdPipe) id: string,
  ): Promise<EquipmentUnitDto> {
    return toUnitDto(await this.fleet.getUnit(user.accountId, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', UnitIdPipe) id: string,
    @Body(new ZodValidationPipe(updateUnitRequestSchema)) body: UpdateUnitRequest,
  ): Promise<EquipmentUnitDto> {
    return toUnitDto(await this.fleet.updateUnit(user.accountId, id, body));
  }

  @Post(':id/retire')
  @HttpCode(200)
  async retire(
    @CurrentUser() user: AuthUser,
    @Param('id', UnitIdPipe) id: string,
  ): Promise<EquipmentUnitDto> {
    return toUnitDto(await this.fleet.retireUnit(user.accountId, id));
  }
}
