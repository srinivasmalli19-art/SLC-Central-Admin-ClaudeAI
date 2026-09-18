import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";

// Mocks useAuth directly rather than going through the real AuthProvider
// (which fetches /auth/me over the network) — this test is only concerned
// with nav-item visibility per role, not the auth flow itself.
const mockUseAuth = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderLayout(role: string) {
  mockUseAuth.mockReturnValue({
    user: { id: "1", email: "x@example.com", name: "Test User", role },
    logout: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
}

describe("Layout navigation — JeevaMitra visibility (jeevamitra:read gating)", () => {
  it("shows the JeevaMitra nav link for SUPER_ADMIN", () => {
    renderLayout("SUPER_ADMIN");
    expect(screen.getByRole("link", { name: "JeevaMitra" })).toBeInTheDocument();
  });

  it("hides the JeevaMitra nav link for ADMIN (no jeevamitra:read by default)", () => {
    renderLayout("ADMIN");
    expect(screen.queryByRole("link", { name: "JeevaMitra" })).not.toBeInTheDocument();
  });

  it("does not hard-code an email-based check — gating is by role only", () => {
    // A SUPER_ADMIN with a completely different email still sees the link;
    // proves the gate isn't tied to any specific admin@example.com value.
    mockUseAuth.mockReturnValue({
      user: { id: "9", email: "someone-else@example.org", name: "Someone Else", role: "SUPER_ADMIN" },
      logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "JeevaMitra" })).toBeInTheDocument();
  });
});
