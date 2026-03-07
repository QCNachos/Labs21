# OpenClaw Settings — Labs21

Prepared from the [OpenClaw Configuration Guide](https://www.getopenclaw.ai/docs/configuration).

## Setup

1. Install OpenClaw: `npm install -g openclaw` or `bun add -g openclaw`
2. Copy config: `cp openclaw.json ~/.openclaw/openclaw.json`
3. Copy env template: `cp .env.example ~/.openclaw/.env`
4. Add your API keys to `~/.openclaw/.env`
5. Generate gateway token: `openssl rand -hex 32` → set as `GATEWAY_TOKEN`
6. Validate: `openclaw doctor`

## Model Tiers (Labs21)

| Tier | Primary | Fallbacks |
|------|---------|-----------|
| CEO | Claude Opus 4.5 | Claude Sonnet, GPT-4o |
| Default | Claude Sonnet 4 | Claude Haiku, GPT-4o, MiniMax M2.1 |

## Agents

- **ceo** — High-level planning, board reports, strategic decisions
- **main** — General assistant for daily operations

Switch with `/agent ceo` or `/agent main` in any channel.

## Gateway

```bash
openclaw gateway start   # Background daemon
openclaw gateway run     # Foreground (debug)
openclaw gateway status
```

Default port: 18789. Auth: Bearer token from `GATEWAY_TOKEN`.

## File Locations

| Path | Purpose |
|------|---------|
| ~/.openclaw/openclaw.json | Main config |
| ~/.openclaw/.env | API keys (chmod 600) |
| ~/.openclaw/agents/{id}/SOUL.md | Per-agent identity/personality |
| ~/clawd/ | Default workspace |
