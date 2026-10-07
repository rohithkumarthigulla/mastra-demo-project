import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  sendAgentMessageSchema,
  synthesizeQuerySchema,
  transcribeQuerySchema,
  type AgentConversationDetailDto,
  type AgentProgressDto,
  type AgentReplyDto,
  type ConversationDto,
  type ConversationPageDto,
  type CreateConversationRequest,
  type ListConversationsQuery,
  type PendingActionDto,
  type SendAgentMessageRequest,
  type SpeechStatusDto,
  type SynthesizeQuery,
  type TranscribeQuery,
  type TranscriptionDto,
} from '@ee/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SpeechAudio } from '../../ai/domain';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { AgentSpeechService, SupplierAgentService } from '../application';
import { AudioTooLargeError, InvalidAudioError } from '../domain';

@Controller('supplier-agent')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierAgentController {
  constructor(
    private readonly agent: SupplierAgentService,
    private readonly speech: AgentSpeechService,
  ) {}

  @Post('conversations')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationRequest,
  ): Promise<ConversationDto> {
    return this.agent.create(user.accountId, body);
  }

  @Get('conversations')
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listConversationsQuerySchema)) query: ListConversationsQuery,
  ): Promise<ConversationPageDto> {
    return this.agent.list(user.accountId, query);
  }

  @Get('conversations/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<AgentConversationDetailDto> {
    return this.agent.get(user.accountId, id);
  }

  /** The agent never changes data here; it may propose a pending action instead. */
  @Post('conversations/:id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(sendAgentMessageSchema)) body: SendAgentMessageRequest,
  ): Promise<AgentReplyDto> {
    return this.agent.send(user.accountId, id, body);
  }

  /** What the agent is doing for the reply in flight (plain activity, never tool names). */
  @Get('conversations/:id/progress')
  progress(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<AgentProgressDto> {
    return this.agent.progress(user.accountId, id);
  }

  /** Applies the proposed change; the only way the agent alters supplier data. */
  @Post('actions/:id/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<PendingActionDto> {
    return this.agent.confirm(user.accountId, id);
  }

  @Post('actions/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<PendingActionDto> {
    return this.agent.cancel(user.accountId, id);
  }

  /** Voice is offered only when this is enabled. */
  @Get('speech')
  speechStatus(): SpeechStatusDto {
    return this.speech.status();
  }

  @Post('speech/transcribe')
  @HttpCode(200)
  async transcribe(
    @Req() request: FastifyRequest,
    @Query(new ZodValidationPipe(transcribeQuerySchema)) query: TranscribeQuery,
  ): Promise<TranscriptionDto> {
    return this.speech.transcribe(await readAudio(request), query);
  }

  @Get('speech/audio')
  async audio(
    @Query(new ZodValidationPipe(synthesizeQuerySchema)) query: SynthesizeQuery,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const audio = await this.speech.synthesize(query);
    reply
      .header('Content-Type', 'audio/wav')
      .header('Content-Length', audio.length)
      .header('Cache-Control', 'private, max-age=3600')
      .header('X-Content-Type-Options', 'nosniff');
    return audio;
  }
}

async function readAudio(request: FastifyRequest): Promise<SpeechAudio> {
  if (!request.isMultipart()) throw new InvalidAudioError();
  try {
    const part = await request.file();
    if (!part) throw new InvalidAudioError();
    const data = await part.toBuffer();
    if (part.file.truncated) throw new AudioTooLargeError();
    if (data.length === 0) throw new InvalidAudioError('The recording is empty');
    return { data, filename: part.filename || 'speech.wav', mimeType: part.mimetype };
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) throw error;
    switch (error.code) {
      case 'FST_REQ_FILE_TOO_LARGE':
        throw new AudioTooLargeError();
      case 'FST_FILES_LIMIT':
      case 'FST_FIELDS_LIMIT':
      case 'FST_PARTS_LIMIT':
      case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
        throw new InvalidAudioError();
      default:
        throw error;
    }
  }
}
