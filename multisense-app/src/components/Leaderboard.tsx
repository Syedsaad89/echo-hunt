import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { ScoreEntry } from '../lib/leaderboard';

export function GameOverEntry({ pendingScore, onSubmit }: { pendingScore: number; onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <View style={styles.entryBox}>
      <Text style={styles.entryLabel}>New score: {pendingScore}. Enter your name:</Text>
      <View style={styles.entryRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#5b6270"
          maxLength={16}
        />
        <Pressable style={styles.submitBtn} onPress={() => onSubmit(name)}>
          <Text style={styles.submitText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LeaderboardList({ list }: { list: ScoreEntry[] }) {
  if (!list.length) return null;
  return (
    <View style={styles.boardBox}>
      <Text style={styles.boardTitle}>🏆 Top 10</Text>
      {list.map((e, i) => (
        <View key={i} style={styles.boardRow}>
          <Text style={styles.boardRank}>{i + 1}.</Text>
          <Text style={styles.boardName}>{e.name}</Text>
          <Text style={styles.boardScore}>{e.score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  entryBox: { width: '100%', maxWidth: 340, backgroundColor: '#1a1d24', borderRadius: 12, padding: 14, gap: 8, marginTop: 8 },
  entryLabel: { color: '#f2f3f5', fontSize: 13, fontWeight: '600' },
  entryRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#0f1115', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f2f3f5', borderWidth: 1, borderColor: '#5b6270' },
  submitBtn: { backgroundColor: '#5eead4', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  submitText: { color: '#04121a', fontWeight: '700' },
  boardBox: { width: '100%', maxWidth: 340, backgroundColor: '#1a1d24', borderRadius: 12, padding: 14, marginTop: 10, gap: 4 },
  boardTitle: { color: '#f2f3f5', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  boardRow: { flexDirection: 'row', gap: 8 },
  boardRank: { color: '#9aa0ab', width: 20 },
  boardName: { color: '#f2f3f5', flex: 1 },
  boardScore: { color: '#5eead4', fontWeight: '700' },
});
