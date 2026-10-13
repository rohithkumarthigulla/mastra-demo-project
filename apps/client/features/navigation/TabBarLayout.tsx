import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TabBarInsetContext } from './inset';
import { TabBar, TAB_BAR_HEIGHT } from './TabBar';
import type { NavRole } from './tabs';

/** Wraps a role's stack so every screen in it gets the floating tab bar and room above it. */
export function TabBarLayout({ role, children }: { role: NavRole; children: ReactNode }) {
  const theme = useTheme();
  const bottom = Math.max(useSafeAreaInsets().bottom, theme.spacing.md);
  return (
    <View style={{ flex: 1 }}>
      <TabBarInsetContext.Provider value={bottom + TAB_BAR_HEIGHT}>
        {children}
      </TabBarInsetContext.Provider>
      <TabBar role={role} bottom={bottom} />
    </View>
  );
}
