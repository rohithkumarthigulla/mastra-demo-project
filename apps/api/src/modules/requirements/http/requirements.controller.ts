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
  createRequirementSchema,
  listRequirementsQuerySchema,
  requirementMatchesQuerySchema,
  sendRequirementSchema,
  updateRequirementSchema,
  type CreateRequirementRequest,
  type ListRequirementsQuery,
  type RequirementDetailDto,
  type RequirementDto,
  type RequirementMatchesQuery,
  type RequirementMatchPageDto,
  type RequirementPageDto,
  type SendRequirementRequest,
  type SendRequirementResponse,
  type UpdateRequirementRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { RequirementsService } from '../application';
import { toInvitationDto, toMatchDto, toRequirementDetailDto, toRequirementDto } from './dto';

@Controller('requirements')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BUILDER')
export class RequirementsController {
  constructor(private readonly requirements: RequirementsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRequirementSchema)) body: CreateRequirementRequest,
  ): Promise<RequirementDto> {
    return toRequirementDto(await this.requirements.create(user.accountId, body));
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listRequirementsQuerySchema)) query: ListRequirementsQuery,
  ): Promise<RequirementPageDto> {
    const page = await this.requirements.list(user.accountId, query);
    return {
      ...page,
      items: page.items.map(toRequirementDto),
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RequirementDetailDto> {
    return toRequirementDetailDto(await this.requirements.detail(user.accountId, id));
  }

  /** Only while `DRAFT`. */
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(updateRequirementSchema)) body: UpdateRequirementRequest,
  ): Promise<RequirementDto> {
    return toRequirementDto(await this.requirements.update(user.accountId, id, body));
  }

  /** Active listings in the requirement's city and category with a free unit for the dates. */
  @Get(':id/matches')
  async matches(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(requirementMatchesQuerySchema)) query: RequirementMatchesQuery,
  ): Promise<RequirementMatchPageDto> {
    const page = await this.requirements.matches(user.accountId, id, query);
    return { ...page, items: page.items.map(toMatchDto), limit: query.limit, offset: query.offset };
  }

  /** Invites each listing as a rental request; moves `DRAFT` to `OPEN`. */
  @Post(':id/send')
  @HttpCode(200)
  async send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendRequirementSchema)) body: SendRequirementRequest,
  ): Promise<SendRequirementResponse> {
    const result = await this.requirements.send(user.accountId, id, body);
    return { sent: result.sent.map(toInvitationDto), skipped: result.skipped };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RequirementDto> {
    return toRequirementDto(await this.requirements.cancel(user.accountId, id));
  }
}
