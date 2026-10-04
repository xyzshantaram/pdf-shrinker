import { define } from "../../../utils.ts";
import { getJob, removeJob } from "../../../lib/store.ts";
import { shrunkName } from "../shrink.ts";

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export const handler = define.handlers({
  GET(ctx) {
    const job = getJob(ctx.params.id);
    if (!job) {
      return new Response(
        "This file has already been downloaded, expired, or never existed.",
        {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }

    let bytes: Uint8Array;
    try {
      bytes = Deno.readFileSync(job.outputPath);
    } catch {
      void removeJob(job.id);
      return new Response("The shrunken file is no longer available.", {
        status: 404,
      });
    }

    // Delivered once: remove it from the server immediately.
    void removeJob(job.id);

    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(bytes.byteLength),
        "content-disposition": contentDisposition(shrunkName(job.originalName)),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
});
