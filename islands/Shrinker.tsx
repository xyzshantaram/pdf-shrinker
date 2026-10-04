import { useSignal } from "@preact/signals";
import { DEFAULT_QUALITY, QUALITIES } from "../lib/qualities.ts";

interface ShrinkResult {
  filename: string;
  originalBytes: number;
  shrunkBytes: number;
  savedBytes: number;
  downloadUrl: string;
  expiresAt: number;
}

type Phase = "idle" | "working" | "done" | "error";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

function UploadIcon() {
  return (
    <svg
      class="dz-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      class="dz-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export default function Shrinker() {
  const file = useSignal<File | null>(null);
  const qualityId = useSignal(DEFAULT_QUALITY);
  const phase = useSignal<Phase>("idle");
  const result = useSignal<ShrinkResult | null>(null);
  const error = useSignal<string | null>(null);
  const dragging = useSignal(false);

  const selected = QUALITIES.find((q) => q.id === qualityId.value) ??
    QUALITIES[0];

  function pick(next: File | null) {
    file.value = next;
    phase.value = "idle";
    result.value = null;
    error.value = null;
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!file.value || phase.value === "working") return;
    const chosen = file.value;

    phase.value = "working";
    result.value = null;
    error.value = null;

    const body = new FormData();
    body.append("file", chosen);
    body.append("quality", qualityId.value);

    try {
      const res = await fetch("/api/shrink", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      result.value = data as ShrinkResult;
      phase.value = "done";
    } catch (err) {
      error.value = (err as Error).message;
      phase.value = "error";
    }
  }

  const savedPct = result.value && result.value.originalBytes > 0
    ? Math.round(
      (1 - result.value.shrunkBytes / result.value.originalBytes) * 100,
    )
    : 0;

  const minutesLeft = result.value
    ? Math.max(1, Math.round((result.value.expiresAt - Date.now()) / 60_000))
    : 0;

  return (
    <form class="shrinker" onSubmit={submit}>
      <label
        class={`dropzone${dragging.value ? " is-dragging" : ""}${
          file.value ? " has-file" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          dragging.value = true;
        }}
        onDragLeave={() => {
          dragging.value = false;
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragging.value = false;
          pick(e.dataTransfer?.files?.[0] ?? null);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) =>
            pick((e.target as HTMLInputElement).files?.[0] ?? null)}
        />
        {file.value ? <FileIcon /> : <UploadIcon />}
        {file.value
          ? (
            <span class="dz-text">
              <span class="dz-title">{file.value.name}</span>
              <span class="dz-sub">
                {formatBytes(file.value.size)} PDF — tap to choose another
              </span>
            </span>
          )
          : (
            <span class="dz-text">
              <span class="dz-title">Drop a PDF here</span>
              <span class="dz-sub">or tap to browse</span>
            </span>
          )}
      </label>

      <div class="quality">
        <h2 class="quality-heading">Quality</h2>
        <div class="segmented" role="radiogroup" aria-label="Quality">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              type="button"
              role="radio"
              aria-checked={qualityId.value === q.id}
              class={`segment${qualityId.value === q.id ? " is-active" : ""}`}
              onClick={() => {
                qualityId.value = q.id;
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p class="quality-hint">{selected.hint}</p>
        <p class="quality-note">
          Higher settings make bigger files — step up only if text or images
          look muddy or fuzzy.
        </p>
      </div>

      <button
        class="cta"
        type="submit"
        disabled={!file.value || phase.value === "working"}
      >
        {phase.value === "working"
          ? (
            <>
              <span class="spinner" aria-hidden="true" />
              Shrinking…
            </>
          )
          : "Shrink PDF"}
      </button>

      <div class="status" aria-live="polite">
        {phase.value === "working" && (
          <p class="status-muted">Large files can take a few seconds.</p>
        )}
        {phase.value === "error" && error.value && (
          <p class="status-error">{error.value}</p>
        )}
        {phase.value === "done" && result.value && (
          <div class="result">
            <div class="stats">
              <span class="stat">
                <b>{formatBytes(result.value.originalBytes)}</b>
                <small>original</small>
              </span>
              <span class="arrow" aria-hidden="true">→</span>
              <span class="stat">
                <b>{formatBytes(result.value.shrunkBytes)}</b>
                <small>shrunk</small>
              </span>
              {savedPct > 0
                ? (
                  <span class="saved">
                    saved {savedPct}% · {formatBytes(result.value.savedBytes)}
                  </span>
                )
                : <span class="saved is-muted">already compact</span>}
            </div>
            <a
              class="cta download"
              href={result.value.downloadUrl}
              download={result.value.filename}
            >
              Download {result.value.filename}
            </a>
            <p class="fineprint">
              One-time download — it leaves the server as soon as you grab it
              {minutesLeft ? ` (or within ${minutesLeft} min)` : ""}.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
