const MODELS = [
  { id: "anthropic:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", tier: "smart", ctx: 200_000, cost: "$5 / $25 per 1M", env: "ANTHROPIC_API_KEY", description: "Anthropic flagship. Best reasoning & writing." },
  { id: "openai:gpt-5", label: "GPT-5", provider: "OpenAI", tier: "smart", ctx: 400_000, cost: "$1.25 / $10 per 1M", env: "OPENAI_API_KEY", description: "OpenAI flagship. Text, images, structured output." },
  { id: "openrouter:qwen/qwen3.5-397b-a17b-20260216", label: "Qwen 3.5 (397B)", provider: "OpenRouter", tier: "fast", ctx: 262_144, cost: "$0.15 / $1 per 1M", env: "OPENROUTER_API_KEY", description: "Feb 2026 flagship. MoE 397B, multimodal, 262k ctx." },
  { id: "openrouter:minimax/minimax-m1", label: "MiniMax M1 (1M ctx)", provider: "OpenRouter", tier: "fast", ctx: 1_000_000, cost: "Free input / $0.002 per 1M out", env: "OPENROUTER_API_KEY", description: "1M context window. Essentially free." },
  { id: "openrouter:qwen/qwen3-32b", label: "Qwen 3 (32B)", provider: "OpenRouter", tier: "free", ctx: 131_000, cost: "$0.08 / $0.24 per 1M", env: "OPENROUTER_API_KEY", description: "Best value. Strong performance at near-zero cost." },
];

function fmtCtx(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.floor(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${Math.floor(tokens / 1_000)}k`;
  return String(tokens);
}

export async function GET() {
  try { require("@supabase/supabase-js"); } catch (e) { return Response.json({ error: "supabase import failed", detail: String(e) }, { status: 500 }); }
  const result = MODELS.map((m) => {
    const val = process.env[m.env] ?? "";
    const available = Boolean(val.trim());
    return {
      ...m,
      ctx_label: fmtCtx(m.ctx),
      available,
      unavailable_reason: available ? null : `Add ${m.env} to environment`,
    };
  });
  return Response.json(result);
}
