import { useTheme } from '../theme';
import { SignOutButton } from './SignOutButton';

/** Shared header styling for the signed-in builder and supplier stacks. */
export function useRoleLayoutOptions() {
  const theme = useTheme();
  return {
    headerShown: true,
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.text,
    contentStyle: { backgroundColor: theme.colors.background },
    headerRight: () => <SignOutButton />,
  };
}
