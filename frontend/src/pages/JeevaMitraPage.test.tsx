import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/client";
import { jeevamitraApi } from "../api/jeevamitra";
import { JeevaMitraPage } from "./JeevaMitraPage";

// Mocks the Central Admin API layer only — no Firebase/GCP credentials are
// ever involved in this test file, and no network request is made. Mirrors
// the mocking approach the rest of this frontend would use once other page
// test suites exist (this is the first).
vi.mock("../api/jeevamitra", () => ({
  jeevamitraApi: {
    getHealth: vi.fn(),
    getDashboard: vi.fn(),
    listUsers: vi.fn(),
    listDiseaseAlerts: vi.fn(),
  },
}));

const mockedApi = jeevamitraApi as unknown as {
  getHealth: ReturnType<typeof vi.fn>;
  getDashboard: ReturnType<typeof vi.fn>;
  listUsers: ReturnType<typeof vi.fn>;
  listDiseaseAlerts: ReturnType<typeof vi.fn>;
};

const HEALTHY = {
  health: { status: "healthy", responseTimeMs: 42, lastCheckedAt: "2026-01-01T00:00:00.000Z" },
};

const DASHBOARD = {
  summary: {
    usersByRole: { farmer: 2, shepherd: 0 },
    totalFarms: 6,
    activeFarms: 5,
    bookingsByStatus: { pending: 0, confirmed: 0, active: 0, completed: 0, cancelled: 0 },
    activeDiseaseAlertsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    activeDiseaseAlertsByDistrict: [],
  },
};

const USERS = {
  users: [
    { id: "u1", name: "Ramu", role: "farmer", district: "Guntur", isVerified: true, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "u2", name: "Lakshmi", role: "shepherd", district: null, isVerified: false, createdAt: null },
  ],
};

const DISEASE_ALERTS = {
  diseaseAlerts: [
    {
      id: "a1",
      disease: "Foot and Mouth Disease",
      affectedSpecies: "cattle",
      severity: "high",
      district: "Guntur",
      isActive: true,
      issuedAt: "2026-03-01T00:00:00.000Z",
    },
  ],
};

function setupHappyPath() {
  mockedApi.getHealth.mockResolvedValue(HEALTHY);
  mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
  mockedApi.listUsers.mockResolvedValue(USERS);
  mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JeevaMitraPage — read-only labeling", () => {
  it("clearly labels the page READ ONLY", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);
    expect(await screen.findByText(/read only/i)).toBeInTheDocument();
  });

  it("never renders any mutation action (edit/delete/save/approve/block)", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(0));

    const forbiddenLabels = /edit|delete|save|approve|block|modify/i;
    const buttons = screen.queryAllByRole("button");
    for (const button of buttons) {
      expect(button.textContent).not.toMatch(forbiddenLabels);
    }
  });
});

describe("JeevaMitraPage — health status", () => {
  it("shows a loading state while checking health", () => {
    mockedApi.getHealth.mockReturnValue(new Promise(() => {})); // never resolves
    mockedApi.getDashboard.mockReturnValue(new Promise(() => {}));
    mockedApi.listUsers.mockReturnValue(new Promise(() => {}));
    mockedApi.listDiseaseAlerts.mockReturnValue(new Promise(() => {}));

    render(<JeevaMitraPage />);
    expect(screen.getByText(/checking connectivity/i)).toBeInTheDocument();
  });

  it.each([
    ["healthy", "JeevaMitra is connected."],
    ["unavailable", "JeevaMitra is currently unavailable."],
    ["configuration_error", "JeevaMitra integration requires configuration."],
    ["auth_error", "JeevaMitra integration authentication failed."],
  ])("renders the correct message for health status %s", async (status, expectedMessage) => {
    mockedApi.getHealth.mockResolvedValue({
      health: { status, lastCheckedAt: "2026-01-01T00:00:00.000Z" },
    });
    mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
    mockedApi.listUsers.mockResolvedValue(USERS);
    mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);

    render(<JeevaMitraPage />);
    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
  });

  it("never renders a raw Firebase/GCP error, stack trace, or credential detail", async () => {
    mockedApi.getHealth.mockRejectedValue(new ApiClientError(503, "JeevaMitra integration is not reachable right now."));
    mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
    mockedApi.listUsers.mockResolvedValue(USERS);
    mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);

    render(<JeevaMitraPage />);
    await screen.findByText("JeevaMitra integration is not reachable right now.");
    // The word "Firebase" legitimately appears in normal descriptive UI
    // copy ("Firebase connectivity", "via its own Firebase project") — that
    // is not a leak. What must never appear is actual credential-shaped
    // content: env var names, a service-account email, a private key
    // marker, or a stack trace frame.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/JEEVAMITRA_FIREBASE_PRIVATE_KEY|GOOGLE_APPLICATION_CREDENTIALS/i);
    expect(text).not.toMatch(/BEGIN PRIVATE KEY/i);
    expect(text).not.toMatch(/@.*\.iam\.gserviceaccount\.com/i);
    expect(text).not.toMatch(/at Module\.|at Object\.<anonymous>/); // a stack trace frame
  });
});

