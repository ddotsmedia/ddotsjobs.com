import { ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { JobsStackParams } from '../../App';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { API_URL } from '../config';
import { colors, space, radius } from '../theme';
import { rupees } from '../lib/format';

type Props = NativeStackScreenProps<JobsStackParams, 'JobDetail'>;

export function JobDetailScreen({ route }: Props) {
  const { slug } = route.params;
  const q = trpc.jobs.getBySlug.useQuery({ slug });
  const token = useAuth((s) => s.token);
  const job = q.data as
    | { id: string; titleEn: string; company?: string; descriptionEn?: string | null; salaryMinPaise?: number | null; salaryDisclosed?: boolean; district?: string | null }
    | undefined;

  if (q.isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />;
  if (!job) return <Text style={styles.empty}>Job not found.</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Text style={styles.title}>{job.titleEn}</Text>
      {job.company ? <Text style={styles.company}>{job.company}</Text> : null}
      <View style={styles.metaRow}>
        {job.district ? <Text style={styles.meta}>{job.district}</Text> : null}
        <Text style={styles.salary}>{rupees(job.salaryMinPaise ?? null, job.salaryDisclosed ?? true)}</Text>
      </View>
      {job.descriptionEn ? <Text style={styles.body}>{job.descriptionEn}</Text> : null}

      <TouchableOpacity
        style={styles.applyBtn}
        onPress={() => Linking.openURL(`${API_URL}/jobs/${slug}`)}
      >
        <Text style={styles.applyText}>{token ? 'Apply on ddotsjobs' : 'Open & apply on ddotsjobs.com'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  company: { fontSize: 16, color: colors.muted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 14, color: colors.muted },
  salary: { fontSize: 16, fontWeight: '700', color: colors.accent },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  applyBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: space.md },
  applyText: { fontSize: 16, fontWeight: '700', color: colors.dark },
  empty: { textAlign: 'center', color: colors.faint, marginTop: space.xl },
});
