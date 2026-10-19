export function decisionClassify(input: { state: string; questions: any }): { answers: any; rationale: string; latencyMs: number } {
  // Heuristic internal, deterministik, mandiri
  const answers: any = {};
  const q = input.questions || {};
  for (const key of Object.keys(q)) {
    answers[key] = { choice: "default", score: 0.5, noul: false };
  }
  return { answers, rationale: "rule-based", latencyMs: 0 };
}

export function decisionHealth() {
  return { status: "ok", backend: "internal", latencyMs: 0 };
}
