import { loginRequestSchema } from '@ee/contracts';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, ErrorMessage, Heading, TextField } from '../ui';
import { useTheme } from '../theme';
import { fieldErrorsFromZod, formErrorsFromApi, type FormErrors } from './formErrors';
import { useSession } from './SessionProvider';

const signInSchema = loginRequestSchema.omit({ client: true });

export function SignInForm() {
  const { signIn, state } = useSession();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);

  const notice = state.status === 'signedOut' ? state.notice : undefined;

  async function submit() {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors({ fields: fieldErrorsFromZod(parsed.error) });
      return;
    }
    setErrors({ fields: {} });
    setSubmitting(true);
    try {
      // On success the session changes and AuthGate redirects; this screen unmounts.
      await signIn(parsed.data);
    } catch (error) {
      setErrors(formErrorsFromApi(error));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Heading title="Sign in" subtitle="Welcome back to EquipmentExchange." />
      <ErrorMessage message={errors.form ?? notice} />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        error={errors.fields.email}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
        error={errors.fields.password}
      />
      <Button title="Sign in" loading={submitting} onPress={() => void submit()} />
      <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
        New here?{' '}
        <Link href="/register" replace style={{ color: theme.colors.primary, fontWeight: '600' }}>
          Create an account
        </Link>
      </Text>
    </>
  );
}
