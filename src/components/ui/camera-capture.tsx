"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ImageUp, Loader2, RotateCcw, SwitchCamera, Timer, X } from "lucide-react";

/**
 * Full-screen (phone) / dialog (tablet, desktop) camera. Streams the device camera,
 * captures one frame, and lets the visitor retake it before handing back a JPEG File.
 * Falls back to the OS camera (`<input capture>`) when getUserMedia is unavailable
 * (insecure origin, old browser) or permission is denied.
 */

export type CameraFacing = "user" | "environment";
export type CameraGuide = "face" | "body";

type Props = {
  open: boolean;
  title: string;
  guide: CameraGuide;
  /** Camera to start with; the visitor can switch when the device has more than one. */
  initialFacing?: CameraFacing;
  /** Self-timer to start with, in seconds (0 = off). */
  initialTimer?: 0 | 3 | 10;
  fileName?: string;
  onCapture: (file: File) => void;
  onClose: () => void;
};

type Phase = "starting" | "live" | "countdown" | "review" | "error";

const TIMERS = [0, 3, 10] as const;

function errorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Akses kamera ditolak. Izinkan kamera di pengaturan browser, atau gunakan kamera bawaan perangkat.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Kamera tidak ditemukan di perangkat ini.";
  if (name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
  return "Kamera tidak bisa dibuka di browser ini.";
}

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window !== "undefined" && window.isSecureContext;
}

