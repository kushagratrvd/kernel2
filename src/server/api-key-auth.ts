/**
 * API Key Authentication Guard for External Platform Integrations (e.g., CareerForge).
 *
 * Checks for the presence of a valid `X-Kernel-Api-Key` or `Authorization: Bearer <key>` header.
 * The authoritative key is configured via `KERNEL_API_KEY` in environment variables.
 */

export function authenticateApiKey(request: Request): {
  authenticated: boolean;
  errorResponse?: Response;
} {
  const headerKey =
    request.headers.get("x-kernel-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const expectedKey = process.env.KERNEL_API_KEY || "kernel_secret_key_2026";

  if (!headerKey || headerKey !== expectedKey) {
    return {
      authenticated: false,
      errorResponse: Response.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing X-Kernel-Api-Key header",
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    };
  }

  return { authenticated: true };
}
