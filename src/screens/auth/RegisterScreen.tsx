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
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name } } });
    if (error) { setLoading(false); Alert.alert('Failed', error.message); return; }
    if (data.user) await supabase.from('profiles').insert({ id: data.user.id, name }).single();
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
          <Text style={styles.subtitle}>Your dog's social life starts here</Text>
        </View>

        {[
          { label: 'Your name', value: name, set: setName, placeholder: 'e.g. Alex', caps: 'words' as const },
          { label: 'Email', value: email, set: setEmail, placeholder: 'your@email.com', caps: 'none' as const, keyboard: 'email-address' as const },
          { label: 'Password', value: password, set: setPassword, placeholder: '6+ characters', secure: true },
        ].map((f) => (
          <TextInput
            key={f.label}
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
        ))}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate(Routes.Login)}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.xxl },
  heroEmoji: { fontSize: 64, marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, padding: spacing.md,
    ...typography.body, color: colors.text, marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary, borderRadius: borderRadius.full,
    padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg, ...shadow.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.body, color: colors.background, fontWeight: '800', fontSize: 17 },
  link: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  linkBold: { color: colors.primary, fontWeight: '700' },
});
