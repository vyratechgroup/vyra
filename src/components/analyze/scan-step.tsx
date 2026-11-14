"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { easeOut } from "@/components/motion/reveal";
import { SweepLine } from "@/components/motion/shapes";
import { LandmarkDots } from "./photo-step";

type Point = { x: number; y: number };
type Shot = { url: string | null; points: Point[] };
type Kind = "face" | "body";

// Step 3: the visitor's own photos being read, on the same pinboard and polaroid prints
// as step 2. The face is read first (colour), its print large and the body print small
// beside it; then the two swap places in size, and the body print is read (proportions).
// After both scans complete and the server is ready, both photos merge side-by-side
// in a unified celebration state before transitioning to Step 4.

const PHASES = [
  { at: "face", text: "Membaca warna kulit, rambut, dan mata", ms: 2500 },
  { at: "face", text: "Menimbang undertone dan kontras", ms: 2500 },
  { at: "body", text: "Mengukur garis bahu, pinggang, dan pinggul", ms: 2700 },
  { at: "body", text: "Mencocokkan siluet yang paling sesuai", ms: 2700 },
  { at: "merge", text: "Menghubungkan analisis wajah & siluet tubuh", ms: 1500 },
] as const;

const PRINT: Record<Kind, { caption: string; aspect: string; big: string; small: string; tilt: number }> = {
  face: { caption: "wajahmu", aspect: "aspect-square", big: "w-[54%]", small: "w-[24%]", tilt: 2.5 },
  body: { caption: "badanmu", aspect: "aspect-[3/4]", big: "w-[44%]", small: "w-[20%]", tilt: -2.5 },
};

