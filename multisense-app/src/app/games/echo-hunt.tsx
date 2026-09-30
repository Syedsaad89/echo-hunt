import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Vibration, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getLeaderboard, addScore, ScoreEntry } from '../../lib/leaderboard';
import { GameOverEntry, LeaderboardList } from '../../components/Leaderboard';

const STORAGE_KEY = 'echo_hunt_best_v2';
const LB_KEY = 'echo_hunt';
const SCREEN_W = Dimensions.get('window').width;

type Pos = { x: number; y: number };

function dist(a: Pos, b: Pos) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function randPos(size: number, avoid: Pos): Pos {
  let p: Pos;
  do { p = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) }; }
  while (p.x === avoid.x && p.y === avoid.y);
  return p;
}
function lerpColor(t: number) {
  const c = Math.max(0, Math.min(1, t));
  const from = [30, 41, 59]; const to = [220, 38, 38];
  const r = Math.round(from[0] + (to[0] - from[0]) * c);
  const g = Math.round(from[1] + (to[1] - from[1]) * c);
  const b = Math.round(from[2] + (to[2] - from[2]) * c);
  return `rgb(${r},${g},${b})`;
}

export default function EchoHunt() {
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [best, setBest] = useState(0);
  const [gridSize, setGridSize] = useState(4);
  const [player, setPlayer] = useState<Pos>({ x: 0, y: 0 });
  const [goal, setGoal] = useState<Pos>({ x: 3, y: 3 });
  const [movesLeft, setMovesLeft] = useState(10);
  const [status, setStatus] = useState('Press Start to hide the signal.');
  const [running, setRunning] = useState(false);
  const [found, setFound] = useState(false);
  const [heatMap, setHeatMap] = useState<Record<string, number>>({});
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const lastDistRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(STORAGE_KEY); if (raw) setBest(JSON.parse(raw).best || 0); } catch (e) {}
    })();
    getLeaderboard(LB_KEY).then(setLeaderboard);
  }, []);

  const saveBest = async (b: number) => { try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ best: b })); } catch (e) {} };

  const startLevel = (lvl: number) => {
    const size = Math.min(4 + Math.floor((lvl - 1) / 2), 8);
    const start = { x: 0, y: 0 };
    const g = randPos(size, start);
    const par = dist(start, g);
    const maxD = (size - 1) * 2;
    setGridSize(size); setPlayer(start); setGoal(g);
    setMovesLeft(Math.max(6, par * 2));
    setFound(false);
    lastDistRef.current = par;
    setHeatMap({ '0,0': maxD > 0 ? 1 - par / maxD : 0.3 });
    setRunning(true);
    setStatus(`Level ${lvl} — signal hidden. Find it.`);
    Speech.speak(`Level ${lvl}. Signal hidden. Go find it.`);
  };

  const startGame = () => { setPendingScore(null); setLevel(1); startLevel(1); };

  const move = (dx: number, dy: number) => {
    if (!running) return;
    const nx = Math.max(0, Math.min(gridSize - 1, player.x + dx));
    const ny = Math.max(0, Math.min(gridSize - 1, player.y + dy));
    if (nx === player.x && ny === player.y) { Speech.speak('Edge'); Vibration.vibrate(30); return; }
    const newPos = { x: nx, y: ny };
    const newDist = dist(newPos, goal);
    const oldDist = lastDistRef.current;
    const maxD = (gridSize - 1) * 2;
    const heat = maxD > 0 ? 1 - newDist / maxD : 0.3;
    setPlayer(newPos);
    lastDistRef.current = newDist;
    setHeatMap((prev) => ({ ...prev, [`${nx},${ny}`]: heat }));
    const remaining = movesLeft - 1;
    setMovesLeft(remaining);

    if (newDist === 0) {
      setRunning(false); setFound(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate(400);
      Speech.speak('Found it!');
      const newLevel = level + 1;
      if (level > best) { setBest(level); saveBest(level); }
      setStatus(`Found it! Moving to level ${newLevel}…`);
      setTimeout(() => { setLevel(newLevel); startLevel(newLevel); }, 1400);
      return;
    }

    const vibDur = Math.max(20, 260 - newDist * 30);
    Vibration.vibrate(vibDur);
    let cue: string;
    if (newDist < oldDist) cue = newDist <= 1 ? 'Very warm!' : 'Warmer';
    else if (newDist > oldDist) cue = 'Colder';
    else cue = 'Same';
    Speech.speak(cue);
    setStatus(`${cue} · ${remaining} moves left`);

    if (remaining <= 0) {
      setRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Speech.speak(`Out of moves. You reached level ${level}.`);
      setStatus(`Out of moves. Reached level ${level}. Press Start to try again.`);
      if (level > best) { setBest(level); saveBest(level); }
      if (level > 0) setPendingScore(level);
    }
  };

  const submitScore = async (name: string) => {
    if (pendingScore === null) return;
    const list = await addScore(LB_KEY, name, pendingScore);
    setLeaderboard(list);
    setPendingScore(null);
  };

  const maxDist = (gridSize - 1) * 2;
  const heat = maxDist > 0 ? 1 - lastDistRef.current / maxDist : 0;
  const bgColor = running ? lerpColor(heat * 0.4) : '#0f1115';
  const cellSize = Math.min(SCREEN_W - 64, 320) / gridSize;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Games</Text>
        </Pressable>

        <Text style={styles.title}>📡 Echo Hunt</Text>
        <Text style={styles.sub}>A signal is hidden on the grid. Move to find it — voice, vibration, and color all tell you if you're getting warmer.</Text>

        <View style={styles.hud}>
          <Text style={styles.hudText}>Level <Text style={styles.hudValue}>{level}</Text></Text>
          <Text style={styles.hudText}>Best <Text style={styles.hudValue}>{best}</Text></Text>
          <Text style={styles.hudText}>Moves <Text style={styles.hudValue}>{movesLeft}</Text></Text>
        </View>

        <Text style={styles.status}>{status}</Text>

        <View style={[styles.grid, { width: cellSize * gridSize, height: cellSize * gridSize }]}>
          {Array.from({ length: gridSize }).map((_, row) => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {Array.from({ length: gridSize }).map((__, col) => {
                const key = `${col},${row}`;
                const isPlayer = player.x === col && player.y === row;
                const isStart = col === 0 && row === 0;
                const visitedHeat = heatMap[key];
                const cellColor = isPlayer && found ? '#22c55e'
                  : visitedHeat !== undefined ? lerpColor(visitedHeat) : '#1a1d24';
                return (
                  <View key={key} style={[styles.cell, { width: cellSize - 3, height: cellSize - 3, backgroundColor: cellColor }, isPlayer && styles.playerCell]}>
                    {isPlayer && <Text style={styles.playerMark}>●</Text>}
                    {isStart && !isPlayer && <Text style={styles.startMark}>S</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.dpad}>
          <Pressable style={styles.dpadBtn} onPress={() => move(0, -1)}><Text style={styles.dpadText}>▲</Text></Pressable>
          <View style={styles.dpadRow}>
            <Pressable style={styles.dpadBtn} onPress={() => move(-1, 0)}><Text style={styles.dpadText}>◀</Text></Pressable>
            <View style={styles.dpadCenter}><Text style={styles.dpadCenterText}>{player.x},{player.y}</Text></View>
            <Pressable style={styles.dpadBtn} onPress={() => move(1, 0)}><Text style={styles.dpadText}>▶</Text></Pressable>
          </View>
          <Pressable style={styles.dpadBtn} onPress={() => move(0, 1)}><Text style={styles.dpadText}>▼</Text></Pressable>
        </View>

        <Pressable style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startText}>{running ? 'Restart' : 'Start'}</Text>
        </Pressable>

        <Text style={styles.hint}>Darker = colder (far). Brighter red = warmer (close). Green = found.</Text>

        {pendingScore !== null && <GameOverEntry pendingScore={pendingScore} onSubmit={submitScore} />}
        <LeaderboardList list={leaderboard} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { alignItems: 'center', padding: 16, gap: 12, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: '#d7dae0', fontSize: 13 },
  title: { color: '#f2f3f5', fontSize: 20, fontWeight: '700' },
  sub: { color: '#d7dae0', fontSize: 13, textAlign: 'center', maxWidth: 320 },
  hud: { flexDirection: 'row', gap: 18, flexWrap: 'wrap', justifyContent: 'center' },
  hudText: { color: '#f2f3f5', fontSize: 14, fontWeight: '600' },
  hudValue: { color: '#fff' },
  status: { color: '#f2f3f5', fontSize: 14, textAlign: 'center', fontWeight: '600', minHeight: 20, maxWidth: 320 },
  grid: { marginTop: 6, alignSelf: 'center' },
  cell: { margin: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  playerCell: { borderWidth: 2, borderColor: '#fff' },
  playerMark: { color: '#fff', fontSize: 16, fontWeight: '900' },
  startMark: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  dpad: { alignItems: 'center', gap: 10, marginTop: 12 },
  dpadRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dpadBtn: { width: 68, height: 68, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  dpadText: { fontSize: 26, color: '#fff' },
  dpadCenter: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  dpadCenterText: { color: '#fff', fontSize: 12, opacity: 0.7 },
  startBtn: { backgroundColor: '#5eead4', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 10 },
  startText: { color: '#04121a', fontWeight: '700', fontSize: 16 },
  hint: { color: '#9aa0ab', fontSize: 11.5, textAlign: 'center', maxWidth: 300, marginTop: 4 },
});
