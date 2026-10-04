export interface Quality {
  id: string;
  /** Short name shown on the segmented control. */
  label: string;
  /** Sentence describing the trade-off, shown under the selector. */
  hint: string;
  /** Target resolution for color and grayscale images, in dpi. */
  dpi: number;
  /** JPEG quality factor (lower = higher quality, larger file). */
  qfactor: number;
  /** Whether Ghostscript may downsample images to the target resolution. */
  downsample: boolean;
}

export const DEFAULT_QUALITY = "standard";

/**
 * The `standard` preset is the same configuration that `-dPDFSETTINGS=/prepress`
 * expands to (300 dpi, JPEG QFactor 0.15), i.e. exactly what the `shrinkpdf`
 * shell function runs. The others trade resolution and JPEG quality for size.
 */
export const QUALITIES: Quality[] = [
  {
    id: "web",
    label: "Smallest",
    hint: "150 dpi — the lightest file, best for reading on screen.",
    dpi: 150,
    qfactor: 0.4,
    downsample: true,
  },
  {
    id: "standard",
    label: "Standard",
    hint: "300 dpi — the shrinkpdf default, and fine for almost everything.",
    dpi: 300,
    qfactor: 0.15,
    downsample: true,
  },
  {
    id: "high",
    label: "High",
    hint: "600 dpi — step up here if fine or scanned text looks soft.",
    dpi: 600,
    qfactor: 0.1,
    downsample: true,
  },
  {
    id: "max",
    label: "Maximum",
    hint: "No downsampling — keeps the original image detail, largest file.",
    dpi: 1200,
    qfactor: 0.05,
    downsample: false,
  },
];

const fallback = QUALITIES.find((q) => q.id === DEFAULT_QUALITY)!;

export function getQuality(id: string | null | undefined): Quality {
  return QUALITIES.find((q) => q.id === id) ?? fallback;
}
