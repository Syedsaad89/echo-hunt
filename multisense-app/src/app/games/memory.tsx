import React, { useState, useRef, useCallback, useEffect } from 'react';
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
const N_TILES = TILES.length;

type Mode = 'classic' | 'reverse' | 'speed' | 'multi';
const MODE_LABELS: Record<Mode, string> = { classic: 'Classic', reverse: 'Reverse', speed: 'Speed Ramp', multi: 'Multi-Flash' };

type Achievement = { id: string; label: string; check: (b: Record<Mode, number>) => boolean };
const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', label: 'First Steps — reach level 1', check: (b) => Object.values(b).some((v) => v >= 1) },
  { id: 'getting_good', label: 'Getting Good — reach level 5', check: (b) => Object.values(b).some((v) => v >= 5) },
  { id: 'master', label: 'Memory Master — reach level 10', check: (b) => Object.values(b).some((v) => v >= 10) },
  { id: 'speedy', label: 'Speed Demon — level 5 in Speed Ramp', check: (b) => b.speed >= 5 },
  { id: 'multitask', label: 'Multi-Tasker — level 5 in Multi-Flash', check: (b) => b.multi >= 5 },
];
const STORAGE_KEY = 'msg_progress_v2';
const LB_KEY = 'memory';

export default function MemoryGame() {
  const router = useRouter();
  const [sequence, setSequence] = useState<number[][]>([]);
  const [level, setLevel] = useState(0);
  const [bestByMode, setBestByMode] = useState<Record<Mode, number>>({ classic: 0, reverse: 0, speed: 0, multi: 0 });
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [status, setStatus] = useState('Choose a mode and press Start.');
  const [mode, setMode] = useState<Mode>('classic');
  const [accepting, setAccepting] = useState(false);
  const [totalPlays, setTotalPlays] = useState(0);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const playerStepRef = useRef(0);
  const playerHitsThisStepRef = useRef<Set<number>>(new Set());
  const flashAnims = useRef(TILES.map(() => new Animated.Value(0.4))).current;

  useEffect(() => { loadProgress(); getLeaderboard(LB_KEY).then(setLeaderboard); }, []);

  const loadProgress = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setBestByMode(data.bestByMode || { classic: 0, reverse: 0, speed: 0, multi: 0 });
        setUnlocked(data.unlocked || []);
        setTotalPlays(data.totalPlays || 0);
      }
    } catch (e) {}
  };
  const saveProgress = async (b: Record<Mode, number>, u: string[], t: number) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ bestByMode: b, unlocked: u, totalPlays: t })); } catch (e) {}
  };

  const stepSize = (lvl: number) => (mode === 'multi' && lvl >= 3 ? 2 : 1);
  const speedForLevel = (lvl: number) => (mode === 'speed' ? Math.max(180, 500 - lvl * 22) : 480);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fireTile = (i: number, dur = 350) => {
    Speech.speak(String(i + 1));
    Vibration.vibrate(100 + i * 40);
    Animated.sequence([
      Animated.timing(flashAnims[i], { toValue: 1, duration: dur * 0.3, useNativeDriver: true }),
      Animated.timing(flashAnims[i], { toValue: 0.4, duration: dur * 0.5, useNativeDriver: true }),
    ]).start();
  };

  const playSequence = async (seq: number[][], lvl: number) => {
    setAccepting(false);
    setStatus('Watch the pattern…');
    await sleep(500);
    const gap = speedForLevel(lvl);
    for (const step of seq) {
      step.forEach((idx) => fireTile(idx, gap * 0.75));
      await sleep(gap);
    }
    playerStepRef.current = 0;
    playerHitsThisStepRef.current = new Set();
    setAccepting(true);
    setStatus(mode === 'reverse' ? 'Your turn — repeat it BACKWARDS' : 'Your turn — repeat the pattern');
  };

  const nextRound = useCallback((currentSeq: number[][], currentLevel: number) => {
    const n = stepSize(currentLevel + 1);
    const picks = new Set<number>();
    while (picks.size < n) picks.add(Math.floor(Math.random() * N_TILES));
    const newSeq = [...currentSeq, Array.from(picks)];
    setSequence(newSeq);
    playSequence(newSeq, currentLevel);
  }, [mode]);

  const startGame = () => {
    setPendingScore(null);
    setLevel(0);
    setStatus('Game started');
    setTotalPlays((p) => p + 1);
    nextRound([], 0);
  };

  const endGame = async (reachedLevel: number) => {
    setAccepting(false);
    setStatus(`Wrong! You reached level ${reachedLevel}.`);
    Speech.speak(`Game over. You reached level ${reachedLevel}.`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    const newBest = { ...bestByMode, [mode]: Math.max(bestByMode[mode], reachedLevel) };
    let newUnlocked = [...unlocked];
    for (const a of ACHIEVEMENTS) {
      if (!newUnlocked.includes(a.id) && a.check(newBest)) {
        newUnlocked.push(a.id);
        setTimeout(() => Speech.speak(`Achievement unlocked: ${a.label}`), 800);
      }
    }
    setBestByMode(newBest);
    setUnlocked(newUnlocked);
    await saveProgress(newBest, newUnlocked, totalPlays);
    if (reachedLevel > 0) setPendingScore(reachedLevel);
  };

  const submitScore = async (name: string) => {
    if (pendingScore === null) return;
    const list = await addScore(LB_KEY, name, pendingScore);
    setLeaderboard(list);
    setPendingScore(null);
  };

  const onTilePress = (i: number) => {
    if (!accepting) return;
    fireTile(i, 200);
    const stepIdx = mode === 'reverse' ? sequence.length - 1 - playerStepRef.current : playerStepRef.current;
    const expectedStep = sequence[stepIdx];
    if (!expectedStep.includes(i)) { endGame(level); return; }
    playerHitsThisStepRef.current.add(i);
    if (playerHitsThisStepRef.current.size < expectedStep.length) return;
    playerHitsThisStepRef.current = new Set();
    playerStepRef.current++;
    if (playerStepRef.current === sequence.length) {
      const newLevel = level + 1;
      setLevel(newLevel);
      Speech.speak(`Level ${newLevel}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => nextRound(sequence, newLevel), 700);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Games</Text>
        </Pressable>

        <Text style={styles.title}>🎮 Multi-Sense Memory</Text>
        <Text style={styles.sub}>Sound, flash, shape, and vibration together on every tile.</Text>

        <View style={styles.hud}>
          <Text style={styles.hudText}>Level <Text style={styles.hudValue}>{level}</Text></Text>
          <Text style={styles.hudText}>Best ({MODE_LABELS[mode]}) <Text style={styles.hudValue}>{bestByMode[mode]}</Text></Text>
        </View>

        <View style={styles.board}>
          {TILES.map((t, i) => (
            <Animated.View key={i} style={[styles.tileWrap, { opacity: flashAnims[i] }]}>
              <Pressable style={[styles.tile, { backgroundColor: t.color }]} onPress={() => onTilePress(i)}>
                <Text style={styles.tileShape}>{t.shape}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <View style={styles.modes}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <Pressable key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{MODE_LABELS[m]}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startText}>Start Game</Text>
        </Pressable>

        <Text style={styles.status}>{status}</Text>

        {pendingScore !== null && <GameOverEntry pendingScore={pendingScore} onSubmit={submitScore} />}
        <LeaderboardList list={leaderboard} />

        <View style={styles.achievementsBox}>
          <Text style={styles.achievementsTitle}>Achievements ({unlocked.length}/{ACHIEVEMENTS.length}) · {totalPlays} games played</Text>
          {ACHIEVEMENTS.map((a) => (
            <Text key={a.id} style={[styles.achievement, unlocked.includes(a.id) && styles.achievementDone]}>
              {unlocked.includes(a.id) ? '🏆 ' : '🔒 '}{a.label}
            </Text>
          ))}
        </View>
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
  hud: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', justifyContent: 'center' },
  hudText: { color: '#f2f3f5', fontSize: 14, fontWeight: '600' },
  hudValue: { color: '#5eead4' },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 340, justifyContent: 'center', gap: 10, marginTop: 8 },
  tileWrap: { width: '30%', aspectRatio: 1 },
  tile: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileShape: { fontSize: 28, color: 'rgba(0,0,0,0.35)' },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, width: '100%', maxWidth: 340, justifyContent: 'center' },
  modeBtn: { flexBasis: '47%', backgroundColor: '#1a1d24', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#9aa0ab' },
  modeBtnActive: { backgroundColor: '#5eead4', borderColor: '#5eead4' },
  modeText: { color: '#9aa0ab', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  modeTextActive: { color: '#04121a' },
  startBtn: { backgroundColor: '#5eead4', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  startText: { color: '#04121a', fontWeight: '700', fontSize: 16 },
  status: { color: '#9aa0ab', fontSize: 13, textAlign: 'center', marginTop: 4, minHeight: 20 },
  achievementsBox: { width: '100%', maxWidth: 340, backgroundColor: '#1a1d24', borderRadius: 12, padding: 14, marginTop: 12, gap: 6 },
  achievementsTitle: { color: '#f2f3f5', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  achievement: { color: '#5b6270', fontSize: 12.5 },
  achievementDone: { color: '#5eead4', fontWeight: '600' },
});
