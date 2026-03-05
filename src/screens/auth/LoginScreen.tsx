import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { Routes } from '../../constants/routes';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { APP_NAME } from '../../../config/app';
import { supabase } from '../../lib/supabase';
import GradientButton from '../../components/ui/GradientButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, typeof Routes.Login>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>🐾</Text>
          </View>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>Your dog's social network</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.formLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <GradientButton label="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

          <TouchableOpacity onPress={() => navigation.navigate(Routes.Register)}>
            <Text style={styles.link}>No account? <Text style={styles.linkAccent}>Sign up →</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  logoBox: {
    width: 80, height: 80, borderRadius: borderRadius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg,
  },
  logoEmoji: { fontSize: 40 },
  appName: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  tagline: { ...typography.bodySmall, color: colors.textSecondary, letterSpacing: 0.5 },
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
