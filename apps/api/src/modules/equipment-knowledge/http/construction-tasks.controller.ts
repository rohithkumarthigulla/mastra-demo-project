import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  addTaskCapabilityRequestSchema,
  addTaskCategoryRequestSchema,
  createConstructionTaskRequestSchema,
  type AddTaskCapabilityRequest,
  type AddTaskCategoryRequest,
  type ConstructionTaskDto,
  type CreateConstructionTaskRequest,
  type TaskCapabilityDto,
  type TaskCategoryDto,
} from '@ee/contracts';
import { AuthGuard, Roles, RolesGuard } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentKnowledgeService } from '../application';
import { constructionTaskToDto, taskCapabilityToDto, taskCategoryToDto, uuidPipe } from './dto';

@Controller('construction-tasks')
export class ConstructionTasksController {
  constructor(private readonly knowledge: EquipmentKnowledgeService) {}

  @Get()
  async list(): Promise<ConstructionTaskDto[]> {
    return (await this.knowledge.listConstructionTasks()).map(constructionTaskToDto);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body(new ZodValidationPipe(createConstructionTaskRequestSchema))
    body: CreateConstructionTaskRequest,
  ): Promise<ConstructionTaskDto> {
    return constructionTaskToDto(await this.knowledge.createConstructionTask(body));
  }

  @Get(':id')
  async get(@Param('id', uuidPipe) id: string): Promise<ConstructionTaskDto> {
    return constructionTaskToDto(await this.knowledge.getConstructionTask(id));
  }

  @Get(':id/capabilities')
  async listCapabilities(@Param('id', uuidPipe) id: string): Promise<TaskCapabilityDto[]> {
    return (await this.knowledge.listTaskCapabilities(id)).map(taskCapabilityToDto);
  }

  @Post(':id/capabilities')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addCapability(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(addTaskCapabilityRequestSchema)) body: AddTaskCapabilityRequest,
  ): Promise<TaskCapabilityDto> {
    return taskCapabilityToDto(await this.knowledge.addTaskCapability(id, body));
  }

  @Get(':id/equipment-categories')
  async listCategories(@Param('id', uuidPipe) id: string): Promise<TaskCategoryDto[]> {
    return (await this.knowledge.listTaskCategories(id)).map(taskCategoryToDto);
  }

  @Post(':id/equipment-categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addCategory(
    @Param('id', uuidPipe) id: string,
    @Body(new ZodValidationPipe(addTaskCategoryRequestSchema)) body: AddTaskCategoryRequest,
  ): Promise<TaskCategoryDto> {
    return taskCategoryToDto(await this.knowledge.addTaskCategory(id, body));
  }
}
