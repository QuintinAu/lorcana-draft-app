/**
 * Returns a random integer in [0, n)
 */
export function randomInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * Sample k items from arr without replacement
 */
export function sampleWithoutReplacement<T>(arr: T[], k: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  const max = Math.min(k, arr.length);
  
  for (let i = 0; i < max; i++) {
    const idx = randomInt(copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  
  return result;
}

/**
 * Shuffle an array in place (Fisher-Yates)
 */
export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Deep clone a value
 */
export function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

