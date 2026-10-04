import type { Quality } from "./qualities.ts";

export class GhostscriptError extends Error {
  override name = "GhostscriptError";
}

/**
 * pdfwrite distiller parameters.
 *
 * The `-dPDFSETTINGS` presets are applied when the device opens and cannot be
 * overridden by later `-d` flags, so the settings are spelled out explicitly
 * here instead. The `standard` quality mirrors `/prepress` exactly.
 */
function distillerParams(quality: Quality): string {
  const acsImageDict =
    `<</QFactor ${quality.qfactor} /Blend 1 /ColorTransform 1 ` +
    `/HSamples [1 1 1 1] /VSamples [1 1 1 1]>>`;
  return `<</ColorImageResolution ${quality.dpi} ` +
    `/GrayImageResolution ${quality.dpi} ` +
    `/MonoImageResolution 1200 ` +
    `/DownsampleColorImages ${quality.downsample} ` +
    `/DownsampleGrayImages ${quality.downsample} ` +
    `/DownsampleMonoImages ${quality.downsample} ` +
    `/ColorImageDownsampleType /Bicubic ` +
    `/GrayImageDownsampleType /Bicubic ` +
    `/MonoImageDownsampleType /Subsample ` +
    `/ColorConversionStrategy /LeaveColorUnchanged ` +
    `/ColorACSImageDict ${acsImageDict} ` +
    `/GrayACSImageDict ${acsImageDict}>> setdistillerparams`;
}

/**
 * Shrink a PDF with Ghostscript.
 *
 * Vector text is untouched — these settings only affect embedded images, so
 * raising the quality helps scanned or rasterised pages.
 */
export async function shrinkPdf(
  inputPath: string,
  outputPath: string,
  quality: Quality,
  timeoutMs: number,
): Promise<void> {
  const args = [
    "-sDEVICE=pdfwrite",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-dCompatibilityLevel=1.7",
    "-dAutoRotatePages=/None",
    `-sOutputFile=${outputPath}`,
    "-c",
    distillerParams(quality),
    "-f",
    inputPath,
  ];

  let result: Deno.CommandOutput;
  try {
    result = await new Deno.Command("gs", {
      args,
      stdout: "null",
      stderr: "piped",
      signal: AbortSignal.timeout(timeoutMs),
    }).output();
  } catch (err) {
    if (err instanceof DOMException) {
      throw new GhostscriptError("Ghostscript timed out or was cancelled");
    }
    throw new GhostscriptError(
      `could not run Ghostscript: ${(err as Error).message}`,
    );
  }

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new GhostscriptError(
      stderr.split("\n").slice(-3).join(" ") ||
        `Ghostscript exited with code ${result.code}`,
    );
  }
}
