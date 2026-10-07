import { useState } from 'react';

interface ChatApi<Reply extends { message: { id: string } }> {
  create: () => Promise<{ id: string }>;
  send: (conversationId: string, content: string) => Promise<Reply>;
}

/**
 * Tracks the active conversation and one in-flight message. A new conversation is created
 * on the first send, and the last failed message can be retried as-is. Replies are kept by
 * message id because extras such as recommendations and citations are not part of history.
 */
export function useChat<Reply extends { message: { id: string } }>(api: ChatApi<Reply>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [replies, setReplies] = useState<Record<string, Reply>>({});

  const send = async (content: string) => {
    setPendingText(content);
    setFailedText(null);
    setError(null);
    try {
      const conversationId = activeId ?? (await api.create()).id;
      setActiveId(conversationId);
      const reply = await api.send(conversationId, content);
      setReplies((all) => ({ ...all, [reply.message.id]: reply }));
    } catch (e) {
      setError(e);
      setFailedText(content);
    } finally {
      setPendingText(null);
    }
  };

  const select = (id: string | null) => {
    setActiveId(id);
    setError(null);
    setFailedText(null);
  };

  return {
    activeId,
    select,
    pendingText,
    error,
    replies,
    send: (content: string) => void send(content),
    retry: () => {
      if (failedText !== null) void send(failedText);
    },
  };
}
