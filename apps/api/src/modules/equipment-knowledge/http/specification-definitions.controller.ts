import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  createSpecificationDefinitionRequestSchema,
  type CreateSpecificationDefinitionRequest,
  type SpecificationDefinitionDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { definitionToDto } from './dto';

@Controller('specification-definitions')
export class SpecificationDefinitionsController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<SpecificationDefinitionDto[]> {
    return (await this.knowledge.listDefinitions()).map(definitionToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createSpecificationDefinitionRequestSchema))
    body: CreateSpecificationDefinitionRequest,
  ): Promise<SpecificationDefinitionDto> {
    return definitionToDto(await this.knowledge.createDefinition(body));
  }
}
