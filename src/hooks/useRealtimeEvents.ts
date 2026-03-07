"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { invalidate } from "./useApi";

interface RealtimeEvent {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

type EventHandler = (event: RealtimeEvent) => void;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const TABLE_TO_API_PATH: Record<string, string[]> = {
  ops_agents: ["/agents"],
  ops_missions: ["/missions"],
  ops_mission_steps: ["/missions"],
  ops_mission_proposals: ["/proposals"],
  ops_agent_events: ["/events"],
  ops_projects: ["/projects"],
  ops_briefings: ["/comms?resource=briefings"],
  ops_instructions: ["/comms?resource=instructions"],
  ops_daily_reports: ["/reports?resource=daily"],
  ops_board_meetings: ["/reports?resource=board"],
  ops_departments: ["/departments"],
  ops_templates: ["/admin?resource=templates"],
};

export function useRealtimeEvents(
  tables: string[] = ["ops_agent_events", "ops_missions", "ops_mission_proposals"],
  onEvent?: EventHandler
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "phx_reply" && data.payload?.status === "ok") {
          setConnected(true);
          return;
        }
        if (data.event === "postgres_changes") {
          const change = data.payload?.data;
          if (!change) return;

          const realtimeEvent: RealtimeEvent = {
            table: change.table,
            eventType: change.type,
            new: change.record || {},
            old: change.old_record || {},
          };

          const paths = TABLE_TO_API_PATH[change.table] || [];
          for (const path of paths) {
            invalidate(path);
          }

          onEvent?.(realtimeEvent);
        }
      } catch {
        // ignore parse errors
      }
    },
    [onEvent]
  );

  const connect = useCallback(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket?apikey=" + SUPABASE_ANON_KEY + "&vsn=1.0.0";

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          topic: "realtime:*",
          event: "phx_join",
          payload: {
            config: {
              postgres_changes: tables.map((table) => ({
                event: "*",
                schema: "public",
                table,
              })),
            },
          },
          ref: "1",
        }));

        // Heartbeat
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              topic: "phoenix",
              event: "heartbeat",
              payload: {},
              ref: Date.now().toString(),
            }));
          }
        }, 30_000);

        ws.onclose = () => {
          clearInterval(heartbeat);
          setConnected(false);
          reconnectTimer.current = setTimeout(connect, 5_000);
        };
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setConnected(false);
      };
    } catch {
      setConnected(false);
    }
  }, [tables, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected };
}
