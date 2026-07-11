import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { API_URL } from '../config';
import { colors, space, radius } from '../theme';

// Shown on authed screens until mobile token-auth is wired on the backend.
export function AuthNotice({ feature }: { feature: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Sign in to see your {feature}</Text>
      <Text style={styles.sub}>Mobile sign-in is coming soon. For now, use ddotsjobs.com in your browser.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(API_URL)}>
        <Text style={styles.btnText}>Open ddotsjobs.com</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm, backgroundColor: colors.bg },
  icon: { fontSize: 40 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: space.md, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 24 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
