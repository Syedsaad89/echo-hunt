import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, Vibration, Animated, SafeAreaView } from 'react-native';
import * as Speech from 'expo-speech';

const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const N_TILES = 6;

type Mode = 'classic' | 'reverse' | 'speed';

export default function GameScreen() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState('Choose a mode and press Start.');
  const [mode, setMode] = useState<Mode>('classic');
  const [accepting, setAccepting] = useState(false);
  const playerStepRef = useRef(0);
  const flashAnims = useRef(COLORS.map(() => new Animated.Value(0.4))).current;

  const speedForLevel = (lvl: number) =>
    mode === 'speed' ? Math.max(180, 500 - lvl * 22) : 450;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fire = (i: number, dur = 350) => {
    Speech.speak(String(i + 1));
    Vibration.vibrate(100 + i * 40);
    Animated.sequence([
      Animated.timing(flashAnims[i], { toValue: 1, duration: dur * 0.3, useNativeDriver: true }),
      Animated.timing(flashAnims[i], { toValue: 0.4, duration: dur * 0.5, useNativeDriver: true }),
    ]).start();
  };

  const playSequence = async (seq: number[], lvl: number) => {
    setAccepting(false);
    setStatus('Watch the pattern…');
    await sleep(500);
    const gap = speedForLevel(lvl);
    for (const idx of seq) {
      fire(idx, gap * 0.75);
      await sleep(gap);
    }
    playerStepRef.current = 0;
    setAccepting(true);
    setStatus(mode === 'reverse' ? 'Your turn — repeat it BACKWARDS' : 'Your turn — repeat the pattern');
  };

  const nextRound = useCallback(
    (currentSeq: number[], currentLevel: number) => {
      const newSeq = [...currentSeq, Math.floor(Math.random() * N_TILES)];
      setSequence(newSeq);
      playSequence(newSeq, currentLevel);
    },
    [mode]
  );

  const startGame = () => {
    setLevel(0);
    setStatus('Game started');
    nextRound([], 0);
  };

  const onTilePress = (i: number) => {
    if (!accepting) return;
    fire(i, 200);
    const expected =
      mode === 'reverse'
        ? sequence[sequence.length - 1 - playerStepRef.current]
        : sequence[playerStepRef.current];
    if (i !== expected) {
      setAccepting(false);
      setStatus(`Wrong! You reached level ${level}.`);
      Speech.speak(`Game over. You reached level ${level}.`);
      if (level > best) setBest(level);
      return;
    }
    playerStepRef.current++;
    if (playerStepRef.current === sequence.length) {
      const newLevel = level + 1;
      setLevel(newLevel);
      Speech.speak(`Level ${newLevel}`);
      setTimeout(() => nextRound(sequence, newLevel), 700);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>🎮 Multi-Sense Memory</Text>
      <Text style={styles.sub}>Sound (spoken number), flash, and vibration together on every tile.</Text>

      <View style={styles.hud}>
        <Text style={styles.hudText}>Level <Text style={styles.hudValue}>{level}</Text></Text>
        <Text style={styles.hudText}>Best <Text style={styles.hudValue}>{best}</Text></Text>
      </View>

      <View style={styles.board}>
        {COLORS.map((color, i) => (
          <Animated.View key={i} style={[styles.tileWrap, { opacity: flashAnims[i] }]}>
            <Pressable
              style={[styles.tile, { backgroundColor: color }]}
              onPress={() => onTilePress(i)}
              accessibilityLabel={`Tile ${i + 1}`}
            />
          </Animated.View>
        ))}
      </View>

      <View style={styles.modes}>
        {(['classic', 'reverse', 'speed'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
              {m === 'classic' ? 'Classic' : m === 'reverse' ? 'Reverse' : 'Speed Ramp'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.startBtn} onPress={startGame}>
        <Text style={styles.startText}>Start Game</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1115', alignItems: 'center', padding: 16, gap: 12 },
  title: { color: '#f2f3f5', fontSize: 20, fontWeight: '700', marginTop: 8 },
  sub: { color: '#9aa0ab', fontSize: 13, textAlign: 'center', maxWidth: 320 },
  hud: { flexDirection: 'row', gap: 20 },
  hudText: { color: '#f2f3f5', fontSize: 16, fontWeight: '600' },
  hudValue: { color: '#5eead4' },
  board: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', maxWidth: 340, justifyContent: 'center', gap: 10, marginTop: 8 },
  tileWrap: { width: '30%', aspectRatio: 1 },
  tile: { flex: 1, borderRadius: 16 },
  modes: { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%', maxWidth: 340 },
  modeBtn: { flex: 1, backgroundColor: '#1a1d24', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#9aa0ab' },
  modeBtnActive: { backgroundColor: '#5eead4', borderColor: '#5eead4' },
  modeText: { color: '#9aa0ab', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  modeTextActive: { color: '#04121a' },
  startBtn: { backgroundColor: '#5eead4', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  startText: { color: '#04121a', fontWeight: '700', fontSize: 16 },
  status: { color: '#9aa0ab', fontSize: 13, textAlign: 'center', marginTop: 4, minHeight: 20 },
});