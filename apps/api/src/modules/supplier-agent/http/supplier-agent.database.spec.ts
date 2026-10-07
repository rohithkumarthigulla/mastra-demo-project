import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type { RentalRequestDto } from '@ee/contracts';
import { eq } from 'drizzle-orm';
import { systemClock } from '../../../platform/auth';
import { notifications } from '../../../platform/database/schema';
import { FakeProvider } from '../../ai/infrastructure';
import { AvailabilityService } from '../../availability/application';
import { EquipmentListingsService } from '../../equipment-listings/application';
import { FleetService } from '../../fleet/application';
import { RentalRequestsService } from '../../rental-requests/application';
import {
  dateFromToday,
  RentalFlowHarness,
} from '../../rental-requests/testing/rental-flow-test-app';
import { SupplierAgentService } from '../application';
import { InMemoryAgentRepository, InMemoryKnowledgeRepository } from '../testing';

describe('supplier agent rental requests (database)', () => {
  let h: RentalFlowHarness;
  let agent: SupplierAgentService;

  before(async () => {
    h = await RentalFlowHarness.start();
    const get = <T>(type: new (...args: never[]) => T) => h.app.get(type, { strict: false });
    agent = new SupplierAgentService(
      new InMemoryAgentRepository(),
      new InMemoryKnowledgeRepository(),
      new FakeProvider(),
      systemClock,
      get(FleetService),
      get(AvailabilityService),
      get(EquipmentListingsService),
      new RentalRequestsService(h.db, systemClock),
    );
  });
  afterEach(async () => {
    await h.cleanup();
  });
  after(async () => {
    await h?.close();
  });

  async function pendingRequest() {
    const builder = await h.builder('Ravi');
    const supplier = await h.supplier();
    const listing = await h.listing(supplier);
    const res = await h.request<RentalRequestDto>('POST', '/rental-requests', builder.token, {
      listingId: listing.id,
      startDate: dateFromToday(2),
      endDate: dateFromToday(4),
    });
    assert.equal(res.status, 201);
    return { builder, supplier, listing, request: res.body };
  }

  it('proposes declining a pending request and only rejects it after confirmation', async () => {
    const { builder, supplier, listing, request } = await pendingRequest();
    const conversation = await agent.create(supplier.accountId, {});

    const reply = await agent.send(supplier.accountId, conversation.id, {
      content: `Decline the request from ${builder.name} because the machine is booked.`,
    });

    const pending = reply.pendingAction;
    assert.ok(pending);
    assert.equal(pending.type, 'REJECT_REQUEST');
    assert.match(
      pending.summary,
      new RegExp(`Decline ${builder.name}'s request for "${listing.title}"`),
    );
    assert.match(pending.summary, /reason: the machine is booked/);
    const untouched = await h.request<RentalRequestDto>(
      'GET',
      `/rental-requests/${request.id}`,
      builder.token,
    );
    assert.equal(untouched.body.status, 'PENDING');

    const confirmed = await agent.confirm(supplier.accountId, pending.id);
    assert.equal(confirmed.status, 'CONFIRMED');
    const after = await h.request<RentalRequestDto>(
      'GET',
      `/rental-requests/${request.id}`,
      builder.token,
    );
    assert.equal(after.body.status, 'REJECTED');
    assert.equal(after.body.declineReason, 'the machine is booked');
    const kinds = (
      await h.db.select().from(notifications).where(eq(notifications.accountId, builder.accountId))
    ).map((n) => n.kind);
    assert.ok(kinds.includes('REQUEST_DECLINED'));
  });

  it('refuses to propose declining a request that is no longer pending', async () => {
    const { builder, supplier, request } = await pendingRequest();
    const cancelled = await h.request(
      'POST',
      `/rental-requests/${request.id}/cancel`,
      builder.token,
    );
    assert.equal(cancelled.status, 200);
    const conversation = await agent.create(supplier.accountId, {});

    const reply = await agent.send(supplier.accountId, conversation.id, {
      content: `Reject request ${request.id}`,
    });

    assert.equal(reply.pendingAction, null);
  });

  it("cannot see or decline another supplier's request", async () => {
    const { request } = await pendingRequest();
    const stranger = await h.supplier('Stranger');
    const conversation = await agent.create(stranger.accountId, {});

    const reply = await agent.send(stranger.accountId, conversation.id, {
      content: `Reject request ${request.id}`,
    });

    assert.equal(reply.pendingAction, null);
  });
});
