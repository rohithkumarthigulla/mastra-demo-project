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
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { EquipmentAssistantService } from '../application';

@Controller('equipment-assistant/conversations')
@UseGuards(AuthGuard, RolesGuard)
@Roles('BUILDER')
export class EquipmentAssistantController {
  constructor(private readonly assistant: EquipmentAssistantService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationRequest,
  ): Promise<ConversationDto> {
    return this.assistant.create(user.accountId, body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listConversationsQuerySchema)) query: ListConversationsQuery,
  ): Promise<ConversationPageDto> {
    return this.assistant.list(user.accountId, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<AssistantConversationDetailDto> {
    return this.assistant.get(user.accountId, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendChatMessageSchema)) body: SendChatMessageRequest,
  ): Promise<AssistantReplyDto> {
    return this.assistant.send(user.accountId, id, body.content);
  }
}
