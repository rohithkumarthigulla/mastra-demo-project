import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  addCapabilityLinkRequestSchema,
  createEquipmentModelRequestSchema,
  createEquipmentSpecificationRequestSchema,
  listEquipmentModelsQuerySchema,
  updateEquipmentSpecificationRequestSchema,
  type AddCapabilityLinkRequest,
  type CapabilityLinkDto,
  type CreateEquipmentModelRequest,
  type CreateEquipmentSpecificationRequest,
  type EquipmentModelDetailDto,
  type EquipmentModelDto,
  type EquipmentModelPageDto,
  type EquipmentSpecificationDto,
  type ListEquipmentModelsQuery,
  type UpdateEquipmentSpecificationRequest,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import {
  capabilityLinkToDto,
  modelDetailToDto,
  modelToDto,
  specificationToDto,
  uuidPipe,
} from './dto';

@Controller('equipment-models')
export class EquipmentModelsController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listEquipmentModelsQuerySchema)) query: ListEquipmentModelsQuery,
  ): Promise<EquipmentModelPageDto> {
    const page = await this.knowledge.searchModels(query);
    return {
      items: page.items.map(modelToDto),
      limit: query.limit,
      offset: query.offset,
      total: page.total,
    };
  }

  @Get(':id')
  async get(@Param('id', uuidPipe) id: string): Promise<EquipmentModelDetailDto> {
    return modelDetailToDto(await this.knowledge.getModel(id));
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createEquipmentModelRequestSchema))
    body: CreateEquipmentModelRequest,
  ): Promise<EquipmentModelDto> {
    return modelToDto(await this.knowledge.createModel(body));
  }

  @Post(':id/specifications')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addSpecification(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(createEquipmentSpecificationRequestSchema))
    body: CreateEquipmentSpecificationRequest,
  ): Promise<EquipmentSpecificationDto> {
    return specificationToDto(await this.knowledge.addSpecification(id, body));
  }

  @Patch(':id/specifications/:specificationId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateSpecification(
    @Param('id', uuidPipe) id: string,
    @Param('specificationId', uuidPipe) specificationId: string,
    @Body(new ZodValidationPipe(updateEquipmentSpecificationRequestSchema))
    body: UpdateEquipmentSpecificationRequest,
  ): Promise<EquipmentSpecificationDto> {
    return specificationToDto(await this.knowledge.updateSpecification(id, specificationId, body));
  }

  @Get(':id/capabilities')
  async listCapabilities(@Param('id', uuidPipe) id: string): Promise<CapabilityLinkDto[]> {
    return (await this.knowledge.listModelCapabilities(id)).map(capabilityLinkToDto);
  }

  @Post(':id/capabilities')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addCapability(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(addCapabilityLinkRequestSchema)) body: AddCapabilityLinkRequest,
  ): Promise<CapabilityLinkDto> {
    return capabilityLinkToDto(await this.knowledge.addModelCapability(id, body));
  }
}