export function ScanStep({
  face,
  body,
  uploading,
  serverReady,
  onComplete,
}: {
  face: Shot;
  body: Shot;
  uploading: boolean;
  serverReady?: boolean;
  onComplete?: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [bodyScanDone, setBodyScanDone] = useState(false);

  useEffect(() => {
    if (uploading) return;

    // Phases 0, 1, 2 advance on their timers
    if (phase < 3) {
      const t = setTimeout(() => setPhase((p) => p + 1), PHASES[phase].ms);
      return () => clearTimeout(t);
    }

    // Phase 3 (body scan second half) finishes
    if (phase === 3) {
      const t = setTimeout(() => {
        setBodyScanDone(true);
        if (serverReady) {
          setPhase(4);
        }
      }, PHASES[3].ms);
      return () => clearTimeout(t);
    }

    // Phase 4 (2-photo merge celebration) finishes
    if (phase === 4) {
      const t = setTimeout(() => {
        onComplete?.();
      }, PHASES[4].ms);
      return () => clearTimeout(t);
    }
  }, [uploading, phase, serverReady, onComplete]);

  // When body scan has completed and server signals ready, advance to merge celebration
  useEffect(() => {
    if (!uploading && phase === 3 && bodyScanDone && serverReady) {
      const t = setTimeout(() => setPhase(4), 250);
      return () => clearTimeout(t);
    }
  }, [uploading, phase, bodyScanDone, serverReady]);

  const merged = !uploading && phase >= 4;
  const focus: Kind | null = uploading ? "face" : merged ? null : (PHASES[phase].at as Kind);
  const shots = { face, body };

  return (
    <div className="flex w-full flex-col items-center" role="status" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-deep">
        {merged ? "Langkah 3 · Selesai" : "Langkah 3 · Analisis"}
      </p>
      <h1 className="mt-3 text-center font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-5xl">
        {uploading ? (
          <>Mengirim fotomu…</>
        ) : merged ? (
          <>
            Analisis <em className="text-accent">Selesai</em>
          </>
        ) : focus === "face" ? (
          <>
            Membaca <em className="text-accent">wajahmu</em>
          </>
        ) : (
          <>
            Membaca <em className="text-accent">siluetmu</em>
          </>
        )}
      </h1>

      {/* the pinboard */}
      <div className="relative mt-8 w-full max-w-2xl overflow-hidden rounded-[2rem] bg-paper px-5 py-8 ring-1 ring-line shadow-[0_30px_60px_-40px_rgba(37,34,31,0.45)] sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(154,128,96,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(154,128,96,0.09)_1px,transparent_1px)] [background-size:22px_22px]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft/60 blur-3xl" />

        <div className="relative flex min-h-[18rem] items-center justify-center gap-[4%] sm:gap-[6%] sm:min-h-[22rem]">
          {(["face", "body"] as const).map((k, i) => (
            <ScanPrint
              key={k}
              kind={k}
              shot={shots[k]}
              order={i}
              active={focus === k}
              scanning={focus === k && !uploading}
              done={merged || (k === "face" && focus === "body")}
              merged={merged}
            />
          ))}

          {/* Merge badge celebrating the connection between face and body analysis */}
          {merged && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.15 }}
              className="pointer-events-none absolute z-20 flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xl ring-4 ring-paper"
            >
              <Check size={14} className="stroke-[3]" />
              <span>Analisis Selesai</span>
            </motion.div>
          )}
        </div>

        {/* which read is on: 1 wajah, 2 badan */}
        <div className="relative mt-6 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.18em]">
          {(["face", "body"] as const).map((k, i) => {
            const isDone = merged || (k === "face" && focus === "body");
            const isActive = focus === k;
            return (
              <span key={k} className="flex items-center gap-3">
                {i > 0 && <span className="h-px w-8 bg-line" />}
                <span className={`flex items-center gap-1.5 transition-colors duration-500 ${isActive || isDone ? "text-accent-deep" : "text-muted"}`}>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-500 ${
                      isDone ? "bg-emerald-600 text-white" : isActive ? "bg-accent-soft text-accent-deep" : "bg-cream text-muted"
                    }`}
                  >
                    {isDone ? <Check size={11} className="stroke-[3]" /> : i + 1}
                  </span>
                  {k === "face" ? "Warna" : "Bentuk tubuh"}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex h-12 items-start justify-center px-2 sm:h-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={uploading ? "up" : phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: easeOut }}
            className="text-center text-muted"
          >
            {uploading
              ? "Mengunggah foto dengan aman"
              : phase >= PHASES.length || (phase === 3 && bodyScanDone)
              ? "Menyusun laporan gayamu"
              : PHASES[phase].text}…
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="mt-6 text-xs text-muted">Biasanya selesai dalam 15–25 detik. Halaman ini boleh direfresh.</p>
    </div>
  );
}

/**
 * A polaroid print on the board. The one being read is large and scanned; the other is
 * small and tilted aside. Size changes animate through layout, so the two trade places
 * in one smooth turn. In merged mode, both prints settle in balanced proportions.
 */
function ScanPrint({
  kind,
  shot,
  order,
  active,
  scanning,
  done,
  merged,
}: {
  kind: Kind;
  shot: Shot;
  order: number;
  active: boolean;
  scanning: boolean;
  done: boolean;
  merged?: boolean;
}) {
  const p = PRINT[kind];
  const widthClass = merged
    ? kind === "face"
      ? "w-[40%] sm:w-[32%]"
      : "w-[34%] sm:w-[28%]"
    : active
    ? `${p.big} z-10`
    : `${p.small} self-start`;

  const rotation = merged
    ? kind === "face"
      ? -2
      : 2
    : active
    ? p.tilt / 2
    : p.tilt * 2;

  return (
    <motion.div
      layout
      transition={{ layout: { type: "spring", stiffness: 140, damping: 20 } }}
      className={`relative shrink-0 ${widthClass}`}
      style={{ order }}
    >
      <motion.div
        animate={{ rotate: rotation, opacity: active || done || merged ? 1 : 0.7 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        {/* washi tape */}
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-1/2 z-10 h-5 w-[46%] -translate-x-1/2 rotate-[-3deg] bg-accent-light/55 shadow-sm [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
        />
        <figure
          className={`bg-white p-[6%] pb-0 ring-1 transition-all duration-500 ${
            merged
              ? "ring-2 ring-accent/60 shadow-[0_24px_45px_-15px_rgba(154,128,96,0.5)]"
              : active
              ? "ring-black/5 shadow-[0_34px_50px_-24px_rgba(37,34,31,0.6)]"
              : "ring-black/5 shadow-[0_18px_28px_-18px_rgba(37,34,31,0.5)]"
          }`}
        >
          <span className={`relative block overflow-hidden bg-cream ${p.aspect}`}>
            {shot.url && (
              // eslint-disable-next-line @next/next/no-img-element -- local blob or short-lived signed URL
              <img src={shot.url} alt={`Foto ${p.caption} yang dianalisis`} className="absolute inset-0 h-full w-full object-cover" />
            )}
            {scanning && (
              <>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(250,248,244,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(250,248,244,0.14)_1px,transparent_1px)] bg-[size:20px_20px]" />
                <SweepLine
                  from="6%"
                  to="94%"
                  duration={2.4}
                  className="inset-x-0 h-14 -translate-y-1/2 bg-gradient-to-b from-transparent via-accent-light/35 to-transparent"
                />
                <SweepLine
                  from="6%"
                  to="94%"
                  duration={2.4}
                  className="inset-x-2 h-0.5 rounded-full bg-paper shadow-[0_0_16px_4px_rgba(201,179,143,0.75)]"
                />
                <LandmarkDots key={kind} points={shot.points} delay={0.5} />
              </>
            )}
            {done && (
              <motion.span
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 15, delay: merged ? 0.1 : 0.25 }}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-white"
              >
                <Check size={14} className="stroke-[3]" />
              </motion.span>
            )}
          </span>
          <figcaption
            className={`flex items-center justify-center font-display italic text-ink/80 transition-all duration-500 ${
              merged
                ? "h-[2.2rem] text-sm sm:h-[2.5rem] sm:text-base"
                : active
                ? "h-[2.4rem] text-base sm:h-[2.8rem] sm:text-lg"
                : "h-[1.6rem] text-xs sm:h-[1.9rem] sm:text-sm"
            }`}
          >
            {p.caption}
          </figcaption>
        </figure>
      </motion.div>
    </motion.div>
  );
}