export function CameraCapture({
  open,
  title,
  guide,
  initialFacing = "user",
  initialTimer = 0,
  fileName = "kamera",
  onCapture,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [canSwitch, setCanSwitch] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(initialTimer);
  const [count, setCount] = useState(0);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start (or restart, after a switch / retake) the stream while the dialog is open.
  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;
    async function start() {
      setPhase("starting");
      setError(null);
      if (!cameraSupported()) {
        setError("Browser ini tidak mendukung kamera langsung. Gunakan kamera bawaan perangkat.");
        setPhase("error");
        return;
      }
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) {
          setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
          setPhase("live");
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setPhase("error");
        }
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [open, facing, shot, stop]);

  // Release the camera when the dialog closes, and the preview on unmount. Callers
  // remount the dialog per use (`key`), so no captured state outlives a session.
  const shotUrlRef = useRef<string | null>(null);
  useEffect(() => {
    shotUrlRef.current = shot?.url ?? null;
  }, [shot]);
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  useEffect(
    () => () => {
      stop();
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
    },
    [stop],
  );

  // Lock page scroll, focus the dialog, close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const grab = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // The live preview is mirrored for the front camera; the photo itself is not.
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        setShot({ blob, url: URL.createObjectURL(blob) });
        setPhase("review");
      },
      "image/jpeg",
      0.92,
    );
  }, [stop]);

  // Self-timer countdown.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      grab();
      return;
    }
    const t = setTimeout(() => setCount((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, grab]);

  function shoot() {
    if (phase === "countdown") {
      setPhase("live");
      setCount(0);
      return;
    }
    if (timer > 0) {
      setCount(timer);
      setPhase("countdown");
    } else grab();
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null); // restarts the stream via the effect above
  }

  function use() {
    if (!shot) return;
    const file = new File([shot.blob], `${fileName}-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    URL.revokeObjectURL(shot.url);
    setShot(null);
    onCapture(file);
  }

  if (!open || typeof document === "undefined") return null;

  const mirrored = facing === "user";
  const live = phase === "live" || phase === "countdown";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-lenis-prevent
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-ink/80 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-ink text-paper sm:h-[min(92dvh,52rem)] sm:max-w-xl sm:rounded-[1.75rem] sm:shadow-2xl sm:ring-1 sm:ring-paper/10 lg:max-w-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-light">Kamera</p>
            <h2 className="truncate font-display text-xl leading-tight">{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup kamera"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/10 text-paper transition hover:bg-paper/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative min-h-0 flex-1 bg-navy">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            aria-label="Pratinjau kamera"
            className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""} ${live ? "opacity-100" : "opacity-0"}`}
          />
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={shot.url} alt="Hasil foto kamera" className="absolute inset-0 h-full w-full object-contain" />
          )}

          {live && <GuideOverlay guide={guide} />}

          {phase === "countdown" && count > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span key={count} className="font-display text-8xl text-paper drop-shadow-[0_4px_24px_rgba(13,27,42,0.8)]">
                {count}
              </span>
            </div>
          )}

          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-paper/80">
              <Loader2 size={18} className="animate-spin" /> Membuka kamera…
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <Camera size={32} className="text-accent-light" />
              <p role="alert" className="max-w-sm text-sm leading-relaxed text-paper/90">
                {error}
              </p>
              <button
                type="button"
                onClick={() => fallbackRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream"
              >
                <ImageUp size={16} /> Gunakan kamera bawaan
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
          {phase === "review" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={retake}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-paper/25 px-4 text-sm font-semibold text-paper transition hover:bg-paper/10"
              >
                <RotateCcw size={16} /> Ambil ulang
              </button>
              <button
                type="button"
                onClick={use}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-light px-4 text-sm font-semibold text-ink transition hover:bg-paper"
              >
                <Check size={16} /> Gunakan foto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button
                type="button"
                onClick={() => setTimer((t) => TIMERS[(TIMERS.indexOf(t) + 1) % TIMERS.length])}
                disabled={phase !== "live"}
                aria-label={`Timer: ${timer ? `${timer} detik` : "mati"}`}
                className="inline-flex h-11 items-center justify-self-start gap-1.5 rounded-full bg-paper/10 px-3.5 text-xs font-semibold text-paper transition hover:bg-paper/20 disabled:opacity-40"
              >
                <Timer size={16} /> {timer ? `${timer} dtk` : "Timer"}
              </button>
              <button
                type="button"
                onClick={shoot}
                disabled={!live}
                aria-label={phase === "countdown" ? "Batalkan timer" : "Ambil foto"}
                className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-paper/80 transition disabled:opacity-40"
              >
                <span
                  className={`block rounded-full transition-all ${phase === "countdown" ? "h-7 w-7 rounded-md bg-accent-light" : "h-14 w-14 bg-paper hover:bg-cream"}`}
                />
              </button>
              {canSwitch ? (
                <button
                  type="button"
                  onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                  disabled={phase !== "live"}
                  aria-label="Ganti kamera depan/belakang"
                  className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-paper/10 text-paper transition hover:bg-paper/20 disabled:opacity-40"
                >
                  <SwitchCamera size={18} />
                </button>
              ) : (
                <span />
              )}
            </div>
          )}
          <p className="mt-3 text-center text-[11px] leading-snug text-paper/60">
            {phase === "review"
              ? "Periksa hasilnya. Ambil ulang bila buram, gelap, atau terpotong."
              : guide === "face"
                ? "Posisikan wajah di dalam oval, cahaya dari depan."
                : "Seluruh badan masuk bingkai, dari kepala sampai kaki. Pakai timer bila memotret sendiri."}
          </p>
        </div>
      </div>

      <input
        ref={fallbackRef}
        type="file"
        accept="image/*"
        capture={facing}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onCapture(f);
        }}
      />
    </div>,
    document.body,
  );
}

/** Framing guide drawn over the live view. */
function GuideOverlay({ guide }: { guide: CameraGuide }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {guide === "face" ? (
        <ellipse cx="50" cy="46" rx="24" ry="31" fill="none" stroke="#faf8ef" strokeOpacity="0.85" strokeWidth="0.6" strokeDasharray="2 1.6" />
      ) : (
        <rect x="27" y="5" width="46" height="90" rx="6" fill="none" stroke="#faf8ef" strokeOpacity="0.85" strokeWidth="0.6" strokeDasharray="2 1.6" />
      )}
    </svg>
  );
}
