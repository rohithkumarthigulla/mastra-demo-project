import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button, ErrorMessage, TextField } from '../ui';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  /** Ask for a reason; `required` blocks confirming until one is typed. */
  reason?: { label: string; required?: boolean; maxLength: number };
}

/** A confirmation modal, optionally collecting a reason (decline, cancel). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
  error,
  reason,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const missing = reason?.required === true && text.trim().length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onCancel}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)',
          padding: theme.spacing.lg,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 420,
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '600' }}
          >
            {title}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md }}>
            {message}
          </Text>
          {reason ? (
            <TextField
              label={reason.required ? reason.label : `${reason.label} (optional)`}
              value={text}
              onChangeText={setText}
              maxLength={reason.maxLength}
              multiline
            />
          ) : null}
          <ErrorMessage message={error ?? null} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
            <Button title="Go back" variant="secondary" onPress={onCancel} disabled={loading} />
            <Button
              title={confirmLabel}
              loading={loading}
              disabled={missing}
              onPress={() => onConfirm(text.trim())}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
