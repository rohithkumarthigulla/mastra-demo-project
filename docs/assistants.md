# AI assistants

Two chat assistants run on the API. Both read data through the platform's own services
and permissions — they never query tables the signed-in user could not see.

| Assistant           | Who      | API prefix             | Screen                               |
| ------------------- | -------- | ---------------------- | ------------------------------------ |
| Equipment assistant | Builder  | `/equipment-assistant` | `apps/client/app/assistant.tsx`      |
| Supplier agent      | Supplier | `/supplier-agent`      | `apps/client/app/supplier/agent.tsx` |

Endpoints and payloads are defined in [contracts.md](contracts.md) §7–8.

## Configuration

The AI key is read only from the environment. It is never committed, logged, or sent to
the client.

| Variable                 | Default                | Purpose                                        |
| ------------------------ | ---------------------- | ---------------------------------------------- |
| `GEMINI_API_KEY`         | _(unset)_              | Google Gemini API key                          |
| `GEMINI_CHAT_MODEL`      | `gemini-2.5-flash`     | Chat + tool-calling model                      |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model (768 dimensions)               |
| `AI_TIMEOUT_MS`          | `20000`                | Per-request timeout                            |
| `AI_PROVIDER`            | `gemini`               | `fake` uses the deterministic offline provider |

Put the key in `apps/api/.env` (ignored by git; only `.env.example` is tracked).

Without a key, every message endpoint answers `503 ASSISTANT_NOT_CONFIGURED` and both
chat screens show "The assistant is not set up on this server". Listing and reading
conversations still works.

The provider layer (`apps/api/src/modules/ai`) has one interface for chat with tool
calling and for embeddings. The Gemini client retries once on 429/5xx and turns timeouts
and outages into `503 ASSISTANT_UNAVAILABLE`. The fake provider is used by tests: it
produces hash-based embeddings and follows a keyword script, so no network is needed.

## Equipment assistant (builders)

Each message runs a short tool loop (at most 6 rounds) over the equipment knowledge base
and public listings: list construction tasks, read a task's required capabilities, list
models with a capability, search and read models, and search active listings by model
and city.

- **No invented specs.** Specifications come only from `get_model`. Only `VERIFIED`
  values are given as facts; others are labelled "unverified", missing ones "not known".
- **Recommendations** are accepted only for model ids a tool returned in this reply.
  Each carries a reason and the number of active listings (in the job's city when known).
- **Draft requirement** is returned once category, city and dates are known. It is a
  proposal for the builder to review; the assistant never creates a requirement.
- Vague questions get a follow-up question and no recommendations.
- Conversations belong to the builder; another builder's id returns 404.

## Supplier agent (suppliers)

### Knowledge ingest

```sh
pnpm --filter @ee/api build
pnpm --filter @ee/api agent:ingest            # reads docs/knowledge
```

Every Markdown file in `docs/knowledge` (with front matter) is split by section into
chunks of at most ~1500 characters, embedded, and stored in `knowledge_documents` /
`knowledge_chunks`. The run is idempotent: a file is re-chunked only when its content
(or the embedding model) changes, and documents whose files were removed are deleted.
Re-run it after editing the guides or changing `GEMINI_EMBEDDING_MODEL`.

### Answers

The question is embedded and the 4 closest chunks for audiences `SUPPLIER` and `ALL` are
given to the model. Answers about how the platform works cite those guides in
`citations[]`.

Read tools see only the signed-in supplier's own yards, units, listings and
availability. Rental requests, quotes and bookings reply "not available yet" until those
modules exist.

### Confirm before change

The agent never changes data itself. A change is proposed as a row in
`agent_pending_actions` with a plain-language summary and returned as `pendingAction`.

| Action                 | Executed by on confirm            |
| ---------------------- | --------------------------------- |
| `BLOCK_UNIT`           | `AvailabilityService.createBlock` |
| `LIFT_BLOCK`           | `AvailabilityService.liftBlock`   |
| `UPDATE_LISTING_PRICE` | `EquipmentListingsService.update` |
| `REJECT_REQUEST`       | not available yet (`501`)         |

- `POST /supplier-agent/actions/:id/confirm` claims the action atomically
  (`PENDING` and not expired) and then runs it through the owning service, with the same
  ownership and validation as the normal endpoints. If that service refuses (for example
  an overlapping block), the action returns to `PENDING` and the error is shown.
- `POST /supplier-agent/actions/:id/cancel` discards it.
- Actions expire after 10 minutes. Confirming or cancelling an expired, confirmed or
  cancelled action returns `409`; another supplier's action returns `404`.

## Tests

`pnpm test` covers both assistants with the fake provider and in-memory repositories:
grounded recommendations, follow-up on vague jobs, ingest idempotency, cited answers,
the pending-action lifecycle (confirm, cancel, expiry, re-confirm), cross-account
isolation, and the 503 without a key.
