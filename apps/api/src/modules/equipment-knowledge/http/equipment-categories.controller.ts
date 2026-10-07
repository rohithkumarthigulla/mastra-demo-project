import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  addCapabilityLinkRequestSchema,
  createEquipmentCategoryRequestSchema,
  type AddCapabilityLinkRequest,
  type CapabilityLinkDto,
  type CategoryTaskDto,
  type CreateEquipmentCategoryRequest,
  type EquipmentCategoryDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { capabilityLinkToDto, categoryTaskToDto, categoryToDto, uuidPipe } from './dto';

@Controller('equipment-categories')
export class EquipmentCategoriesController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<EquipmentCategoryDto[]> {
    return (await this.knowledge.listCategories()).map(categoryToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createEquipmentCategoryRequestSchema))
    body: CreateEquipmentCategoryRequest,
  ): Promise<EquipmentCategoryDto> {
    return categoryToDto(await this.knowledge.createCategory(body));
  }

  /** Capabilities recorded for the category itself; they are not copied onto its models. */
  @Get(':id/capabilities')
  async listCapabilities(@Param('id', uuidPipe) id: string): Promise<CapabilityLinkDto[]> {
    return (await this.knowledge.listCategoryCapabilities(id)).map(capabilityLinkToDto);
  }

  @Post(':id/capabilities')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addCapability(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(addCapabilityLinkRequestSchema)) body: AddCapabilityLinkRequest,
  ): Promise<CapabilityLinkDto> {
    return capabilityLinkToDto(await this.knowledge.addCategoryCapability(id, body));
  }

  @Get(':id/construction-tasks')
  async listTasks(@Param('id', uuidPipe) id: string): Promise<CategoryTaskDto[]> {
    return (await this.knowledge.listCategoryTasks(id)).map(categoryTaskToDto);
  }
}