describe("JeevaMitraPage — dashboard summary", () => {
  it("renders backend-provided counts exactly, without recalculating them", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);

    expect(await screen.findByText("2")).toBeInTheDocument(); // farmers
    expect(screen.getByText("6")).toBeInTheDocument(); // totalFarms
    expect(screen.getByText("5")).toBeInTheDocument(); // activeFarms
  });

  it("shows a loading skeleton while the dashboard is loading", () => {
    mockedApi.getHealth.mockResolvedValue(HEALTHY);
    mockedApi.getDashboard.mockReturnValue(new Promise(() => {}));
    mockedApi.listUsers.mockResolvedValue(USERS);
    mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);

    render(<JeevaMitraPage />);
    expect(screen.getByLabelText(/loading dashboard summary/i)).toBeInTheDocument();
  });
});

describe("JeevaMitraPage — users table", () => {
  it("renders only the approved fields and NEVER renders a phone number", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);

    expect(await screen.findByText("Ramu")).toBeInTheDocument();
    expect(screen.getByText("Lakshmi")).toBeInTheDocument();
    // No phone-shaped value anywhere in the rendered users table.
    expect(document.body.textContent).not.toMatch(/\b\d{10}\b/);
  });

  it("renders '—' for null district/createdAt instead of a misleading placeholder", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);
    await screen.findByText("Lakshmi");

    const row = screen.getByText("Lakshmi").closest("tr")!;
    expect(row.textContent).toContain("—");
  });

  it("shows an empty state when there are no users, not an error", async () => {
    mockedApi.getHealth.mockResolvedValue(HEALTHY);
    mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
    mockedApi.listUsers.mockResolvedValue({ users: [] });
    mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);

    render(<JeevaMitraPage />);
    expect(await screen.findByText(/no users found/i)).toBeInTheDocument();
  });

  it("shows a loading state for the users table", () => {
    mockedApi.getHealth.mockResolvedValue(HEALTHY);
    mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
    mockedApi.listUsers.mockReturnValue(new Promise(() => {}));
    mockedApi.listDiseaseAlerts.mockResolvedValue(DISEASE_ALERTS);

    render(<JeevaMitraPage />);
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });
});

describe("JeevaMitraPage — disease alerts table", () => {
  it("renders only the approved fields", async () => {
    setupHappyPath();
    render(<JeevaMitraPage />);

    expect(await screen.findByText("Foot and Mouth Disease")).toBeInTheDocument();
    expect(screen.getByText("cattle")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("never renders symptoms/treatment/prevention/vetContactPhone/reportedBy — an empty array is valid data, not an error", async () => {
    mockedApi.getHealth.mockResolvedValue(HEALTHY);
    mockedApi.getDashboard.mockResolvedValue(DASHBOARD);
    mockedApi.listUsers.mockResolvedValue(USERS);
    mockedApi.listDiseaseAlerts.mockResolvedValue({ diseaseAlerts: [] });

    render(<JeevaMitraPage />);
    expect(await screen.findByText(/no disease alerts found/i)).toBeInTheDocument();
    // Never interpreted as an error/warning state.
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
