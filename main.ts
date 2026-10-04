import { App, staticFiles } from "fresh";
import { define, type State } from "./utils.ts";
import { ensureStore } from "./lib/store.ts";

export const app = new App<State>();

app.use(staticFiles());

// Make sure the ephemeral job directory exists before the first request.
app.use(async (ctx) => {
  await ensureStore();
  return await ctx.next();
});

app.use(define.middleware((ctx) => {
  console.log(`${ctx.req.method} ${new URL(ctx.req.url).pathname}`);
  return ctx.next();
}));

app.fsRoutes();
