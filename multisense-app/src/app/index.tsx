import React from 'react';
import { StyleSheet, View, Text, Pressable, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

const GAMES = [
  {
    id: 'memory',
    title: '🎮 Multi-Sense Memory',
    desc: 'Watch a growing pattern of sound, flash, shape and vibration — then repeat it back. Classic, Reverse, and Speed Ramp modes.',
    color: '#5eead4',
  },
  {
    id: 'echo-hunt',
    title: '📡 Echo Hunt',
    desc: 'A signal is hidden on a grid. Move to find it — voice, vibration, and color tell you if you\'re getting warmer.',
    color: '#f59e0b',
  },
  {
    id: 'reaction-rush',
    title: '⚡ Reaction Rush',
    desc: 'A tile is cued by voice, flash, and vibration. Tap it before the timer runs out — the window shrinks every round.',
    color: '#a855f7',
  },
];

export default function GameHub() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🕹️ Multi-Sense Game Hub</Text>
        <Text style={styles.sub}>Every game here works by sight, sound, or touch alone — pick one.</Text>

        {GAMES.map((g) => (
          <Pressable
            key={g.id}
            style={[styles.card, { borderColor: g.color }]}
            onPress={() => router.push(`/games/${g.id}` as any)}
          >
            <Text style={[styles.cardTitle, { color: g.color }]}>{g.title}</Text>
            <Text style={styles.cardDesc}>{g.desc}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1115' },
  scrollContent: { alignItems: 'center', padding: 20, gap: 16, paddingBottom: 40 },
  title: { color: '#f2f3f5', fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  sub: { color: '#9aa0ab', fontSize: 13, textAlign: 'center', maxWidth: 320, marginBottom: 8 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#1a1d24', borderRadius: 16, padding: 18, borderWidth: 1.5, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardDesc: { color: '#9aa0ab', fontSize: 13, lineHeight: 18 },
});