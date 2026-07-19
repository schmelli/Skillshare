import { z } from "zod";

// Public sign-up / sign-in DTOs. Deliberately contain ONLY email + password
// (+ name for sign-up) — NEVER a `role` field. Role assignment is always
// server-derived and Admin-only (Plan 05's grant endpoint); accepting a
// client-submitted role here would be a mass-assignment privilege-escalation
// vulnerability (RESEARCH.md Pitfall 4, threat T-03-02).
export const signUpDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});
export type SignUpDto = z.infer<typeof signUpDto>;

export const signInDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInDto = z.infer<typeof signInDto>;
