# PDF Shrinker

A small [Deno Fresh](https://fresh.deno.dev) app that shrinks PDFs with
Ghostscript, using the same settings as the `shrinkpdf` fish function.

- **Uploads are ephemeral.** The uploaded file is written to a temp directory,
  converted, and deleted immediately after conversion.
- **Results are one-time.** The shrunken PDF is kept until you download it (or
  it expires, default 15 minutes), then deleted from the server.
- **Nothing is cached in the browser.** The download URL is single-use and
  served with `Cache-Control: no-store`. A 2–3 MB PDF cached in the browser
  wouldn't survive the server deleting it anyway — the durable copy is the file
  your browser saves to disk.

## Quality settings

Ghostscript's `-dPDFSETTINGS` presets are applied when the device opens and
can't be overridden by later `-d` flags, so the app spells the distiller
parameters out explicitly. The **Standard** preset is exactly what
`-dPDFSETTINGS=/prepress` expands to (300 dpi, JPEG QFactor 0.15) — the same as
the shell function.

| Preset       | Resolution    | JPEG QFactor | Notes                                   |
| ------------ | ------------- | ------------ | --------------------------------------- |
| **Smallest** | 150 dpi       | 0.40         | Lightest file, good for on-screen reads |
| **Standard** | 300 dpi       | 0.15         | The `shrinkpdf` default                 |
| **High**     | 600 dpi       | 0.10         | For soft fine/scanned text              |
| **Maximum**  | no downsample | 0.05         | Keeps original image detail             |

300 dpi is fine for almost everything. These settings only affect embedded
images — vector text is left as text, so it stays crisp at every level. If a
scanned page or a fine-print image looks soft, step up one level; the file gets
bigger and the detail comes back.

## Local development

Requires [Deno](https://deno.land) and `gs` (Ghostscript) on your `PATH`.

```sh
deno task dev          # vite dev server on http://localhost:8000
deno task check        # fmt --check + lint + typecheck
```

Production build:

```sh
deno task build
deno serve -A --port 8000 _fresh/server.js
```

## Run the container (podman)

```sh
podman build -t pdf-shrinker .
podman run --rm -p 8000:8000 pdf-shrinker
# open http://localhost:8000
```

Ghostscript is installed in the runtime image; `PORT` (default 8000) and the
settings below are read from the environment.

### Environment variables

| Variable             | Default             | Purpose                                  |
| -------------------- | ------------------- | ---------------------------------------- |
| `PORT`               | `8000`              | Port to listen on                        |
| `SHRINK_DATA_DIR`    | `/tmp/pdf-shrinker` | Where in-flight files live               |
| `JOB_TTL_MS`         | `900000` (15 min)   | How long an undownloaded result survives |
| `MAX_UPLOAD_MB`      | `100`               | Upload size limit                        |
| `CONVERT_TIMEOUT_MS` | `120000`            | Ghostscript timeout per file             |
| `MAX_CONCURRENT`     | `4`                 | Simultaneous conversions before 503      |

## Deploy to Dokku

The image exposes port 8000. Create the app and pin the port so Dokku's proxy
and the container agree:

```sh
dokku apps:create pdf-shrinker
dokku config:set pdf-shrinker PORT=8000
dokku ports:set pdf-shrinker http:80:8000
# optional: cap memory, Ghostscript can be hungry on large PDFs
# dokku resource:limit --memory 1G pdf-shrinker
```

Then push the repo. This project isn't a git repo yet, so:

```sh
git init -b main
git add -A
git commit -m "PDF shrinker: Deno Fresh + Ghostscript"

# use whichever ssh host your config defines:
git remote add dokku dokku@containers.shantaram.xyz:pdf-shrinker
# or, matching ~/.ssh/config:
# git remote add dokku dokku@shantaram.xyz.dokku:pdf-shrinker

git push dokku main
```

Dokku will build the `Dockerfile` and start it. `GET /health` returns `ok` for
any health check you configure.
