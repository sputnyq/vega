export interface ApiEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; issues?: Array<{ field: string; message: string }> };
}

export async function apiRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const request: RequestInit = {
    method,
    credentials: "same-origin",
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  };
  const response = await fetch(path, request);
  const result = await response.json() as ApiEnvelope<T>;
  if (!response.ok || result.data === undefined) {
    const issueText = result.error?.issues?.map((issue) => `${issue.field}: ${issue.message}`).join(" · ");
    throw new Error(issueText || result.error?.message || "Die Kataloganfrage ist fehlgeschlagen.");
  }
  return result.data;
}
