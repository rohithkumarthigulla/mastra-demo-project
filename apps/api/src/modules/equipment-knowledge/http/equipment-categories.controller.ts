import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  createEquipmentCategoryRequestSchema,
  type CreateEquipmentCategoryRequest,
  type EquipmentCategoryDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { categoryToDto } from './dto';

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
}
