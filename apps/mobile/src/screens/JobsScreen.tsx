import { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParams } from '../../App';
import { trpc } from '../lib/trpc';
import { useOffline } from '../lib/store';
import { colors, space, radius } from '../theme';
import { rupees } from '../lib/format';

type Props = NativeStackScreenProps<JobsStackParams, 'JobsList'>;

export function JobsScreen({ navigation }: Props) {
  const [q, setQ] = useState('');
  const query = trpc.jobs.list.useQuery({ limit: 20, ...(q.trim() ? { q: q.trim() } : {}) });
  const setJobs = useOffline((s) => s.setJobs);
  const cached = useOffline((s) => s.jobs);

  useEffect(() => {
    if (query.data?.items) setJobs(query.data.items as never);
  }, [query.data, setJobs]);

  const items = query.data?.items ?? cached;

  return (
    <View style={styles.screen}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search jobs…"
        placeholderTextColor={colors.faint}
        style={styles.search}
        returnKeyType="search"
      />
      {query.isLoading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ padding: space.md, gap: space.sm }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('JobDetail', { slug: item.slug ?? item.id, title: item.titleEn })}
            >
              <Text style={styles.title}>{item.titleEn}</Text>
              <Text style={styles.company}>{item.company}</Text>
              <View style={styles.metaRow}>
                {item.district ? <Text style={styles.meta}>{item.district}</Text> : null}
                <Text style={styles.salary}>{rupees(item.salaryMinPaise, item.salaryDisclosed)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No jobs found.</Text>}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: { margin: space.md, marginBottom: 0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, color: colors.text },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  company: { fontSize: 14, color: colors.muted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  meta: { fontSize: 13, color: colors.muted },
  salary: { fontSize: 14, fontWeight: '700', color: colors.accent },
  empty: { textAlign: 'center', color: colors.faint, marginTop: space.xl },
});
