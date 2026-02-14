"use client";

import dynamic from "next/dynamic";

const WireframeTerrain = dynamic(
  () => import("@/components/WireframeTerrain"),
  { ssr: false }
);

export default function ClientTerrain() {
  return <WireframeTerrain />;
}
