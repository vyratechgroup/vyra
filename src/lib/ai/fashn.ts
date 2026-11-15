import { config } from "@/lib/config";
import { ProviderError } from "./errors";

// FASHN handles virtual try-on only (PRD §F.2). The backend submits a job, records
// FASHN's job id, then polls FASHN's status endpoint whenever the client asks.
// Contract assumed from FASHN's v1 REST API; confirm the model and fields in the PoC
// (decision tracker #4).

export type ImageInput = { bytes: Uint8Array; mime: string };

export type FashnStatus =
  | { state: "processing" }
  | { state: "completed"; output: { kind: "url"; url: string } | { kind: "dataUrl"; dataUrl: string } | { kind: "mock" } }
  | { state: "failed"; error: string };

export const toDataUrl = (img: ImageInput) => `data:${img.mime};base64,${Buffer.from(img.bytes).toString("base64")}`;

export function dataUrlToImage(dataUrl: string): ImageInput {
  const [header, b64] = dataUrl.split(",");
  const mime = header?.split(";")[0]?.replace("data:", "") || "image/jpeg";
  const bytes = new Uint8Array(Buffer.from(b64 ?? "", "base64"));
  return { bytes, mime };
}

async function fashnFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${config.fashn.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.fashn.apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ProviderError(`FASHN ${res.status}: ${JSON.stringify(body)}`, res.status >= 500 || res.status === 429);
  }
  return body;
}

export async function submitTryon(args: {
  person: ImageInput;
  garment: ImageInput;
  category: "tops" | "bottoms" | "one-pieces";
}): Promise<string> {
  if (config.fashn.mode === "mock") return `mock_${Date.now()}`;

  const body = await fashnFetch("/run", {
    method: "POST",
    body: JSON.stringify({
      model_name: config.fashn.model,
      inputs: {
        model_image: toDataUrl(args.person),
        garment_image: toDataUrl(args.garment),
        category: args.category,
        mode: "quality",
        output_format: "jpeg",
        return_base64: true,
      },
      mode: "quality",
      output_format: "jpeg",
      return_base64: true,
    }),
  });
  if (!body?.id) throw new ProviderError(`FASHN returned no job id: ${JSON.stringify(body)}`, true);
  return String(body.id);
}

export async function getTryonStatus(providerJobId: string): Promise<FashnStatus> {
  if (providerJobId.startsWith("mock_")) {
    const started = Number(providerJobId.slice(5));
    return Date.now() - started > 6000 ? { state: "completed", output: { kind: "mock" } } : { state: "processing" };
  }

  const body = await fashnFetch(`/status/${encodeURIComponent(providerJobId)}`);
  switch (body?.status) {
    case "completed": {
      const output = body.output?.[0];
      if (!output) {
        return { state: "failed", error: "FASHN completed without output" };
      }
      if (output.startsWith("data:")) {
        return { state: "completed", output: { kind: "dataUrl", dataUrl: output } };
      }
      return { state: "completed", output: { kind: "url", url: output } };
    }
    case "failed":
    case "canceled":
      return { state: "failed", error: body.error?.message ?? body.error?.name ?? String(body.status) };
    default:
      return { state: "processing" };
  }
}

/** Downloads FASHN's result so it lives in our private storage, not on FASHN's CDN. Also decodes base64 data URIs. */
export async function downloadResult(urlOrDataUri: string): Promise<ImageInput> {
  if (urlOrDataUri.startsWith("data:")) {
    return dataUrlToImage(urlOrDataUri);
  }
  const res = await fetch(urlOrDataUri, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new ProviderError(`Could not download FASHN result: ${res.status}`, true);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "image/png" };
}
