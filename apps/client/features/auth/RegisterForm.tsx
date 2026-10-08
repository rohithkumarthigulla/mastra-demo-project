import { registerRequestSchema, type RegistrableRole } from '@ee/contracts';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, ErrorMessage, Heading, TextField } from '../ui';
import { useTheme } from '../theme';
import { fieldErrorsFromZod, formErrorsFromApi, type FormErrors } from './formErrors';
import { useSession } from './SessionProvider';

const formSchema = registerRequestSchema.omit({ client: true });

const ROLE_OPTIONS: { role: RegistrableRole; title: string; description: string }[] = [
  { role: 'BUILDER', title: 'Builder', description: 'I rent equipment for projects' },
  { role: 'SUPPLIER', title: 'Supplier', description: 'I rent out equipment' },
];

export function RegisterForm() {
  const { register } = useSession();
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegistrableRole>('BUILDER');
  const [errors, setErrors] = useState<FormErrors>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const parsed = formSchema.safeParse({ displayName, email, password, role });
    if (!parsed.success) {
      setErrors({ fields: fieldErrorsFromZod(parsed.error) });
      return;
    }
    setErrors({ fields: {} });
    setSubmitting(true);
    try {
      await register(parsed.data);
    } catch (error) {
      setErrors(formErrorsFromApi(error));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Heading title="Create account" subtitle="Join EquipmentExchange." />
      <ErrorMessage message={errors.form} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {ROLE_OPTIONS.map((option) => {
          const selected = option.role === role;
          return (
            <Pressable
              key={option.role}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setRole(option.role)}
              style={{
                flex: 1,
                minHeight: theme.size.touch,
                gap: theme.spacing.xs,
                padding: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.colors.primary : theme.colors.borderStrong,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>
                {option.title}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        autoComplete="name"
        error={errors.fields.displayName}
      />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        onSubmitEditing={() => void submit()}
        error={errors.fields.password}
      />
      <Button title="Create account" loading={submitting} onPress={() => void submit()} />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>Already have an account?</Text>
        <Link href="/sign-in" replace asChild>
          <Pressable
            accessibilityRole="link"
            style={{ minHeight: theme.size.touch, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.link, fontWeight: theme.fontWeight.semibold }}>
              Sign in
            </Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
