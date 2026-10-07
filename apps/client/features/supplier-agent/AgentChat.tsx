import type { AgentReplyDto, CitationDto, PendingActionDto } from '@ee/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  useAgentConversation,
  useAgentConversations,
  useCancelAgentAction,
  useConfirmAgentAction,
  useCreateAgentConversation,
  useSendAgentMessage,
  supplierAgentKeys,
} from '../../api';
import { Bubble, ChatShell, chatErrorMessage, formatCountdown, useChat } from '../assistant';
import { useSession } from '../auth';
import { useTheme } from '../theme';
import { Badge, Button, ErrorMessage, type BadgeTone } from '../ui';

export function AgentChat() {
  const { api } = useSession();
  const conversations = useAgentConversations(api);
  const create = useCreateAgentConversation(api);
  const sendMessage = useSendAgentMessage(api);
  const chat = useChat<AgentReplyDto>({
    create: () => create.mutateAsync({}),
    send: (conversationId, content) =>
      sendMessage.mutateAsync({ conversationId, body: { content } }),
  });

  return (
    <ChatShell
      conversations={conversations.data?.items}
      conversationsError={conversations.error}
      activeId={chat.activeId}
      onSelect={chat.select}
      emptyHint="Ask how something works on the platform, or ask me to block a machine or change a listing price. I never change anything until you confirm."
      pendingText={chat.pendingText}
      sendError={chat.error}
      onSend={chat.send}
      onRetry={chat.retry}
    >
      {chat.activeId ? <Messages conversationId={chat.activeId} replies={chat.replies} /> : null}
    </ChatShell>
  );
}

function Messages({
  conversationId,
  replies,
}: {
  conversationId: string;
  replies: Record<string, AgentReplyDto>;
}) {
  const { api } = useSession();
  const detail = useAgentConversation(api, conversationId);
  // Actions belong to the conversation, not to a message; show each under the reply that made it.
  const actionFor = new Map(
    Object.values(replies).flatMap((r) =>
      r.pendingAction ? [[r.message.id, r.pendingAction.id] as const] : [],
    ),
  );
  const actions = detail.data?.pendingActions ?? [];
  const shown = new Set(actionFor.values());

  return (
    <>
      {detail.data?.messages.map((m) => {
        const action = actions.find((a) => a.id === actionFor.get(m.id));
        return (
          <Bubble key={m.id} role={m.role} text={m.content}>
            {replies[m.id]?.citations.length ? (
              <Citations items={replies[m.id]!.citations} />
            ) : null}
            {action ? <ActionCard action={action} /> : null}
          </Bubble>
        );
      })}
      {actions
        .filter((a) => !shown.has(a.id))
        .map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
    </>
  );
}

function Citations({ items }: { items: CitationDto[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text
        style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' }}
      >
        Sources
      </Text>
      {items.map((c) => (
        <Text
          key={c.documentId}
          style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}
        >
          {`• ${c.title}`}
        </Text>
      ))}
    </View>
  );
}

const STATUS: Record<PendingActionDto['status'], { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Waiting for you', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'positive' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

function ActionCard({ action }: { action: PendingActionDto }) {
  const theme = useTheme();
  const { api } = useSession();
  const confirm = useConfirmAgentAction(api);
  const cancel = useCancelAgentAction(api);
  const queryClient = useQueryClient();
  // A refused confirm can still change the action (e.g. it expired), so refetch either way.
  const refresh = {
    onError: () => queryClient.invalidateQueries({ queryKey: supplierAgentKeys.all }),
  };
  const [now, setNow] = useState(Date.now);
  const open = action.status === 'PENDING';

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  const left = formatCountdown(action.expiresAt, now);
  const expired = open && left === null;
  const status = STATUS[expired ? 'EXPIRED' : action.status];
  const busy = confirm.isPending || cancel.isPending;
  const error = confirm.error ?? cancel.error;

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: open && !expired ? theme.colors.primary : theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <Badge label={status.label} tone={status.tone} />
        {open && left ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            {`Expires in ${left}`}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: theme.colors.text }}>{action.summary}</Text>
      {error ? <ErrorMessage message={chatErrorMessage(error)} /> : null}
      {open && !expired ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            title="Confirm"
            loading={confirm.isPending}
            disabled={busy}
            onPress={() => confirm.mutate(action.id, refresh)}
          />
          <Button
            title="Cancel"
            variant="secondary"
            loading={cancel.isPending}
            disabled={busy}
            onPress={() => cancel.mutate(action.id, refresh)}
          />
        </View>
      ) : null}
    </View>
  );
}
