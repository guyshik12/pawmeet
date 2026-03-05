import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { Routes } from '../../constants/routes';
import { colors, spacing, borderRadius, typography, shadow } from '../../constants/theme';
import { APP_NAME } from '../../../config/app';
import { supabase } from '../../lib/supabase';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, typeof Routes.Login>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Oops!', 'Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🐾</Text>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>Find furry friends near you</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back!</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign In 🐾'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate(Routes.Register)}>
          <Text style={styles.link}>New here? <Text style={styles.linkBold}>Create an account →</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  heroEmoji: { fontSize: 72, marginBottom: spacing.sm },
  appName: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  tagline: { ...typography.body, color: colors.textSecondary },
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
