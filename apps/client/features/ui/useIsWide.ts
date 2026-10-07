import { useWindowDimensions } from 'react-native';

export const WIDE_BREAKPOINT = 768;

/** True on tablet/desktop-width windows, where screens switch to multi-column layouts. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
