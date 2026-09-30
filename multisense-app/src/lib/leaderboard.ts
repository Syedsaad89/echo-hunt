import AsyncStorage from '@react-native-async-storage/async-storage';

export type ScoreEntry = { name: string; score: number; date: string };

export async function getLeaderboard(key: string): Promise<ScoreEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(`leaderboard_${key}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

export async function addScore(key: string, name: string, score: number): Promise<ScoreEntry[]> {
  const list = await getLeaderboard(key);
  list.push({ name: name.trim() || 'Anonymous', score, date: new Date().toISOString().slice(0, 10) });
  list.sort((a, b) => b.score - a.score);
  const top10 = list.slice(0, 10);
  try { await AsyncStorage.setItem(`leaderboard_${key}`, JSON.stringify(top10)); } catch (e) {}
  return top10;
}
