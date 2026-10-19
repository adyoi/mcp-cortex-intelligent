export function selfCritique(artifact: string): { score: number; issues: string[]; suggestions: string[] } {
  const checks = [
    { name: "has_tests", pass: /test|spec/i.test(artifact) },
    { name: "read_before_edit", pass: /read/i.test(artifact) },
    { name: "no_secrets", pass: !/(api[_-]?key|token|password)/i.test(artifact) },
    { name: "has_verification", pass: /npm (test|run lint|run typecheck)/i.test(artifact) },
  ];
  const score = checks.filter(c => c.pass).length / checks.length;
  const issues = checks.filter(c => !c.pass).map(c => `Missing: ${c.name}`);
  return { score, issues, suggestions: issues.map(i => `Add ${i}`) };
}
