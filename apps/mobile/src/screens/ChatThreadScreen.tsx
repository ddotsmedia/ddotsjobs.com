import { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatStackParams } from '../../App';
import { trpc } from '../lib/trpc';
import { colors, space, radius } from '../theme';

type Props = NativeStackScreenProps<ChatStackParams, 'ChatThread'>;

export function ChatThreadScreen({ route }: Props) {
  const { conversationId } = route.params;
  const utils = trpc.useUtils();
  const q = trpc.chat.getMessages.useQuery({ conversationId }, { refetchInterval: 3000 });
  const send = trpc.chat.sendMessage.useMutation();
  const [text, setText] = useState('');

  const messages = q.data?.messages ?? [];

  const onSend = async () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    try {
      await send.mutateAsync({ conversationId, content: body });
      await utils.chat.getMessages.invalidate({ conversationId });
    } catch {
      setText(body);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space.md, gap: 6 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            <Text style={[styles.msgText, item.deleted && styles.deleted]}>{item.deleted ? 'Message deleted' : item.content}</Text>
          </View>
        )}
      />
      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => void onSend()} disabled={!text.trim()}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF7' },
  bubble: { maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#DFF3F2' },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: '#EEE' },
  msgText: { fontSize: 15, color: colors.text },
  deleted: { fontStyle: 'italic', color: colors.faint },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 15, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 16 },
});
