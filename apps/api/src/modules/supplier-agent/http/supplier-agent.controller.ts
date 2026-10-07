import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  sendChatMessageSchema,
  type AgentConversationDetailDto,
  type AgentReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PendingActionDto,
  type SendChatMessageRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('supplier-agent')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierAgentController {
  @Post('conversations')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationRequest,
  ): Promise<ConversationDto> {
    return notImplemented(user, body);
  }

  @Get('conversations')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listConversationsQuerySchema)) query: ListConversationsQuery,
  ): Promise<ConversationPageDto> {
    return notImplemented(user, query);
  }

  @Get('conversations/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<AgentConversationDetailDto> {
    return notImplemented(user, id);
  }

  /** The agent never changes data here; it may propose a pending action instead. */
  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendChatMessageSchema)) body: SendChatMessageRequest,
  ): Promise<AgentReplyDto> {
    return notImplemented(user, id, body);
  }

  /** Applies the proposed change; the only way the agent alters supplier data. */
  @Post('actions/:id/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<PendingActionDto> {
    return notImplemented(user, id);
  }

  @Post('actions/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<PendingActionDto> {
    return notImplemented(user, id);
  }
}
