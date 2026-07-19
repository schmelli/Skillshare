import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
  };
});

const { authClient } = await import("@/lib/auth-client");
const { LoginPage } = await import("@/routes/login");

const AMBIGUOUS_LOGIN_ERROR =
  "That email or password is incorrect. Check your details and try again.";
const GENERIC_ERROR =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginPage", () => {
  afterEach(() => {
    vi.mocked(authClient.signIn.email).mockReset();
  });

  it("shows the exact ambiguous copy for a wrong password (does not name the field)", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 401, message: "Invalid password", code: "INVALID_PASSWORD" },
    } as never);

    render(<LoginPage />);
    fillAndSubmit("real-user@example.com", "wrong-password");

    const error = await screen.findByTestId("login-error");
    expect(error.textContent).toBe(AMBIGUOUS_LOGIN_ERROR);
  });

  it("shows the SAME ambiguous copy for a nonexistent email (no enumeration branching)", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 401, message: "User not found", code: "USER_NOT_FOUND" },
    } as never);

    render(<LoginPage />);
    fillAndSubmit("no-such-user@example.com", "whatever-password");

    const error = await screen.findByTestId("login-error");
    expect(error.textContent).toBe(AMBIGUOUS_LOGIN_ERROR);
  });

  it("disables the submit button and shows a spinner while the request is in flight", async () => {
    let resolveSignIn!: (value: unknown) => void;
    vi.mocked(authClient.signIn.email).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }) as never,
    );

    render(<LoginPage />);
    fillAndSubmit("real-user@example.com", "correct-password");

    const button = await screen.findByRole("button", { name: /log in/i });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByTestId("login-spinner")).toBeTruthy();

    resolveSignIn({ data: { user: { email: "real-user@example.com" } }, error: null });

    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("shows the generic failure copy when the request throws (network failure)", async () => {
    vi.mocked(authClient.signIn.email).mockRejectedValue(new Error("network down"));

    render(<LoginPage />);
    fillAndSubmit("real-user@example.com", "correct-password");

    const error = await screen.findByTestId("login-error");
    expect(error.textContent).toBe(GENERIC_ERROR);
  });

  it("applies fixed-width horizontal-scroll overflow handling to the email input (long-text state)", () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput.className).toContain("overflow-x-auto");
    expect(emailInput.className).toContain("whitespace-nowrap");
  });
});
