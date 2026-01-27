import type { ErrorResponse } from "../types.ts";

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function handleError(error: unknown): never {
  if (isErrorResponse(error)) {
    outputJson(error);
    process.exit(1);
  }

  if (error instanceof Error) {
    const response: ErrorResponse = {
      error: error.message,
      code: "UNKNOWN_ERROR",
    };
    outputJson(response);
    process.exit(1);
  }

  // Notion API errors
  if (isNotionError(error)) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
    };
    outputJson(response);
    process.exit(1);
  }

  const response: ErrorResponse = {
    error: String(error),
    code: "UNKNOWN_ERROR",
  };
  outputJson(response);
  process.exit(1);
}

function isErrorResponse(error: unknown): error is ErrorResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "code" in error
  );
}

function isNotionError(
  error: unknown
): error is { message: string; code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "code" in error
  );
}
