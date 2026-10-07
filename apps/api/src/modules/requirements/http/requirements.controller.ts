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
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('requirements')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BUILDER')
export class RequirementsController {
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRequirementSchema)) body: CreateRequirementRequest,
  ): Promise<RequirementDto> {
    return notImplemented(user, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listRequirementsQuerySchema)) query: ListRequirementsQuery,
  ): Promise<RequirementPageDto> {
    return notImplemented(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RequirementDetailDto> {
    return notImplemented(user, id);
  }

  /** Only while `DRAFT`. */
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(updateRequirementSchema)) body: UpdateRequirementRequest,
  ): Promise<RequirementDto> {
    return notImplemented(user, id, body);
  }

  /** Active listings in the requirement's city and category with a free unit for the dates. */
  @Get(':id/matches')
  matches(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(requirementMatchesQuerySchema)) query: RequirementMatchesQuery,
  ): Promise<RequirementMatchPageDto> {
    return notImplemented(user, id, query);
  }

  /** Invites each listing as a rental request; moves `DRAFT` to `OPEN`. */
  @Post(':id/send')
  @HttpCode(200)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendRequirementSchema)) body: SendRequirementRequest,
  ): Promise<SendRequirementResponse> {
    return notImplemented(user, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<RequirementDto> {
    return notImplemented(user, id);
  }
}
