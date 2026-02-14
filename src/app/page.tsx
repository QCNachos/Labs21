import ClientTerrain from "@/components/ClientTerrain";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      {/* 3D Wireframe Terrain */}
      <ClientTerrain />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between p-8 sm:p-12 md:p-16 pointer-events-none">
        {/* Header */}
        <header>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light tracking-[0.25em] text-zinc-900 uppercase">
            Labs21
          </h1>
        </header>

        {/* Bottom content */}
        <footer className="max-w-lg">
          <p className="text-sm sm:text-base font-light leading-relaxed tracking-wide text-zinc-500">
            Creating innovative technologies, products &amp; art since 2021.
          </p>
          <div className="mt-6 h-px w-16 bg-zinc-300" />
        </footer>
      </div>
    </div>
  );
}
