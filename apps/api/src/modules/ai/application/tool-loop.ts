import { DomainError } from '../../../platform/http';
import type { AiProvider, ChatTurn, ToolCall, ToolDefinition } from '../domain';

export interface Tool {
  definition: ToolDefinition;
  run(args: Record<string, unknown>): Promise<unknown>;
}

export interface ToolLoopResult {
  text: string;
  calls: (ToolCall & { result: unknown })[];
}

const MAX_ROUNDS = 6;

/**
 * Lets the model call tools until it answers in text. A tool that fails with a domain error
 * returns `{ error }` to the model instead of failing the request; anything else propagates.
 */
export async function runToolLoop(
  provider: AiProvider,
  input: { system: string; history: ChatTurn[]; tools: Tool[] },
): Promise<ToolLoopResult> {
  const byName = new Map(input.tools.map((t) => [t.definition.name, t]));
  const definitions = input.tools.map((t) => t.definition);
  const messages = [...input.history];
  const calls: ToolLoopResult['calls'] = [];

  for (let round = 0; ; round++) {
    const finalRound = round >= MAX_ROUNDS;
    const reply = await provider.chat({
      system: input.system,
      messages,
      tools: finalRound ? [] : definitions,
    });
    if (finalRound || reply.toolCalls.length === 0) {
      return { text: reply.text.trim(), calls };
    }
    messages.push({ role: 'assistant', text: reply.text, toolCalls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      const result = await runTool(byName.get(call.name), call);
      calls.push({ ...call, result });
      messages.push({ role: 'tool', name: call.name, result });
    }
  }
}

async function runTool(tool: Tool | undefined, call: ToolCall): Promise<unknown> {
  if (!tool) return { error: `Unknown tool ${call.name}` };
  try {
    return await tool.run(call.args);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

export function stringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function numberArg(args: Record<string, unknown>, name: string): number | undefined {
  const value = args[name];
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}
