import { createDefine } from "fresh";

// This app keeps no meaningful per-request state, so `ctx.state` is empty.
export type State = Record<never, never>;

export const define = createDefine<State>();
