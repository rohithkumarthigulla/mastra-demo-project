import { LoadingIndicator } from '../features/ui';

/** Entry point only: AuthGate sends every visitor to sign-in or their role's home. */
export default function IndexScreen() {
  return <LoadingIndicator />;
}
