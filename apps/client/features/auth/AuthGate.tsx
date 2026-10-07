import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoadingIndicator } from '../ui';
import { resolveRedirect } from './routing';
import { useSession } from './SessionProvider';

/** Keeps the current route consistent with the session: signed-out, role, and onboarding. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { snapshot } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const target = resolveRedirect(snapshot, segments);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  // The navigator must stay mounted for router.replace to work, so cover it instead of
  // unmounting it; this also hides protected screens for the frame before a redirect lands.
  const blocked = snapshot.status === 'loading' || target !== null;

  return (
    <View style={styles.fill}>
      {children}
      {blocked ? (
        <View style={StyleSheet.absoluteFill}>
          <LoadingIndicator />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
