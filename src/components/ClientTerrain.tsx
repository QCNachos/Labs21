"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const WireframeTerrain = dynamic(
  () => import("@/components/WireframeTerrain"),
  { ssr: false }
);

export default function ClientTerrain() {
  const [ready, setReady] = useState(false);

  return (
    <div
      className="absolute inset-0 z-0 transition-opacity duration-[2000ms] ease-out"
      style={{ opacity: ready ? 1 : 0 }}
    >
      <WireframeTerrain onReady={() => setReady(true)} />
    </div>
  );
}
