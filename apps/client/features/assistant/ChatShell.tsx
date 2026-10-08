import type { ChatRole, ConversationDto } from '@ee/contracts';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Button, EmptyState, ErrorMessage, useIsWide } from '../ui';
import { chatErrorMessage, isNotConfigured, NOT_CONFIGURED_MESSAGE } from './chat';

const MESSAGE_MAX = 4000;

interface ChatShellProps {
  conversations: ConversationDto[] | undefined;
  conversationsError: unknown;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** The chat view for the active conversation, or null for a new one. */
  children: ReactNode;
  emptyHint: string;
  /** Text the user sent that is still waiting for a reply. */
  pendingText: string | null;
  sendError: unknown;
  onSend: (text: string) => void;
  onRetry: () => void;
}

/** Conversation list beside (or above, on narrow screens) a chat view and composer. */
export function ChatShell(props: ChatShellProps) {
  const theme = useTheme();
  const wide = useIsWide();
  const [draft, setDraft] = useState('');
  const sending = props.pendingText !== null;
  const notConfigured = isNotConfigured(props.sendError);

  const send = () => {
    const text = draft.trim();
    if (!text || sending) return;
    props.onSend(text);
    setDraft('');
  };

  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: theme.spacing.md }}>
      <View style={{ width: wide ? 260 : undefined, gap: theme.spacing.sm }}>
        <Button title="New conversation" variant="secondary" onPress={() => props.onSelect(null)} />
        {props.conversationsError ? (
          <ErrorMessage message={chatErrorMessage(props.conversationsError)} />
        ) : null}
        {props.conversations?.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: c.id === props.activeId }}
            onPress={() => props.onSelect(c.id)}
            style={{
              minHeight: theme.size.touch,
              justifyContent: 'center',
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
              borderWidth: c.id === props.activeId ? 2 : 1,
              borderColor:
                c.id === props.activeId ? theme.colors.primary : theme.colors.borderStrong,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text numberOfLines={1} style={{ color: theme.colors.text }}>
              {c.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        {props.activeId === null && props.pendingText === null ? (
          <EmptyState title="Start a conversation" message={props.emptyHint} />
        ) : null}
        {props.children}
        {props.pendingText !== null ? (
          <>
            <Bubble role="USER" text={props.pendingText} />
            <TypingIndicator />
          </>
        ) : null}
        {props.sendError ? (
          notConfigured ? (
            <EmptyState title={NOT_CONFIGURED_MESSAGE} />
          ) : (
            <View style={{ gap: theme.spacing.xs, alignItems: 'flex-start' }}>
              <ErrorMessage message={chatErrorMessage(props.sendError)} />
              <Button title="Retry" variant="secondary" onPress={props.onRetry} />
            </View>
          )
        ) : null}
        {notConfigured ? null : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
            <TextInput
              accessibilityLabel="Message"
              placeholder="Type a message"
              placeholderTextColor={theme.colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              maxLength={MESSAGE_MAX}
              multiline
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderStrong,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  fontSize: theme.fontSize.md,
                },
              ]}
            />
            <Button title="Send" onPress={send} disabled={sending || !draft.trim()} />
          </View>
        )}
      </View>
    </View>
  );
}

export function Bubble({
  role,
  text,
  children,
}: {
  role: ChatRole;
  text: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const mine = role === 'USER';
  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: mine ? theme.colors.primary : theme.colors.surface,
        borderWidth: mine ? 0 : 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text
        style={{
          color: mine ? theme.colors.onPrimary : theme.colors.text,
          fontSize: theme.fontSize.md,
        }}
      >
        {text}
      </Text>
      {children}
    </View>
  );
}

function TypingIndicator() {
  const theme = useTheme();
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(timer);
  }, []);
  return (
    <View
      accessibilityLabel="Assistant is typing"
      style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}
    >
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={{ color: theme.colors.textMuted }}>{`Thinking${'.'.repeat(dots)}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, borderWidth: 1, minHeight: 48, maxHeight: 160 },
});
