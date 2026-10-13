import { Agent } from '@mastra/core/agent';

export const helloAgent = new Agent({
  id: 'hello-agent',
  name: 'Hello Agent',
  instructions: `You are a friendly greeter.

- Greet the user warmly in one or two short sentences.
- If they tell you their name, use it.
- If they ask for anything other than a greeting, say you only do greetings and suggest they try another agent.`,
  model: 'openrouter/openrouter/free',
});
