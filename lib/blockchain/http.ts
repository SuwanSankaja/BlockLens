import type { FetchContext, ProviderName } from "@/types/blockchain";

const DEFAULT_TIMEOUT_MS = Number(process.env.BLOCKLENS_FETCH_TIMEOUT_MS ?? 10_000);
const DEFAULT_RETRIES = Number(process.env.BLOCKLENS_FETCH_RETRIES ?? 2);
const DEFAULT_REVALIDATE_SECONDS = Number(
  process.env.BLOCKLENS_REVALIDATE_SECONDS ?? 30,
);

export class ProviderError extends Error {
  code: string;
  status: number;
  provider: ProviderName;
  retryable: boolean;
  details?: string;

  constructor({
    message,
    code,
    status,
    provider,
    retryable,
    details,
  }: {
    message: string;
    code: string;
    status: number;
    provider: ProviderName;
    retryable: boolean;
    details?: string;
  }) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
    this.details = details;
  }
}

export function createFetchContext(): FetchContext {
  return {
    requestId: crypto.randomUUID(),
  };
}

export function normalizeProviderError(
  error: unknown,
  provider: ProviderName,
): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError({
      message: `${provider} request timed out.`,
      code: "timeout",
      status: 504,
      provider,
      retryable: true,
    });
  }

  return new ProviderError({
    message: `${provider} request failed unexpectedly.`,
    code: "provider_error",
    status: 502,
    provider,
    retryable: true,
    details: error instanceof Error ? error.message : String(error),
  });
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function fetchJsonWithRetry<T>({
  provider,
  baseUrl,
  path,
  context,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  revalidateSeconds = DEFAULT_REVALIDATE_SECONDS,
}: {
  provider: ProviderName;
  baseUrl: string;
  path: string;
  context: FetchContext;
  timeoutMs?: number;
  retries?: number;
  revalidateSeconds?: number;
}): Promise<T> {
  const requestUrl = `${baseUrl.replace(/\/$/, "")}${path}`;
  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-blocklens-request-id": context.requestId,
        },
        signal: controller.signal,
        next: {
          revalidate: revalidateSeconds,
        },
      });

      if (!response.ok) {
        const details = (await response.text()).slice(0, 300);
        throw new ProviderError({
          message:
            response.status === 404
              ? "Requested Bitcoin entity was not found."
              : response.status === 429
                ? `${provider} is rate-limiting requests right now.`
                : `${provider} returned an upstream error.`,
          code:
            response.status === 404
              ? "not_found"
              : response.status === 429
                ? "rate_limited"
                : "upstream_error",
          status: response.status,
          provider,
          retryable: shouldRetryStatus(response.status),
          details,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      const normalized = normalizeProviderError(error, provider);
      lastError = normalized;

      if (attempt >= retries || !normalized.retryable) {
        throw normalized;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw (
    lastError ??
    new ProviderError({
      message: `${provider} request failed.`,
      code: "provider_error",
      status: 502,
      provider,
      retryable: true,
    })
  );
}
