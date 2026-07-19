import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpDto, type SignUpDto } from "@skillshare/shared";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

// UI-SPEC.md's deliberate registration/login asymmetry: duplicate
// registration DOES disclose the account already exists (more useful for a
// non-technical, single-org self-hosted tool than enumeration-hardened
// ambiguity) — unlike login's ambiguous copy.
const DUPLICATE_EMAIL_ERROR =
  "An account with this email already exists. Log in instead.";
const GENERIC_ERROR =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

function RegisterPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<SignUpDto>({
    resolver: zodResolver(signUpDto),
    defaultValues: { email: "", password: "", name: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignUpDto) => {
    setSubmitError(null);
    try {
      const { error } = await authClient.signUp.email(values);
      if (error) {
        // better-auth's core sign-up route throws a 422
        // (UNPROCESSABLE_ENTITY / USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL) for
        // a duplicate email — the one case with a more specific message per
        // the UI-SPEC's deliberate register/login copy asymmetry.
        setSubmitError(
          error.status === 422 ? DUPLICATE_EMAIL_ERROR : GENERIC_ERROR,
        );
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setSubmitError(GENERIC_ERROR);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">
            Create your account
          </CardTitle>
          <CardDescription>
            Register with your work email to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4"
              noValidate
            >
              {submitError && (
                <p
                  className="text-sm text-destructive"
                  role="alert"
                  data-testid="register-error"
                >
                  {submitError}
                </p>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        className="overflow-x-auto whitespace-nowrap"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full"
              >
                {isSubmitting && (
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                    data-testid="register-spinner"
                  />
                )}
                Create account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="underline">
                  Log in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
