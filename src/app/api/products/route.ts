import { connection } from "next/server";
import { json } from "@/lib/http/respond";
import { getStore } from "@/lib/store";
import type { Product } from "@/types/domain";

const SHAPE_SYNONYMS: Record<string, string[]> = {
  hourglass: ["hourglass", "jam pasir", "jam_pasir"],
  rectangle: ["rectangle", "persegi", "persegi panjang", "persegi_panjang", "lurus"],
  pear: ["pear", "pir", "segitiga", "triangle"],
  inverted_triangle: ["inverted_triangle", "inverted triangle", "segitiga terbalik", "segitiga_terbalik"],
  apple: ["apple", "apel", "round", "bulat"],
};

const TONE_SYNONYMS: Record<string, string[]> = {
  autumn: ["autumn", "gugur", "musim gugur", "warm autumn", "deep autumn", "soft autumn", "true autumn", "hangat", "warm"],
  spring: ["spring", "semi", "musim semi", "warm spring", "light spring", "bright spring", "true spring", "hangat", "warm"],
  summer: ["summer", "panas", "musim panas", "cool summer", "light summer", "soft summer", "true summer", "dingin", "cool"],
  winter: ["winter", "musim dingin", "cool winter", "deep winter", "bright winter", "true winter", "dingin", "cool", "sejuk"],
};

function normalizeShapeTerms(shape: string): string[] {
  const s = shape.toLowerCase().trim();
  const terms = new Set<string>([s]);
  for (const [canonical, synonyms] of Object.entries(SHAPE_SYNONYMS)) {
    if (synonyms.some((syn) => syn === s || s.includes(syn) || syn.includes(s))) {
      terms.add(canonical);
      for (const syn of synonyms) terms.add(syn);
    }
  }
  return Array.from(terms);
}

function normalizeToneTerms(tone: string): string[] {
  const t = tone.toLowerCase().trim();
  const terms = new Set<string>([t]);
  for (const [canonical, synonyms] of Object.entries(TONE_SYNONYMS)) {
    if (synonyms.some((syn) => syn === t || t.includes(syn) || syn.includes(t))) {
      terms.add(canonical);
      for (const syn of synonyms) terms.add(syn);
    }
  }
  return Array.from(terms);
}

function matchesShape(p: Product, targetShape: string): boolean {
  const shapes = (p.labels.body_shapes ?? []).map((s) => s.toLowerCase().trim());
  if (shapes.length === 0) return false;
  const targetTerms = normalizeShapeTerms(targetShape);
  return shapes.some((s) => {
    if (s === "all" || s === "universal") return true;
    const sTerms = normalizeShapeTerms(s);
    return targetTerms.some((t) => sTerms.includes(t));
  });
}

function matchesTone(p: Product, targetTone: string): boolean {
  const tones = (p.labels.color_tones ?? p.labels.colors ?? []).map((t) => t.toLowerCase().trim());
  if (tones.length === 0) return false;
  const targetTerms = normalizeToneTerms(targetTone);
  return tones.some((t) => {
    if (t === "netral" || t === "neutral" || t === "all" || t === "universal") return true;
    const tTerms = normalizeToneTerms(t);
    return targetTerms.some((target) => tTerms.includes(target));
  });
}

// Only active products are listed or selectable (WEB-07).
// Dua tahap seleksi:
// 1. Seleksi bentuk tubuh terlebih dahulu
// 2. Seleksi personal color tone dari hasil seleksi tahap 1
export async function GET(request?: Request) {
  await connection();

  const url = request?.url ? new URL(request.url) : null;
  const rawBodyShape =
    url?.searchParams.get("body_shape") ?? url?.searchParams.get("bodyShape") ?? null;
  const rawColorTone =
    url?.searchParams.get("color_tone") ??
    url?.searchParams.get("colorTone") ??
    url?.searchParams.get("season") ??
    url?.searchParams.get("personal_color") ??
    null;

  const bodyShape = rawBodyShape ? rawBodyShape.toLowerCase().trim() : null;
  const colorTone = rawColorTone ? rawColorTone.toLowerCase().trim() : null;

  let products = await getStore().activeProducts();

  // Stage 1: Seleksi bentuk badan (body shape) terlebih dahulu
  if (bodyShape) {
    products = products.filter((p) => matchesShape(p, bodyShape));
  }

  // Stage 2: Setelah itu baru seleksi berdasarkan personal color tone
  if (colorTone) {
    products = products.filter((p) => matchesTone(p, colorTone));
  }

  return json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory,
      image: p.imagePath,
      silhouette: p.labels.silhouette,
      sourceUrl: p.sourceUrl ?? null,
      labels: p.labels,
    })),
  );
}
