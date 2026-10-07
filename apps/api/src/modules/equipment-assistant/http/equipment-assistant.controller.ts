import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  sendChatMessageSchema,
  type AssistantConversationDetailDto,
  type AssistantReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type SendChatMessageRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('equipment-assistant/conversations')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BUILDER')
export class EquipmentAssistantController {
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationRequest,
  ): Promise<ConversationDto> {
    return notImplemented(user, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listConversationsQuerySchema)) query: ListConversationsQuery,
  ): Promise<ConversationPageDto> {
    return notImplemented(user, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<AssistantConversationDetailDto> {
    return notImplemented(user, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendChatMessageSchema)) body: SendChatMessageRequest,
  ): Promise<AssistantReplyDto> {
    return notImplemented(user, id, body);
  }
}
