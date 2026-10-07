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
  createQuoteSchema,
  listQuotesQuerySchema,
  rejectQuoteSchema,
  updateQuoteSchema,
  type CreateQuoteRequest,
  type ListQuotesQuery,
  type QuoteDto,
  type QuotePageDto,
  type RejectQuoteRequest,
  type UpdateQuoteRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { QuotesService } from '../application/quotes.service';

@Controller('quotes')
@UseGuards(AuthGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /** Creates a `DRAFT` quote for a pending rental request on the supplier's listing. */
  @Post()
  @Roles('SUPPLIER')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createQuoteSchema)) body: CreateQuoteRequest,
  ): Promise<QuoteDto> {
    return this.quotes.create(user.accountId, body);
  }

  @Get('supplier')
  @Roles('SUPPLIER')
  listForSupplier(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listQuotesQuerySchema)) query: ListQuotesQuery,
  ): Promise<QuotePageDto> {
    return this.quotes.list({ role: 'SUPPLIER', accountId: user.accountId }, query);
  }

  /** Only `DRAFT` or `PENDING_APPROVAL` quotes; a sent quote is locked. */
  @Patch(':id')
  @Roles('SUPPLIER')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(updateQuoteSchema)) body: UpdateQuoteRequest,
  ): Promise<QuoteDto> {
    return this.quotes.update(user.accountId, id, body);
  }

  @Post(':id/send')
  @HttpCode(200)
  @Roles('SUPPLIER')
  send(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<QuoteDto> {
    return this.quotes.send(user.accountId, id);
  }

  /** Sent quotes only; drafts and auto-drafts awaiting approval are never visible to builders. */
  @Get('builder')
  @Roles('BUILDER')
  listForBuilder(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listQuotesQuerySchema)) query: ListQuotesQuery,
  ): Promise<QuotePageDto> {
    return this.quotes.list({ role: 'BUILDER', accountId: user.accountId }, query);
  }

  /** Creates the booking and settles the request (and requirement) in one transaction. */
  @Post(':id/accept')
  @HttpCode(200)
  @Roles('BUILDER')
  accept(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<QuoteDto> {
    return this.quotes.accept(user.accountId, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('BUILDER')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(rejectQuoteSchema)) body: RejectQuoteRequest,
  ): Promise<QuoteDto> {
    return this.quotes.reject(user.accountId, id, body);
  }

  @Get(':id')
  @Roles('BUILDER', 'SUPPLIER')
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<QuoteDto> {
    return this.quotes.getFor(
      { role: user.role === 'BUILDER' ? 'BUILDER' : 'SUPPLIER', accountId: user.accountId },
      id,
    );
  }
}
