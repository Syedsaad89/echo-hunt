import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Vibration, Animated, SafeAreaView, ScrollView } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getLeaderboard, addScore, ScoreEntry } from '../../lib/leaderboard';
import { GameOverEntry, LeaderboardList } from '../../components/Leaderboard';

const TILES = [
  { color: '#ef4444', shape: '●' }, { color: '#f59e0b', shape: '■' }, { color: '#eab308', shape: '▲' },
  { color: '#22c55e', shape: '◆' }, { color: '#3b82f6', shape: '★' }, { color: '#a855f7', shape: '♦' },
];
const STORAGE_KEY = 'reaction_rush_best_v1';
const LB_KEY = 'reaction_rush';
const START_WINDOW = 1300;
const MIN_WINDOW = 380;
const SHRINK = 45;

export default function ReactionRush() {
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState('Press Start.');
  const [running, setRunning] = useState(false);
  const [cuedTile, setCuedTile] = useState<number | null>(null);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const flashAnims = useRef(TILES.map(() => new Animated.Value(0.4))).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowRef = useRef(START_WINDOW);
  const streakRef = useRef(0);

  useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(STORAGE_KEY); if (raw) setBest(JSON.parse(raw).best || 0); } catch (e) {}
    })();
    getLeaderboard(LB_KEY).then(setLeaderboard);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const saveBest = async (b: number) => { try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ best: b })); } catch (e) {} };

  const flashTile = (i: number) => {
    Animated.sequence([
      Animated.timing(flashAnims[i], { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashAnims[i], { toValue: 0.4, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const cueNext = () => {
    const i = Math.floor(Math.random() * TILES.length);
    setCuedTile(i);
    Speech.speak(String(i + 1));
    Vibration.vibrate(80);
    flashTile(i);
    setStatus(`Tap tile ${i + 1}!`);
    timeoutRef.current = setTimeout(() => onTimeout(), windowRef.current);
  };

  const endRun = (reason: string) => {
    setRunning(false);
    const finalStreak = streakRef.current;
    Speech.speak(`${reason} Streak ended at ${finalStreak}.`);
    setStatus(`${reason} Final streak: ${finalStreak}. Press Start to try again.`);
    if (finalStreak > best) { setBest(finalStreak); saveBest(finalStreak); }
    if (finalStreak > 0) setPendingScore(finalStreak);
    setCuedTile(null);
  };

  const onTimeout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    endRun('Too slow.');
  };

  const startGame = () => {
    setPendingScore(null);
    setStreak(0); streakRef.current = 0;
    windowRef.current = START_WINDOW;
    setRunning(true);
    cueNext();
  };

  const submitScore = async (name: string) => {
    if (pendingScore === null) return;
    const list = await addScore(LB_KEY, name, pendingScore);
    setLeaderboard(list);
    setPendingScore(null);
  };

  const onTilePress = (i: number) => {
    if (!running || cuedTile === null) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (i !== cuedTile) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      endRun('Wrong tile.');
      return;
    }
    const newStreak = streak + 1;
    setStreak(newStreak); streakRef.current = newStreak;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    windowRef.current = Math.max(MIN_WINDOW, windowRef.current - SHRINK);
    setTimeout(() => cueNext(), 250);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Games</Text>
        </Pressable>

        <Text style={styles.title}>⚡ Reaction Rush</Text>
        <Text style={styles.sub}>A tile is cued by voice, flash, and vibration. Tap it fast — the window shrinks every round.</Text>

        <View style={styles.hud}>
          <Text style={styles.hudText}>Streak <Text style={styles.hudValue}>{streak}</Text></Text>
          <Text style={styles.hudText}>Best <Text style={styles.hudValue}>{best}</Text></Text>
        </View>

        <Text style={styles.status}>{status}</Text>

        <View style={styles.board}>
          {TILES.map((t, i) => (
            <Animated.View key={i} style={[styles.tileWrap, { opacity: flashAnims[i] }]}>
              <Pressable style={[styles.tile, { backgroundColor: t.color }]} onPress={() => onTilePress(i)}>
                <Text style={styles.tileShape}>{t.shape}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Pressable style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startText}>{running ? 'Restart' : 'Start'}</Text>
        </Pressable>

        {pendingScore !== null && <GameOverEntry pendingScore={pendingScore} onSubmit={submitScore} />}
        <LeaderboardList list={leaderboard} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1115' },
  scrollContent: { alignItems: 'center', padding: 16, gap: 12, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: '#9aa0ab', fontSize: 13 },
  title: { color: '#f2f3f5', fontSize: 20, fontWeight: '700' },
  sub: { color: '#9aa0ab', fontSize: 13, textAlign: 'center', maxWidth: 320 },
  hud: { flexDirection: 'row', gap: 20 },
  hudText: { color: '#f2f3f5', fontSize: 15, fontWeight: '600' },
  hudValue: { color: '#a855f7' },
  status: { color: '#f2f3f5', fontSize: 14, fontWeight: '600', textAlign: 'center', minHeight: 20, maxWidth: 320 },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 340, justifyContent: 'center', gap: 10, marginTop: 8 },
  tileWrap: { width: '30%', aspectRatio: 1 },
  tile: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileShape: { fontSize: 28, color: 'rgba(0,0,0,0.35)' },
  startBtn: { backgroundColor: '#a855f7', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 12 },
  startText: { color: '#1a0a2e', fontWeight: '700', fontSize: 16 },
});
