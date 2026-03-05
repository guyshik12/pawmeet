import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { Routes } from '../../constants/routes';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import GradientButton from '../../components/ui/GradientButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, typeof Routes.Register>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name } } });
    if (error) { setLoading(false); Alert.alert('Failed', error.message); return; }
    if (data.user) await supabase.from('profiles').insert({ id: data.user.id, name }).single();
    setLoading(false);
    Alert.alert('Welcome!', 'Account created. Sign in to continue.');
    navigation.navigate(Routes.Login);
  };

  const fields = [
    { label: 'NAME', value: name, set: setName, placeholder: 'Your name', caps: 'words' as const },
    { label: 'EMAIL', value: email, set: setEmail, placeholder: 'you@example.com', caps: 'none' as const, keyboard: 'email-address' as const },
    { label: 'PASSWORD', value: password, set: setPassword, placeholder: '6+ characters', secure: true },
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join PawMeet and find friends for your dog</Text>
        </View>

        <View style={styles.form}>
          {fields.map((f) => (
            <View key={f.label}>
              <Text style={styles.formLabel}>{f.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textLight}
                value={f.value}
                onChangeText={f.set}
                autoCapitalize={f.caps ?? 'none'}
                keyboardType={f.keyboard ?? 'default'}
                secureTextEntry={f.secure ?? false}
                autoCorrect={false}
              />
            </View>
          ))}

          <GradientButton label="Create Account" onPress={handleRegister} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => navigation.navigate(Routes.Login)}>
            <Text style={styles.link}>Have an account? <Text style={styles.linkAccent}>Sign in →</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  hero: { marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.sm },
  formLabel: {
    ...typography.caption, color: colors.textSecondary,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2, marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md,
    ...typography.body, color: colors.text,
  },
  btn: { marginTop: spacing.md },
  link: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  linkAccent: { color: colors.primary, fontWeight: '600' },
});
