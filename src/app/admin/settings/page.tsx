"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { Integration } from "@/types/admin";
import { CheckCircle, AlertTriangle, Server, Database, Zap, Mail, Plug, ExternalLink } from "lucide-react";

export default function SettingsPage() {
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const testHeartbeat = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiPost<{ triggers?: { fired: number }; reactions?: { created: number }; timestamp: string }>("/ops/heartbeat", {});
      setTestResult({ ok: true, message: `Heartbeat OK — ${result.triggers?.fired ?? 0} triggers fired, ${result.reactions?.created ?? 0} reactions created` });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Heartbeat failed" });
    } finally {
      setTesting(false);
    }
  };

  const envVars = [
    { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", public: true },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key", public: true },
    { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role Key (server only)" },
    { key: "OPS_API_SECRET", label: "OPS API Secret (server only)" },
    { key: "NEXT_PUBLIC_OPS_API_SECRET", label: "OPS API Secret (public, for admin write ops)", public: true },
    { key: "CEO_EMAIL_TO", label: "CEO Report Recipient Email" },
    { key: "OPENAI_API_KEY", label: "OpenAI API Key" },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic API Key" },
  ];

  return (
    <div className="p-8 space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-surface-50">Settings</h1>
        <p className="text-sm text-surface-400 mt-1">System configuration &amp; diagnostics</p>
      </div>

      {/* Architecture note */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-accent-light" />
          <h2 className="text-sm font-semibold text-surface-200">Data Architecture</h2>
        </div>
        <p className="text-xs text-surface-400 leading-relaxed">
          All Supabase connections happen exclusively through Python serverless functions at <code className="bg-surface-700 px-1 py-0.5 rounded text-accent-light">/api/*.py</code>. 
          The Next.js frontend never connects to Supabase directly — it calls <code className="bg-surface-700 px-1 py-0.5 rounded text-accent-light">/api/...</code> endpoints 
          which are routed to Python functions on Vercel. The VPS worker uses the same Python API endpoints.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-surface-400">
          <span className="bg-surface-700 rounded px-2 py-0.5">Browser</span>
          <span>→</span>
          <span className="bg-surface-700 rounded px-2 py-0.5">Next.js UI</span>
          <span>→</span>
          <span className="bg-accent/20 text-accent-light rounded px-2 py-0.5">Python /api/*.py</span>
          <span>→</span>
          <span className="bg-surface-700 rounded px-2 py-0.5">Supabase</span>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-surface-200">Diagnostics</h2>
        </div>

        <button
          onClick={testHeartbeat}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <Server className="w-4 h-4" />
          {testing ? "Running heartbeat…" : "Trigger Heartbeat"}
        </button>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.ok ? "bg-success/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Integrations */}
      <IntegrationsSection />

      {/* Env vars reference */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-surface-200 mb-4">Required Environment Variables</h2>
        <div className="space-y-2">
          {envVars.map((v) => (
            <div key={v.key} className="flex items-start gap-3">
              <code className="text-xs font-mono text-accent-light bg-accent/5 px-2 py-0.5 rounded">{v.key}</code>
              <span className="text-xs text-surface-400">{v.label}</span>
              {v.public && <span className="text-[10px] text-surface-500 bg-surface-700 px-1.5 py-0.5 rounded">public</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationsSection() {
  const { data: integrations = [] } = useApi<Integration[]>("/admin?resource=integrations");

  const gmailIntegration = integrations.find((i) => i.provider === "gmail");
  const isGmailConnected = gmailIntegration?.status === "connected";

  const AVAILABLE_INTEGRATIONS = [
    {
      provider: "gmail",
      label: "Gmail",
      icon: Mail,
      description: "Read inbox, draft replies, send emails (with approval). Requires GCP OAuth setup.",
      status: isGmailConnected ? "connected" : "disconnected",
      setup: "Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in environment, then visit the OAuth consent URL.",
    },
    {
      provider: "drive",
      label: "Google Drive",
      icon: Database,
      description: "Access and manage files in Google Drive.",
      status: "disconnected",
      setup: "Coming in a future update. Currently uses gws CLI for Drive access.",
    },
  ];

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Plug className="w-4 h-4 text-blue-400" />
        <h2 className="text-sm font-semibold text-surface-200">Integrations</h2>
      </div>
      <div className="space-y-3">
        {AVAILABLE_INTEGRATIONS.map((int_item) => {
          const Icon = int_item.icon;
          return (
            <div key={int_item.provider} className="flex items-start gap-3 p-3 bg-surface-900 border border-surface-700 rounded-lg">
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${int_item.status === "connected" ? "text-green-400" : "text-surface-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-surface-200">{int_item.label}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${int_item.status === "connected" ? "bg-green-500/10 text-green-400" : "bg-surface-700 text-surface-500"}`}>
                    {int_item.status}
                  </span>
                </div>
                <p className="text-xs text-surface-400">{int_item.description}</p>
                {int_item.status === "disconnected" && (
                  <p className="text-[11px] text-surface-500 mt-1.5">{int_item.setup}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
