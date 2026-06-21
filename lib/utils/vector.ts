// ==================== 向量检索工具函数 ====================

/** 余弦相似度计算 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不匹配: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 从知识条目中检索最相似的 N 条 */
export function findTopK<T extends { embedding: number[] }>(
  queryEmbedding: number[],
  entries: T[],
  k: number,
  minScore = 0.3,
): Array<{ entry: T; score: number }> {
  const scored = entries
    .filter((e) => e.embedding && e.embedding.length > 0)
    .map((entry) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
    }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}
