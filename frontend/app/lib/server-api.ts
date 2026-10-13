const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
const TEST_API_BASE_URL = 'http://meblog-backend:8000/api/v1';
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api.yourdomain.com/api/v1';

async function getServerTokenFromCookie(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const token = store.get('token')?.value;
    return token ? decodeURIComponent(token) : null;
  } catch {
    return null;
  }
}

interface ServerApiFetchOptions extends RequestInit {
  revalidate?: number;
  suppressErrorStatuses?: number[];
}

export class ServerApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ServerApiError';
    this.status = status;
  }
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function getServerApiBaseUrl(): string {
  const envApiBase = process.env.SERVER_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envApiBase && isAbsoluteHttpUrl(envApiBase)) {
    const normalized = trimTrailingSlash(envApiBase);
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'local') {
      // Avoid localhost -> ::1 resolution issues on Windows in server-side fetch.
      return normalized.replace('://localhost', '://127.0.0.1');
    }
    return normalized;
  }

  if (process.env.NEXT_PUBLIC_ENV === 'test') {
    return TEST_API_BASE_URL;
  }

  if (process.env.NODE_ENV === 'development') {
    return DEFAULT_LOCAL_API_BASE_URL;
  }

  return DEFAULT_PRODUCTION_API_BASE_URL;
}

export async function fetchFromServerApi<T>(
  path: string,
  { revalidate = 300, suppressErrorStatuses = [], ...init }: ServerApiFetchOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getServerApiBaseUrl()}${normalizedPath}`;
  const token = await getServerTokenFromCookie();
  const headers = new Headers(init.headers || {});
  const hasAuthorization = headers.has('Authorization') || headers.has('authorization');
  if (token && !hasAuthorization) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const forceNoStoreForAuthed = Boolean(token && !init.cache);
  const shouldUseNextRevalidate = init.cache !== 'no-store' && !forceNoStoreForAuthed;
  const response = await fetch(url, {
    ...init,
    headers,
    ...(forceNoStoreForAuthed ? { cache: 'no-store' } : {}),
    ...(shouldUseNextRevalidate
      ? {
          next: {
            revalidate,
            ...(init as RequestInit & { next?: Record<string, unknown> }).next,
          },
        }
      : {}),
  });

  if (!response.ok) {
    let responseText = '';
    try {
      responseText = (await response.text()).slice(0, 300);
    } catch {
      // Ignore body parse failures for error logging.
    }

    if (!suppressErrorStatuses.includes(response.status)) {
      console.error('[server-api] request failed', {
        url,
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
    }

    throw new ServerApiError(
      response.status,
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as T;
}
