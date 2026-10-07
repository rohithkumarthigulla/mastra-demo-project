import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createYardRequestSchema,
  updateYardRequestSchema,
  type CreateYardRequest,
  type UpdateYardRequest,
  type YardDto,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { FleetService } from '../application';
import { YardIdPipe, toYardDto } from './dto';

@Controller('fleet/yards')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class FleetYardsController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<YardDto[]> {
    return (await this.fleet.listYards(user.accountId)).map(toYardDto);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createYardRequestSchema)) body: CreateYardRequest,
  ): Promise<YardDto> {
    return toYardDto(await this.fleet.createYard(user.accountId, body));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', YardIdPipe) id: string,
    @Body(new ZodValidationPipe(updateYardRequestSchema)) body: UpdateYardRequest,
  ): Promise<YardDto> {
    return toYardDto(await this.fleet.updateYard(user.accountId, id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', YardIdPipe) id: string): Promise<void> {
    await this.fleet.deleteYard(user.accountId, id);
  }
}
