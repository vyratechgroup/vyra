import type { Product } from "@/types/domain";

// Starter catalog built from the product photos already in /public. Jessica's curated
// catalog replaces this once the admin CRUD (P1) exists.
export function seedProducts(): Product[] {
  const ts = "2026-11-09T00:00:00.000Z";
  const base = { brand: "FLICKS Sample", sourceUrl: null, isActive: true, createdAt: ts, updatedAt: ts };
  return [
    {
      ...base,
      id: "prd_basic_tee",
      name: "Basic Tee",
      category: "Atasan",
      subcategory: "Kaos",
      imagePath: "/images/product-basic-tee.webp",
      labels: {
        colors: ["netral", "cool", "summer", "winter"],
        color_tones: ["summer", "winter", "cool", "neutral", "netral"],
        body_shapes: ["rectangle", "inverted_triangle", "pear", "apple"],
        silhouette: ["regular fit", "crew neck"],
        fashnCategory: "tops",
      },
    },
    {
      ...base,
      id: "prd_knit_top",
      name: "Knit Top",
      category: "Atasan",
      subcategory: "Rajut",
      imagePath: "/images/product-knit-top.webp",
      labels: {
        colors: ["hangat", "autumn", "warm"],
        color_tones: ["autumn", "spring", "warm", "hangat", "warm_autumn", "true_autumn", "deep_autumn"],
        body_shapes: ["hourglass", "pear"],
        silhouette: ["slim fit"],
        fashnCategory: "tops",
      },
    },
    {
      ...base,
      id: "prd_linen_shirt",
      name: "Linen Shirt",
      category: "Atasan",
      subcategory: "Kemeja",
      imagePath: "/images/product-linen-shirt.webp",
      labels: {
        colors: ["netral", "summer", "spring"],
        color_tones: ["summer", "spring", "neutral", "netral", "cool"],
        body_shapes: ["rectangle", "inverted_triangle", "apple"],
        silhouette: ["relaxed fit", "kerah"],
        fashnCategory: "tops",
      },
    },
    {
      ...base,
      id: "prd_wrap_blouse",
      name: "Wrap Blouse",
      category: "Atasan",
      subcategory: "Blus",
      imagePath: "/images/product-wrap-blouse.webp",
      labels: {
        colors: ["hangat", "autumn"],
        color_tones: ["autumn", "spring", "warm", "hangat", "deep_autumn", "warm_autumn"],
        body_shapes: ["hourglass", "pear", "inverted_triangle", "apple"],
        silhouette: ["wrap", "v-neck"],
        fashnCategory: "tops",
      },
    },
    {
      ...base,
      id: "prd_wide_pants",
      name: "Wide Leg Pants",
      category: "Bawahan",
      subcategory: "Celana",
      imagePath: "/images/product-linen-shirt.webp",
      labels: {
        colors: ["netral"],
        color_tones: ["autumn", "spring", "summer", "winter", "neutral", "netral", "warm", "cool"],
        body_shapes: ["hourglass", "rectangle", "inverted_triangle", "pear", "apple"],
        silhouette: ["wide leg", "high waist"],
        fashnCategory: "bottoms",
      },
    },
    {
      ...base,
      id: "prd_pleated_skirt",
      name: "Pleated Midi Skirt",
      category: "Bawahan",
      subcategory: "Rok",
      imagePath: "/images/product-wrap-blouse.webp",
      labels: {
        colors: ["hangat"],
        color_tones: ["autumn", "spring", "warm", "hangat", "warm_autumn"],
        body_shapes: ["hourglass", "rectangle", "pear"],
        silhouette: ["a-line", "midi"],
        fashnCategory: "bottoms",
      },
    },
  ];
}
