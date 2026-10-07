import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createCapabilityRequestSchema,
  knowledgeCodeSchema,
  listCapabilityTasksQuerySchema,
  type CapabilityDto,
  type CapabilityModelDto,
  type CapabilityTaskDto,
  type CreateCapabilityRequest,
  type ListCapabilityTasksQuery,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { capabilityModelToDto, capabilityTaskToDto, capabilityToDto } from './dto';

const codePipe = new ZodValidationPipe(knowledgeCodeSchema);

@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<CapabilityDto[]> {
    return (await this.knowledge.listCapabilities()).map(capabilityToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createCapabilityRequestSchema)) body: CreateCapabilityRequest,
  ): Promise<CapabilityDto> {
    return capabilityToDto(await this.knowledge.createCapability(body));
  }

  @Get(':code')
  async get(@Param('code', codePipe) code: string): Promise<CapabilityDto> {
    return capabilityToDto(await this.knowledge.getCapability(code));
  }

  /** Models with a direct link only; category links are not expanded into models. */
  @Get(':code/equipment-models')
  async listModels(@Param('code', codePipe) code: string): Promise<CapabilityModelDto[]> {
    return (await this.knowledge.listCapabilityModels(code)).map(capabilityModelToDto);
  }

  @Get(':code/construction-tasks')
  async listTasks(
    @Param('code', codePipe) code: string,
    @Query(new ZodValidationPipe(listCapabilityTasksQuerySchema)) query: ListCapabilityTasksQuery,
  ): Promise<CapabilityTaskDto[]> {
    return (await this.knowledge.listCapabilityTasks(code, query.importance)).map(
      capabilityTaskToDto,
    );
  }
}
