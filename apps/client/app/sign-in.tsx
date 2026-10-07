import { SignInForm } from '../features/auth';
import { Screen } from '../features/ui';

export default function SignInScreen() {
  return (
    <Screen centered>
      <SignInForm />
    </Screen>
  );
}
