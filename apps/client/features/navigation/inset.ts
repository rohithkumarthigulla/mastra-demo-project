import { createContext, useContext } from 'react';

/** Height a floating tab bar covers at the bottom of the window, safe area included; 0 when there is none. */
export const TabBarInsetContext = createContext(0);

export function useTabBarInset(): number {
  return useContext(TabBarInsetContext);
}
