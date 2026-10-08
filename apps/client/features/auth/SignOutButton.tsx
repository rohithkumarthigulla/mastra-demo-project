import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme';
import { useSession } from './SessionProvider';

export function SignOutButton() {
  const { signOut } = useSession();
  const theme = useTheme();
  const [pending, setPending] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={pending}
      onPress={() => {
        setPending(true);
        void signOut().finally(() => setPending(false));
      }}
      style={{
        minHeight: theme.size.touch,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.sm,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: theme.colors.link,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        Sign out
      </Text>
    </Pressable>
  );
}
