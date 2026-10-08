import { loginRequestSchema } from '@ee/contracts';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>New here?</Text>
        <Link href="/register" replace asChild>
          <Pressable
            accessibilityRole="link"
            style={{ minHeight: theme.size.touch, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.link, fontWeight: theme.fontWeight.semibold }}>
              Create an account
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
