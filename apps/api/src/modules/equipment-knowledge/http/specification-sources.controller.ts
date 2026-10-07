import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  createSpecificationSourceRequestSchema,
  type CreateSpecificationSourceRequest,
  type SpecificationSourceDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { sourceToDto } from './dto';

@Controller('specification-sources')
export class SpecificationSourcesController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<SpecificationSourceDto[]> {
    return (await this.knowledge.listSources()).map(sourceToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createSpecificationSourceRequestSchema))
    body: CreateSpecificationSourceRequest,
  ): Promise<SpecificationSourceDto> {
    return sourceToDto(await this.knowledge.createSource(body));
  }
}
