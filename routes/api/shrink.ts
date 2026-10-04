import { define } from "../../utils.ts";
import { GhostscriptError, shrinkPdf } from "../../lib/ghostscript.ts";
import { getQuality } from "../../lib/qualities.ts";
import {
  createDir,
  newJobDir,
  registerJob,
  removeDir,
  TTL_MS,
} from "../../lib/store.ts";

const MAX_UPLOAD_BYTES = Number(Deno.env.get("MAX_UPLOAD_MB") ?? 100) *
  1024 * 1024;
const CONVERT_TIMEOUT_MS = Number(
  Deno.env.get("CONVERT_TIMEOUT_MS") ?? 120_000,
);
const MAX_CONCURRENT = Number(Deno.env.get("MAX_CONCURRENT") ?? 4);

let active = 0;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function shrunkName(name: string): string {
  return /\.pdf$/i.test(name)
    ? name.replace(/\.pdf$/i, " (shrunk).pdf")
    : `${name} (shrunk).pdf`;
}

export const handler = define.handlers({
  async POST(ctx) {
    if (active >= MAX_CONCURRENT) {
      return json(
        {
          error: "The server is busy shrinking other PDFs. Try again shortly.",
        },
        503,
      );
    }

    let form: FormData;
    try {
      form = await ctx.req.formData();
    } catch {
      return json({ error: "Expected a multipart form upload." }, 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "No PDF was uploaded." }, 400);
    }
    if (file.size === 0) {
      return json({ error: "That file is empty." }, 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
      return json({ error: `That file is too large (limit ${mb} MB).` }, 413);
    }
    if (!/\.pdf$/i.test(file.name)) {
      return json({ error: "Only .pdf files are supported." }, 415);
    }

    const quality = getQuality(String(form.get("quality") ?? ""));
    const id = crypto.randomUUID();
    const dir = newJobDir(id);
    const inputPath = `${dir}/input.pdf`;
    const outputPath = `${dir}/output.pdf`;

    active++;
    try {
      await createDir(dir);
      const handle = await Deno.open(inputPath, {
        create: true,
        write: true,
        truncate: true,
      });
      await file.stream().pipeTo(handle.writable);

      // The extension lied if the bytes don't start with the PDF magic number.
      const head = new Uint8Array(5);
      const probe = await Deno.open(inputPath, { read: true });
      try {
        await probe.read(head);
      } finally {
        probe.close();
      }
      if (new TextDecoder().decode(head) !== "%PDF-") {
        await removeDir(dir);
        return json({ error: "That doesn't look like a valid PDF." }, 415);
      }

      await shrinkPdf(inputPath, outputPath, quality, CONVERT_TIMEOUT_MS);
      const shrunkBytes = (await Deno.stat(outputPath)).size;

      // The upload is ephemeral: drop it the moment conversion succeeds.
      await Deno.remove(inputPath).catch(() => {});

      const job = {
        id,
        originalName: file.name,
        originalBytes: file.size,
        shrunkBytes,
        quality: quality.id,
        dir,
        outputPath,
        createdAt: Date.now(),
        expiresAt: Date.now() + TTL_MS,
      };
      registerJob(job);

      return json({
        id,
        filename: shrunkName(file.name),
        originalBytes: file.size,
        shrunkBytes,
        savedBytes: Math.max(0, file.size - shrunkBytes),
        quality: quality.id,
        downloadUrl: `/api/download/${id}`,
        expiresAt: job.expiresAt,
      });
    } catch (err) {
      await removeDir(dir);
      if (err instanceof GhostscriptError) {
        return json({ error: `Couldn't shrink that PDF: ${err.message}` }, 422);
      }
      console.error("shrink failed", err);
      return json(
        { error: "Something went wrong while shrinking the PDF." },
        500,
      );
    } finally {
      active--;
    }
  },
});
