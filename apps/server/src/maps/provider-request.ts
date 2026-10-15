import type { Response as ExpressResponse } from "express";

export const PROVIDER_TIMEOUT_MS = 10_000;

export class ProviderUnreachableError extends Error {
  constructor() {
    super("PROVIDER_UNREACHABLE");
    this.name = "ProviderUnreachableError";
  }
}

export function isClientAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Aborts upstream provider calls once the browser has gone away. Without this,
 * a superseded or closed request would still consume Google quota.
 */
export function clientAbortSignal(res: ExpressResponse): AbortSignal {
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller.signal;
}

export async function providerFetch(url: string, init: RequestInit, clientSignal: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.any([AbortSignal.timeout(PROVIDER_TIMEOUT_MS), clientSignal]) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "TypeError")) throw new ProviderUnreachableError();
    throw error;
  }
}
