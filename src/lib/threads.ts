const THREADS_AUTH_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const THREADS_GRAPH_URL = "https://graph.threads.net";

export class ThreadsAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ThreadsAPIError";
  }
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID!,
    redirect_uri: process.env.THREADS_REDIRECT_URI!,
    scope: "threads_basic,threads_manage_insights,threads_read_replies",
    response_type: "code",
    state,
  });

  return `${THREADS_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForShortLivedToken(
  code: string,
): Promise<{ access_token: string; user_id: string }> {
  const response = await fetch(THREADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: process.env.THREADS_REDIRECT_URI!,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ThreadsAPIError(
      "Failed to exchange code for short-lived token",
      response.status,
      body,
    );
  }

  return response.json();
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: process.env.THREADS_APP_SECRET!,
    access_token: shortLivedToken,
  });

  const response = await fetch(
    `${THREADS_GRAPH_URL}/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ThreadsAPIError(
      "Failed to exchange for long-lived token",
      response.status,
      body,
    );
  }

  return response.json();
}

export async function fetchUserProfile(
  accessToken: string,
): Promise<{ id: string; username: string }> {
  const params = new URLSearchParams({
    fields: "id,username",
    access_token: accessToken,
  });

  const response = await fetch(
    `${THREADS_GRAPH_URL}/v1.0/me?${params.toString()}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ThreadsAPIError(
      "Failed to fetch user profile",
      response.status,
      body,
    );
  }

  return response.json();
}
