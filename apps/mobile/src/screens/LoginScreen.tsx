import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { API_URL } from '../config';
import { colors, space, radius } from '../theme';

// Phone-OTP sign-in for mobile is pending a backend token endpoint: the web app
// authenticates via next-auth cookies, which a native app can't reuse. Until a
// bearer-token login is exposed (see README "Backend follow-ups"), we hand off
// to the web login. The screen + auth store are already wired for tokens, so
// swapping in a real OTP flow is a small change.
export function LoginScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>ddotsjobs</Text>
      <Text style={styles.title}>Phone sign-in</Text>
      <Text style={styles.sub}>
        Native phone-OTP sign-in is coming soon. For now, sign in on the website — your session there unlocks all features.
      </Text>
      <TouchableOpacity style={styles.primary} onPress={() => Linking.openURL(`${API_URL}/login`)}>
        <Text style={styles.primaryText}>Sign in on ddotsjobs.com</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md, backgroundColor: colors.bg },
  logo: { fontSize: 26, fontWeight: '800', fontStyle: 'italic', color: colors.accent },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  primary: { marginTop: space.sm, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28 },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.dark },
});
