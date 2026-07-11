import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParams } from '../../App';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { AuthNotice } from '../components/AuthNotice';
import { colors, space, radius } from '../theme';
import { relativeTime } from '../lib/format';

type Props = NativeStackScreenProps<ChatStackParams, 'ChatInbox'>;

export function ChatInboxScreen({ navigation }: Props) {
  const token = useAuth((s) => s.token);
  const q = trpc.chat.getConversations.useQuery(undefined, { enabled: !!token, refetchInterval: 10_000 });

  if (!token) return <AuthNotice feature="messages" />;
  if (q.isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />;

  const rows = q.data ?? [];
  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('ChatThread', { conversationId: item.id, name: item.peerName })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.peerName}</Text>
              <Text style={styles.preview} numberOfLines={1}>{item.lastMessage ?? 'No messages yet'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {item.lastMessageAt ? <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text> : null}
              {item.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View> : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  preview: { fontSize: 14, color: colors.muted, marginTop: 2 },
  time: { fontSize: 12, color: colors.faint },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.faint, marginTop: space.xl },
});
