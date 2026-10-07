import type {
  AssistantReplyDto,
  DraftRequirementDto,
  EquipmentRecommendationDto,
} from '@ee/contracts';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import {
  useAssistantConversation,
  useAssistantConversations,
  useCreateAssistantConversation,
  useSendAssistantMessage,
} from '../../api';
import { useSession } from '../auth';
import { queryKeys } from '../rental';
import { draftToRequirementParams } from '../requirements';
import { useTheme } from '../theme';
import { Button } from '../ui';
import { Bubble, ChatShell } from './ChatShell';
import { useChat } from './useChat';

export function AssistantChat() {
  const { api } = useSession();
  const conversations = useAssistantConversations(api);
  const create = useCreateAssistantConversation(api);
  const sendMessage = useSendAssistantMessage(api);
  const chat = useChat({
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
      emptyHint="Describe your job — what you are building, where, and when — and I will suggest equipment."
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
  replies: Record<string, AssistantReplyDto>;
}) {
  const { api } = useSession();
  const detail = useAssistantConversation(api, conversationId);
  return (
    <>
      {detail.data?.messages.map((m) => {
        const extras = replies[m.id];
        return (
          <Bubble key={m.id} role={m.role} text={m.content}>
            {extras
              ? extras.recommendations.map((r) => (
                  <RecommendationCard key={r.modelId} recommendation={r} />
                ))
              : m.recommendedModelIds.map((modelId) => (
                  <ModelLink key={modelId} modelId={modelId} />
                ))}
            {extras?.draftRequirement ? <DraftCard draft={extras.draftRequirement} /> : null}
          </Bubble>
        );
      })}
    </>
  );
}

function RecommendationCard({ recommendation: r }: { recommendation: EquipmentRecommendationDto }) {
  const theme = useTheme();
  const router = useRouter();
  const listings =
    r.activeListingCount === 1
      ? '1 listing available'
      : `${r.activeListingCount} listings available`;
  return (
    <View
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
        {r.manufacturerName} {r.modelName}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>{r.reason}</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        <Button
          title="View model"
          variant="secondary"
          onPress={() => router.push({ pathname: '/equipment/[id]', params: { id: r.modelId } })}
        />
        <Button
          title={listings}
          variant="secondary"
          disabled={r.activeListingCount === 0}
          onPress={() => router.push({ pathname: '/find', params: { modelId: r.modelId } })}
        />
      </View>
    </View>
  );
}

/** Earlier replies only keep the model ids, so look the name up for the link. */
function ModelLink({ modelId }: { modelId: string }) {
  const { api } = useSession();
  const router = useRouter();
  const model = useQuery({
    queryKey: queryKeys.model(modelId),
    queryFn: () => api.knowledge.model(modelId),
  });
  return (
    <Button
      title={model.data ? `View ${model.data.modelName}` : 'View model'}
      variant="secondary"
      onPress={() => router.push({ pathname: '/equipment/[id]', params: { id: modelId } })}
    />
  );
}

function DraftCard({ draft }: { draft: DraftRequirementDto }) {
  const theme = useTheme();
  const router = useRouter();
  const when =
    draft.startDate && draft.endDate ? `${draft.startDate} to ${draft.endDate}` : 'Dates not set';
  return (
    <View
      style={{
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.colors.primary,
      }}
    >
      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Draft requirement</Text>
      <Text style={{ color: theme.colors.text }}>{draft.title}</Text>
      <Text style={{ color: theme.colors.textMuted }}>
        {`${draft.quantity} × ${draft.categoryCode} · ${when}`}
      </Text>
      {draft.notes ? <Text style={{ color: theme.colors.textMuted }}>{draft.notes}</Text> : null}
      <Button
        title="Create this requirement"
        onPress={() =>
          router.push({ pathname: '/requirements/new', params: draftToRequirementParams(draft) })
        }
      />
    </View>
  );
}
