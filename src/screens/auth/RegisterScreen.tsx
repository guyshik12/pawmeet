import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { Routes } from '../../constants/routes';
import { colors, spacing, borderRadius, typography, shadow } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, typeof Routes.Register>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Oops!', 'Please fill in all fields'); return; }
    if (password.length < 6) { Alert.alert('Oops!', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name } },
    });
    if (error) { setLoading(false); Alert.alert('Registration Failed', error.message); return; }
    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, name }).single();
    }
    setLoading(false);
    Alert.alert('Welcome! 🐾', 'Account created! Sign in to continue.');
    navigation.navigate(Routes.Login);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🐶</Text>
          <Text style={styles.title}>Join PawMeet</Text>
          <Text style={styles.subtitle}>Create your dog's profile</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your details</Text>

          {[
            { label: 'Your name', value: name, set: setName, placeholder: 'e.g. Alex', caps: 'words' as const },
            { label: 'Email', value: email, set: setEmail, placeholder: 'your@email.com', caps: 'none' as const, keyboard: 'email-address' as const },
            { label: 'Password', value: password, set: setPassword, placeholder: '••••••••', secure: true },
          ].map((field) => (
            <View key={field.label} style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textLight}
                value={field.value}
                onChangeText={field.set}
                autoCapitalize={field.caps ?? 'none'}
                keyboardType={field.keyboard ?? 'default'}
                secureTextEntry={field.secure ?? false}
                autoCorrect={false}
              />
            </View>
          ))}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create Account 🐾'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate(Routes.Login)}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign in →</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroEmoji: { fontSize: 64, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.xl, marginBottom: spacing.lg, ...shadow.md,
  },
  cardTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.lg },
  inputWrapper: { marginBottom: spacing.md },
  inputLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background, borderWidth: 2, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md,
    ...typography.body, color: colors.text,
  },
  button: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.surface, fontWeight: '800', fontSize: 17 },
  link: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  linkBold: { color: colors.primaryDark, fontWeight: '700' },
});
