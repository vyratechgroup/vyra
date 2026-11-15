"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

function LenisController() {
  const pathname = usePathname();

  useEffect(() => {
    // ponytail: excludes all /admin routes by prefix; upgrade to route-level motion layout if granular admin smooth-scroll is ever needed.
    if (pathname?.startsWith("/admin")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.13, anchors: { offset: -72 } });
    return () => lenis.destroy();
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;
    return pauseOffscreenAnimations();
  }, [pathname]);

  return null;
}

// Honors the visitor's OS "reduce motion" setting for every motion component, and adds
// inertial smooth scrolling (Lenis) for everyone else. Lenis drives the native scroll
// position, so Motion's useScroll keeps working unchanged.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={null}>
        <LenisController />
      </Suspense>
      {children}
    </MotionConfig>
  );
}

// The landing page has dozens of looping animations. The browser keeps running them
// even when their section is far off screen, which costs CPU and battery on every
// frame. This pauses the looping animations inside a section that is out of view and
// resumes them when the section comes back. Sections that mount animations later are
// caught by a light periodic sweep of the off-screen ones.
//
// Only endless loops are touched. One-off animations (reveals as a section scrolls in)
// finish on their own; pausing one mid-way could leave an element stuck part-way, then
// jump when resumed, which moved the pricing tag out from under the pointer.
function pauseOffscreenAnimations() {
  if (typeof IntersectionObserver === "undefined" || !document.getAnimations) return;

  const offscreen = new Set<Element>();
  const loops = (el: Element) =>
    el.getAnimations({ subtree: true }).filter((a) => a.effect?.getTiming().iterations === Infinity);
  const setPaused = (el: Element, paused: boolean) => {
    for (const a of loops(el)) {
      if (paused && a.playState === "running") a.pause();
      else if (!paused && a.playState === "paused") a.play();
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          offscreen.delete(e.target);
          setPaused(e.target, false);
        } else {
          offscreen.add(e.target);
          setPaused(e.target, true);
        }
      }
    },
    // Resume a little before a section scrolls in, so nothing visibly starts late.
    { rootMargin: "200px 0px" },
  );

  const observe = () => document.querySelectorAll("main section, main > div").forEach((s) => io.observe(s));
  observe();
  const sweep = window.setInterval(() => {
    observe(); // picks up sections added by client navigation; observing twice is a no-op
    offscreen.forEach((s) => setPaused(s, true));
  }, 1500);

  return () => {
    io.disconnect();
    window.clearInterval(sweep);
  };
}
