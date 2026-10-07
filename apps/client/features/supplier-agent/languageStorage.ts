import { agentLanguageSchema, type AgentLanguage } from '@ee/contracts';

const KEY = 'ee.supplier-agent.language';

/** The language picked on this device (web: localStorage). */
export async function loadLanguage(): Promise<AgentLanguage | null> {
  try {
    const parsed = agentLanguageSchema.safeParse(globalThis.localStorage?.getItem(KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: AgentLanguage): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, language);
  } catch {
    // Private mode or storage disabled: the choice lasts for this session only.
  }
}
