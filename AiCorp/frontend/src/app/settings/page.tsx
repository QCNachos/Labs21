"use client";

import { useEffect, useState, useCallback } from "react";
import { Policy } from "@/types";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/policy");
      if (res.ok) setPolicies(await res.json());
    } catch (err) {
      console.error("Failed to fetch policies:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-accent-light" />
          Settings
        </h1>
        <p className="text-sm text-surface-400 mt-0.5">
          Policy-driven configuration -- all behavior toggles live here
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-surface-500">Loading...</div>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.key}
              className="bg-surface-800 border border-surface-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-surface-200 font-mono">
                    {policy.key}
                  </h3>
                  {policy.description && (
                    <p className="text-xs text-surface-500 mt-0.5">
                      {policy.description}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-surface-600">
                  Updated:{" "}
                  {new Date(policy.updated_at).toLocaleDateString()}
                </span>
              </div>
              <pre className="bg-surface-900 rounded-lg p-3 text-xs text-surface-300 font-mono overflow-x-auto">
                {JSON.stringify(policy.value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
