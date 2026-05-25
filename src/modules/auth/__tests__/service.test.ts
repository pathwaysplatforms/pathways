import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthError, ValidationError } from "@/lib/errors";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/supabase/admin");
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: (key: string) => (key === "origin" ? "http://localhost:3000" : null),
  })),
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSession,
  requireAuth,
  requireAdmin,
  signInWithEmail,
} from "../service";

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSession = {
  user: mockUser,
  access_token: "token",
};

function makeQueryChain(resolvedValue: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
}

type MockClient = ReturnType<typeof makeServerClient>;
type ServerClientType = ReturnType<typeof createSupabaseServerClient>;
type AdminClientType = ReturnType<typeof createSupabaseAdminClient>;

function makeServerClient(
  overrides: {
    getUser?: unknown;
    getSession?: unknown;
    signInWithOtp?: unknown;
    from?: ReturnType<typeof vi.fn>;
  } = {}
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        overrides.getUser ?? { data: { user: null }, error: null }
      ),
      getSession: vi.fn().mockResolvedValue(
        overrides.getSession ?? { data: { session: null }, error: null }
      ),
      signInWithOtp: vi.fn().mockResolvedValue(
        overrides.signInWithOtp ?? { error: null }
      ),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: "https://accounts.google.com" },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from:
      overrides.from ??
      vi.fn().mockReturnValue(makeQueryChain({ data: null, error: null })),
  };
}

function mockServerClient(client: MockClient) {
  vi.mocked(createSupabaseServerClient).mockReturnValue(
    client as unknown as ServerClientType
  );
}

function mockAdminClient(client: MockClient) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue(
    client as unknown as AdminClientType
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("returns null when no session exists", async () => {
    mockServerClient(makeServerClient());

    const result = await getSession();

    expect(result).toBeNull();
  });

  it("returns session object when authenticated", async () => {
    mockServerClient(
      makeServerClient({
        getUser: { data: { user: mockUser }, error: null },
      })
    );

    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-123");
  });
});

describe("signInWithEmail", () => {
  it("calls supabase.auth.signInWithOtp with correct params", async () => {
    const client = makeServerClient({
      getUser: { data: { user: mockUser }, error: null },
    });
    mockServerClient(client);

    await signInWithEmail("user@example.com");

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
    });
  });

  it("throws ValidationError if email is invalid format", async () => {
    mockServerClient(makeServerClient());

    await expect(signInWithEmail("not-an-email")).rejects.toThrow(
      ValidationError
    );
  });
});

describe("requireAuth", () => {
  it("throws AuthError when session is null", async () => {
    mockServerClient(makeServerClient());

    await expect(requireAuth()).rejects.toThrow(AuthError);
  });

  it("returns user when session exists", async () => {
    mockServerClient(
      makeServerClient({
        getUser: { data: { user: mockUser }, error: null },
      })
    );

    const user = await requireAuth();

    expect(user.id).toBe("user-123");
  });
});

describe("requireAdmin", () => {
  it("throws AuthError when is_admin is false", async () => {
    mockServerClient(
      makeServerClient({
        getUser: { data: { user: mockUser }, error: null },
      })
    );
    mockAdminClient(
      makeServerClient({
        from: vi
          .fn()
          .mockReturnValue(
            makeQueryChain({ data: { is_admin: false }, error: null })
          ),
      })
    );

    await expect(requireAdmin()).rejects.toThrow(AuthError);
  });

  it("returns user when is_admin is true", async () => {
    mockServerClient(
      makeServerClient({
        getUser: { data: { user: mockUser }, error: null },
      })
    );
    mockAdminClient(
      makeServerClient({
        from: vi
          .fn()
          .mockReturnValue(
            makeQueryChain({ data: { is_admin: true }, error: null })
          ),
      })
    );

    const user = await requireAdmin();

    expect(user.id).toBe("user-123");
  });
});
