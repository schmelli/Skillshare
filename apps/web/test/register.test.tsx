import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
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
const { RegisterPage } = await import("@/routes/register");

const DUPLICATE_EMAIL_ERROR =
  "An account with this email already exists. Log in instead.";
const GENERIC_ERROR =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

function fillAndSubmit(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  afterEach(() => {
    vi.mocked(authClient.signUp.email).mockReset();
  });

  it("shows the exact duplicate-account copy for a 422 (already-exists) error", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: {
        status: 422,
        message: "User already exists. Use another email.",
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      },
    } as never);

    render(<RegisterPage />);
    fillAndSubmit("Existing User", "dup@example.com", "Correct-Horse-1");

    const error = await screen.findByTestId("register-error");
    expect(error.textContent).toBe(DUPLICATE_EMAIL_ERROR);
  });

  it("disables the submit button and shows a spinner while the request is in flight", async () => {
    let resolveSignUp!: (value: unknown) => void;
    vi.mocked(authClient.signUp.email).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignUp = resolve;
        }) as never,
    );

    render(<RegisterPage />);
    fillAndSubmit("New User", "new-user@example.com", "Correct-Horse-1");

    const button = await screen.findByRole("button", {
      name: /create account/i,
    });
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByTestId("register-spinner")).toBeTruthy();

    resolveSignUp({
      data: { user: { email: "new-user@example.com" } },
      error: null,
    });

    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("shows the generic failure copy when the request throws (network failure)", async () => {
    vi.mocked(authClient.signUp.email).mockRejectedValue(
      new Error("network down"),
    );

    render(<RegisterPage />);
    fillAndSubmit("New User", "new-user@example.com", "Correct-Horse-1");

    const error = await screen.findByTestId("register-error");
    expect(error.textContent).toBe(GENERIC_ERROR);
  });

  it("shows the generic failure copy for a non-422 server error (not the duplicate-email copy)", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      data: null,
      error: { status: 500, message: "Internal error", code: "UNKNOWN" },
    } as never);

    render(<RegisterPage />);
    fillAndSubmit("New User", "new-user@example.com", "Correct-Horse-1");

    const error = await screen.findByTestId("register-error");
    expect(error.textContent).toBe(GENERIC_ERROR);
  });

  it("applies fixed-width horizontal-scroll overflow handling to the email input (long-text state)", () => {
    render(<RegisterPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput.className).toContain("overflow-x-auto");
    expect(emailInput.className).toContain("whitespace-nowrap");
  });

  it("does not render a role field anywhere in the form (mass-assignment prohibition)", () => {
    render(<RegisterPage />);
    expect(screen.queryByLabelText(/role/i)).toBeNull();
  });
});
