# Mastra agents

`src/mastra` holds agents built with [Mastra](https://mastra.ai). They run locally in Mastra Studio, a browser page for chatting with an agent and inspecting its tool calls.

They are separate from the two assistants inside the product. The equipment assistant and the supplier agent are part of the api and are described in [assistants.md](assistants.md); nothing in `src/mastra` is used by the api or the client, and none of it is deployed.

## Layout

| Path                                       | Holds                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| `src/mastra/index.ts`                      | the entry file: every agent and workflow is registered here |
| `src/mastra/agents/weather-agent.ts`       | example agent that calls a tool                             |
| `src/mastra/agents/hello-agent.ts`         | minimal agent: instructions and a model, no tools           |
| `src/mastra/tools/weather-tool.ts`         | example tool the agent calls                                |
| `src/mastra/workflows/weather-workflow.ts` | example workflow                                            |
| `tsconfig.json`                            | TypeScript settings for `src/mastra`                        |
| `.env.example`                             | the variable Studio needs; copy it to `.env`                |

## Run Studio

```sh
cp .env.example .env    # then set OPENROUTER_API_KEY in .env
pnpm mastra:dev
```

Open the Studio address the command prints. It is `http://localhost:4111` unless that port is taken, in which case Mastra picks the next free one.

Studio lists agents without a key. The key is only needed when you send an agent a message.

## Add an agent

Studio shows only what `src/mastra/index.ts` registers. A file that exists but is not registered there does not appear.

1. Create the agent in `src/mastra/agents/`:

   ```ts
   import { Agent } from '@mastra/core/agent';

   export const quoteAgent = new Agent({
     id: 'quote-agent',
     name: 'Quote Agent',
     instructions: 'You reply with one short, encouraging quote.',
     model: 'openrouter/openrouter/free',
   });
   ```

   `name` is what Studio shows in its agent list. `src/mastra/agents/hello-agent.ts` is a working example of this shape.

2. Register it in `src/mastra/index.ts`:

   ```ts
   import { quoteAgent } from './agents/quote-agent';

   export const mastra = new Mastra({
     agents: { weatherAgent, helloAgent, quoteAgent },
     // ...
   });
   ```

Studio reloads while `pnpm mastra:dev` is running.

## Model

The agents call models through [OpenRouter](https://openrouter.ai), with the key read from `OPENROUTER_API_KEY`. The `model` string is `openrouter/openrouter/free`, OpenRouter's free router: it costs nothing and picks an available free model for each request, so the model that answers can change from one message to the next. For consistent answers, name one model instead, as `openrouter/<provider>/<model>` (for example `openrouter/anthropic/claude-opus-5.5`, which is paid). To call a provider directly instead, change the `model` string (for example `google/gemini-2.5-flash`) and set that provider's key in `.env`.

## Generated files

Running Studio writes two folders. Both are ignored by git, Prettier, ESLint and Docker.

| Folder               | Holds                                                   |
| -------------------- | ------------------------------------------------------- |
| `.mastra/`           | the bundled dev server and Studio                       |
| `src/mastra/public/` | local databases with conversation memory and trace data |

## Checks

`pnpm typecheck`, `pnpm lint` and `pnpm format:check` cover `src/mastra`. `pnpm exec mastra lint` runs Mastra's own project check.
