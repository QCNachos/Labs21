"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentEvent } from "@/types";
import { EventFeed } from "@/components/EventFeed";
import { Activity } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events?limit=200");
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-light" />
            Event Stream
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Real-time feed of all agent activity
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <div className="w-2 h-2 rounded-full bg-success pulse-dot" />
          {events.length} events loaded
        </div>
      </div>

      <div className="bg-surface-800 border border-surface-700 rounded-xl">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Loading...</div>
        ) : (
          <EventFeed events={events} />
        )}
      </div>
    </div>
  );
}
