import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  createManufacturerRequestSchema,
  type CreateManufacturerRequest,
  type ManufacturerDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { manufacturerToDto } from './dto';

@Controller('manufacturers')
export class ManufacturersController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<ManufacturerDto[]> {
    return (await this.knowledge.listManufacturers()).map(manufacturerToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createManufacturerRequestSchema)) body: CreateManufacturerRequest,
  ): Promise<ManufacturerDto> {
    return manufacturerToDto(await this.knowledge.createManufacturer(body));
  }
}
