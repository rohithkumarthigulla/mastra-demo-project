export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

interface ErrorBody {
  code?: unknown;
  message?: unknown;
  errors?: unknown;
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === 'object') body = parsed as ErrorBody;
  } catch {
    // Non-JSON error body; fall back to the status line.
  }

  const code = typeof body.code === 'string' ? body.code : 'http_error';
  const message =
    typeof body.message === 'string' ? body.message : `Request failed with ${res.status}`;

  let fieldErrors: Record<string, string> | undefined;
  if (Array.isArray(body.errors)) {
    fieldErrors = {};
    for (const item of body.errors as { path?: unknown; message?: unknown }[]) {
      if (typeof item.path === 'string' && typeof item.message === 'string') {
        fieldErrors[item.path] ??= item.message;
      }
    }
  }

  return new ApiError(res.status, code, message, fieldErrors);
}
