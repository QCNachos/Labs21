"use client";

import { useState } from "react";
import { UsageSummary } from "@/types/admin";
import { apiGet } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { BarChart3, Coins, Cpu, Activity, TrendingUp, Calendar } from "lucide-react";

const TIME_RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

type ChartMode = "tokens" | "cost";

function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  return value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(2)}`;
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const [chartMode, setChartMode] = useState<ChartMode>("tokens");
  const { data, loading, error } = useApi<UsageSummary>(
    `/admin?resource=usage&days=${days}`
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-surface-500 text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error}
      </div>
    );
  }

  const empty =
    !data || (data.total_runs === 0 && data.total_cost === 0 && data.total_tokens_in === 0);

  const totalTokens = data ? data.total_tokens_in + data.total_tokens_out : 0;
  const avgCostPerRun =
    data && data.total_runs > 0 ? data.total_cost / data.total_runs : 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-50">Usage</h1>
          <p className="text-sm text-surface-400 mt-1">
            Token usage, costs &amp; run statistics
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-lg p-1">
          <Calendar className="w-3.5 h-3.5 text-surface-500 ml-2" />
          {TIME_RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === r.days
                  ? "bg-accent text-white"
                  : "text-surface-400 hover:text-surface-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="text-center py-24 text-surface-500 text-sm">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-surface-600" />
          No usage data yet. Run some missions to see stats here.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Cpu className="w-4 h-4" />}
              label="Total Tokens"
              value={totalTokens.toLocaleString()}
              sub={`${data!.total_tokens_in.toLocaleString()} in / ${data!.total_tokens_out.toLocaleString()} out`}
            />
            <KpiCard
              icon={<Coins className="w-4 h-4" />}
              label="Total Cost"
              value={formatCost(data!.total_cost)}
            />
            <KpiCard
              icon={<Activity className="w-4 h-4" />}
              label="Total Runs"
              value={data!.total_runs.toLocaleString()}
            />
            <KpiCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Avg Cost / Run"
              value={formatCost(avgCostPerRun)}
            />
          </div>

          {/* Daily Chart */}
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                Daily Usage
              </h2>
              <div className="flex gap-1 bg-surface-900 border border-surface-700 rounded-lg p-0.5">
                <button
                  onClick={() => setChartMode("tokens")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartMode === "tokens"
                      ? "bg-accent text-white"
                      : "text-surface-400 hover:text-surface-200"
                  }`}
                >
                  Tokens
                </button>
                <button
                  onClick={() => setChartMode("cost")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartMode === "cost"
                      ? "bg-accent text-white"
                      : "text-surface-400 hover:text-surface-200"
                  }`}
                >
                  Cost
                </button>
              </div>
            </div>
            <BarChart daily={data!.daily} mode={chartMode} />
          </div>

          {/* Tables */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* By Agent */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-700">
                <h2 className="text-sm font-semibold text-surface-200">By Agent</h2>
              </div>
              {data!.by_agent.length === 0 ? (
                <div className="px-5 py-8 text-center text-surface-500 text-xs">
                  No agent data
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-surface-500 text-left">
                      <th className="px-5 py-3 font-medium">Agent</th>
                      <th className="px-5 py-3 font-medium text-right">Tokens</th>
                      <th className="px-5 py-3 font-medium text-right">Cost</th>
                      <th className="px-5 py-3 font-medium text-right">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.by_agent.map((row) => (
                      <tr
                        key={row.agent_slug}
                        className="border-t border-surface-700/50 hover:bg-surface-750 transition-colors"
                      >
                        <td className="px-5 py-3 text-surface-200 font-mono">
                          {row.agent_slug}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {row.tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {formatCost(row.cost)}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {row.runs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* By Model */}
            <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-700">
                <h2 className="text-sm font-semibold text-surface-200">By Model</h2>
              </div>
              {data!.by_model.length === 0 ? (
                <div className="px-5 py-8 text-center text-surface-500 text-xs">
                  No model data
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-surface-500 text-left">
                      <th className="px-5 py-3 font-medium">Model</th>
                      <th className="px-5 py-3 font-medium text-right">Tokens</th>
                      <th className="px-5 py-3 font-medium text-right">Cost</th>
                      <th className="px-5 py-3 font-medium text-right">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.by_model.map((row) => (
                      <tr
                        key={row.model}
                        className="border-t border-surface-700/50 hover:bg-surface-750 transition-colors"
                      >
                        <td className="px-5 py-3 text-surface-200 font-mono">
                          {row.model}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {row.tokens.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {formatCost(row.cost)}
                        </td>
                        <td className="px-5 py-3 text-surface-300 text-right">
                          {row.runs.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 text-surface-400 mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold text-surface-50">{value}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarChart({
  daily,
  mode,
}: {
  daily: UsageSummary["daily"];
  mode: ChartMode;
}) {
  if (daily.length === 0) {
    return (
      <div className="text-center py-12 text-surface-500 text-xs">
        No daily data
      </div>
    );
  }

  const values = daily.map((d) => (mode === "tokens" ? d.tokens : d.cost));
  const maxVal = Math.max(...values, 1);

  const formatLabel = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex items-end gap-[2px] h-48 overflow-x-auto pb-8 relative">
      {daily.map((d, i) => {
        const val = mode === "tokens" ? d.tokens : d.cost;
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const displayVal =
          mode === "tokens" ? val.toLocaleString() : formatCost(val);

        return (
          <div
            key={d.date}
            className="flex-1 min-w-[14px] max-w-[32px] flex flex-col items-center group relative"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-[11px] whitespace-nowrap shadow-lg">
                <p className="text-surface-400">{d.date}</p>
                <p className="text-surface-100 font-semibold">
                  {mode === "tokens" ? "Tokens" : "Cost"}: {displayVal}
                </p>
                <p className="text-surface-500">
                  {d.runs.toLocaleString()} run{d.runs !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Bar */}
            <div
              className="w-full rounded-t bg-accent/80 hover:bg-accent transition-colors cursor-default"
              style={{ height: `${Math.max(pct, 1)}%` }}
            />

            {/* Date label */}
            <span
              className="absolute -bottom-7 text-[9px] text-surface-500 whitespace-nowrap origin-top-left"
              style={{ transform: "rotate(45deg)" }}
            >
              {formatLabel(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
