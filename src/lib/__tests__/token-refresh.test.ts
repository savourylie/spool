import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshTokenForUser, refreshAllTokens } from "../token-refresh";

// --- Configurable mock state ---

const DAYS = 24 * 60 * 60 * 1000;

let mockUserResult: { data: unknown; error: unknown } = {
  data: {
    access_token: "encrypted-token",
    token_expires_at: new Date(Date.now() + 10 * DAYS).toISOString(),
  },
  error: null,
};

let mockUsersListResult: { data: unknown; error: unknown } = {
  data: [{ id: "user-uuid" }],
  error: null,
};

let mockUpdateResult: { error: unknown } = { error: null };

// --- Supabase mock ---

function createMockFrom(table: string) {
  if (table === "users") {
    return {
      select: (fields: string) => {
        if (fields === "id") {
          return {
            gt: () => ({
              lte: () => Promise.resolve(mockUsersListResult),
            }),
          };
        }
        return {
          eq: () => ({
            single: () => Promise.resolve(mockUserResult),
          }),
        };
      },
      update: () => ({
        eq: () => Promise.resolve(mockUpdateResult),
      }),
    };
  }

  return {};
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => createMockFrom(table),
  }),
}));

// --- Crypto mock ---

const mockEncrypt = vi.fn().mockReturnValue("new-encrypted-token");
const mockDecrypt = vi.fn().mockReturnValue("decrypted-token");

vi.mock("@/lib/crypto", () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// --- ThreadsAPI mock ---

const mockRefreshToken = vi.fn().mockResolvedValue({
  access_token: "new-access-token",
  token_type: "bearer",
  expires_in: 90 * 24 * 60 * 60, // 90 days in seconds
});

vi.mock("@/lib/threads-api", () => ({
  ThreadsAPI: {
    refreshToken: (...args: unknown[]) => mockRefreshToken(...args),
  },
}));

// --- Tests ---

describe("refreshTokenForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserResult = {
      data: {
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() + 10 * DAYS).toISOString(),
      },
      error: null,
    };

    mockUpdateResult = { error: null };

    mockRefreshToken.mockResolvedValue({
      access_token: "new-access-token",
      token_type: "bearer",
      expires_in: 90 * 24 * 60 * 60,
    });
  });

  it("refreshes token expiring within 15 days", async () => {
    const result = await refreshTokenForUser("user-uuid");

    expect(result).toBe(true);
    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-token");
    expect(mockRefreshToken).toHaveBeenCalledWith("decrypted-token");
    expect(mockEncrypt).toHaveBeenCalledWith("new-access-token");
  });

  it("skips token expiring in 30 days (not due)", async () => {
    mockUserResult = {
      data: {
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() + 30 * DAYS).toISOString(),
      },
      error: null,
    };

    const result = await refreshTokenForUser("user-uuid");

    expect(result).toBe(false);
    expect(mockRefreshToken).not.toHaveBeenCalled();
    expect(mockEncrypt).not.toHaveBeenCalled();
  });

  it("skips already expired token with warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockUserResult = {
      data: {
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() - 1 * DAYS).toISOString(),
      },
      error: null,
    };

    const result = await refreshTokenForUser("user-uuid");

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("token already expired"),
    );
    expect(mockRefreshToken).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not update DB when API refresh fails", async () => {
    mockRefreshToken.mockRejectedValueOnce(new Error("API error"));

    await expect(refreshTokenForUser("user-uuid")).rejects.toThrow("API error");
    expect(mockEncrypt).not.toHaveBeenCalled();
  });
});

describe("refreshAllTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserResult = {
      data: {
        access_token: "encrypted-token",
        token_expires_at: new Date(Date.now() + 10 * DAYS).toISOString(),
      },
      error: null,
    };

    mockUsersListResult = {
      data: [{ id: "user-1" }, { id: "user-2" }],
      error: null,
    };

    mockUpdateResult = { error: null };

    mockRefreshToken.mockResolvedValue({
      access_token: "new-access-token",
      token_type: "bearer",
      expires_in: 90 * 24 * 60 * 60,
    });
  });

  it("processes multiple users and tracks counts", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await refreshAllTokens();

    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);

    logSpy.mockRestore();
  });

  it("continues on individual failure and counts errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockRefreshToken
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockResolvedValueOnce({
        access_token: "new-access-token",
        token_type: "bearer",
        expires_in: 90 * 24 * 60 * 60,
      });

    const result = await refreshAllTokens();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to refresh token"),
      expect.any(Error),
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
