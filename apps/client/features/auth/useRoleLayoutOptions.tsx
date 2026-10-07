import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { SignOutButton } from './SignOutButton';

/** Shared header styling for the signed-in builder and supplier stacks. */
export function useRoleLayoutOptions(headerActions?: ReactNode) {
  const theme = useTheme();
  return {
    headerShown: true,
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.text,
    contentStyle: { backgroundColor: theme.colors.background },
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {headerActions}
        <SignOutButton />
      </View>
    ),
  };
}
