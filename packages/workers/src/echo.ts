import type { Worker } from "./worker";

/**
 * Returns its config and inputs unchanged. Exists so workflows can be
 * executed end-to-end before any real worker (HTTP, LLM) is written, and
 * so tests and demos can observe data flowing along edges.
 */
export const echoWorker: Worker = async ({ config, inputs }) => ({
  config,
  inputs,
});
