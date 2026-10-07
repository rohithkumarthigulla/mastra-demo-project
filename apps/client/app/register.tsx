import { RegisterForm } from '../features/auth';
import { Screen } from '../features/ui';

export default function RegisterScreen() {
  return (
    <Screen centered>
      <RegisterForm />
    </Screen>
  );
}
