export interface Job {
  id: string;
  originalName: string;
  originalBytes: number;
  shrunkBytes: number;
  quality: string;
  dir: string;
  outputPath: string;
  createdAt: number;
  expiresAt: number;
}

const jobs = new Map<string, Job>();

const DATA_DIR = Deno.env.get("SHRINK_DATA_DIR") ??
  `${Deno.env.get("TMPDIR") ?? "/tmp"}/pdf-shrinker`;

export const TTL_MS = Number(Deno.env.get("JOB_TTL_MS") ?? 15 * 60 * 1000);

let initialized: Promise<void> | null = null;

/** Create the data directory, clear leftovers from a previous run, start the sweeper. */
export function ensureStore(): Promise<void> {
  initialized ??= (async () => {
    await Deno.mkdir(DATA_DIR, { recursive: true });
    const stale: string[] = [];
    for await (const entry of Deno.readDir(DATA_DIR)) {
      if (entry.isDirectory) stale.push(entry.name);
    }
    await Promise.all(stale.map((name) => removeDir(`${DATA_DIR}/${name}`)));
    startSweeper();
  })();
  return initialized;
}

export function newJobDir(id: string): string {
  return `${DATA_DIR}/${id}`;
}

export async function createDir(dir: string): Promise<void> {
  await Deno.mkdir(dir, { recursive: true });
}

export function registerJob(job: Job): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (Date.now() > job.expiresAt) {
    void removeJob(id);
    return undefined;
  }
  return job;
}

/** Drop a registered job and its directory. */
export async function removeJob(id: string): Promise<void> {
  const job = jobs.get(id);
  jobs.delete(id);
  await removeDir(job ? job.dir : newJobDir(id));
}

/** Delete a job directory on disk (used for jobs that never got registered). */
export async function removeDir(dir: string): Promise<void> {
  await Deno.remove(dir, { recursive: true }).catch(() => {});
}

function startSweeper(): void {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now > job.expiresAt) void removeJob(id);
    }
  }, 60_000);
  Deno.unrefTimer(timer);
}
