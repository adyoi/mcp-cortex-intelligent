export const SKILL_VERSION = "1.0.0";

export function skillAutoBlock(): string {
  return `# Cognitive Procedure (auto)

Standard procedure:
1. Plan
2. Read (files before edit)
3. Edit (minimal change)
4. Verify (test, lint, typecheck)
5. Review (diff + self_critique)

Anti-blunder checklist:
- Do not assume paths exist.
- Do not edit without reading.
- Do not skip verification.
- Do not store secrets.

When to use:
- self_critique before final.
- retrieve_exemplars when unsure.
- model_decision for tier/risk/route.`;
}

export function skillPath(projectRoot: string): string {
  return `${projectRoot}/.opencode/skills/cognitive-procedure/SKILL.md`;
}
