export function simpleEditDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

export function patchLineIfSafe(
  original: string,
  candidate: string
): { accepted: boolean; value: string; reason?: string } {
  const o = original.trim();
  const c = candidate.trim();
  if (!c) {
    return { accepted: false, value: original, reason: "empty_candidate" };
  }

  const dist = simpleEditDistance(o, c);
  const ratio = dist / Math.max(o.length, c.length, 1);

  // حد آمن: تصحيح OCR وليس إعادة كتابة
  if (ratio > 0.45) {
    return { accepted: false, value: original, reason: "too_different" };
  }

  return { accepted: true, value: c };
}
