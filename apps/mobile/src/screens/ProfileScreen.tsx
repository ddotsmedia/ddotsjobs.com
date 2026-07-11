import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParams } from '../../App';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { API_URL } from '../config';
import { colors, space, radius } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParams, 'ProfileHome'>;

const LINKS: { label: string; path: string }[] = [
  { label: 'My applications', path: '/seeker/applications' },
  { label: 'Referrals & credits', path: '/seeker/referrals' },
  { label: 'Premium', path: '/premium' },
  { label: 'Email preferences', path: '/seeker/preferences' },
];

export function ProfileScreen({ navigation }: Props) {
  const token = useAuth((s) => s.token);
  const signOut = useAuth((s) => s.signOut);
  const q = trpc.seeker.getProfile.useQuery(undefined, { enabled: !!token });

  if (!token) {
    return (
      <View style={styles.signedOut}>
        <Text style={styles.icon}>👤</Text>
        <Text style={styles.title}>Welcome to ddotsjobs</Text>
        <Text style={styles.sub}>Sign in to track applications, save jobs and message employers.</Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = q.data?.fullName ?? 'Job seeker';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.name}>{name}</Text>
      </View>
      {LINKS.map((l) => (
        <TouchableOpacity key={l.path} style={styles.item} onPress={() => Linking.openURL(`${API_URL}${l.path}`)}>
          <Text style={styles.itemText}>{l.label}</Text>
          <Text style={styles.chevron}>↗</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm, backgroundColor: colors.bg },
  icon: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  primary: { marginTop: space.md, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 32 },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.dark },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF6F5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.accent },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  item: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  itemText: { fontSize: 15, color: colors.text },
  chevron: { fontSize: 15, color: colors.accent },
  signOut: { marginTop: space.md, alignItems: 'center', padding: space.md },
  signOutText: { color: colors.red, fontSize: 15, fontWeight: '700' },
});
