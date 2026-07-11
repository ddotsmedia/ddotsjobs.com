import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { AuthNotice } from '../components/AuthNotice';
import { colors, space, radius } from '../theme';
import { rupees } from '../lib/format';

export function SavedScreen() {
  const token = useAuth((s) => s.token);
  const q = trpc.jobs.getSavedJobs.useQuery(undefined, { enabled: !!token });

  if (!token) return <AuthNotice feature="saved jobs" />;
  if (q.isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />;

  const items = q.data ?? [];
  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.titleEn}</Text>
            <Text style={styles.company}>{item.company}</Text>
            <Text style={styles.salary}>{rupees(item.salaryMinPaise, item.salaryDisclosed)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No saved jobs yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  company: { fontSize: 14, color: colors.muted },
  salary: { fontSize: 14, fontWeight: '700', color: colors.accent },
  empty: { textAlign: 'center', color: colors.faint, marginTop: space.xl },
});
