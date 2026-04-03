/** Retry helpers for transient MongoDB / network failures (e.g. Atlas ECONNRESET). */

function asErrorLabels(error: unknown): Set<string> | null {
  if (!error || typeof error !== "object") return null;
  const labels = (error as { errorLabels?: unknown }).errorLabels;
  if (labels instanceof Set) return labels;
  if (Array.isArray(labels)) return new Set(labels.map(String));
  return null;
}

export function isRetryableMongoError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    name?: string;
    code?: string;
    message?: string;
    cause?: { code?: string };
  };
  if (err.name === "MongoNetworkError" || err.name === "MongoServerSelectionError") return true;
  if (err.code === "ECONNRESET" || err.cause?.code === "ECONNRESET") return true;
  const msg = typeof err.message === "string" ? err.message : "";
  if (msg.includes("ECONNRESET") || msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT")) {
    return true;
  }
  const labels = asErrorLabels(error);
  if (labels?.has("RetryableWriteError")) return true;
  if (labels?.has("TransientTransactionError")) return true;
  return false;
}

export async function withMongoRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 4);
  const baseDelayMs = options?.baseDelayMs ?? 400;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRetryableMongoError(e) || i === attempts - 1) throw e;
      const delay = baseDelayMs * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
