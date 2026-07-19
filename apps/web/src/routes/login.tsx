import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInDto, type SignInDto } from "@skillshare/shared";
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

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

// UI-SPEC.md's login-invalid copy: deliberately does NOT disclose which
// field (email vs. password) was wrong — credential-enumeration mitigation
// (threat T-03-03).
const AMBIGUOUS_LOGIN_ERROR =
  "That email or password is incorrect. Check your details and try again.";
const GENERIC_ERROR =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

// Exported (not just via `Route.options.component`) so component tests can
// render it in isolation without needing the full generated route tree.
export function LoginPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<SignInDto>({
    resolver: zodResolver(signInDto),
    defaultValues: { email: "", password: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: SignInDto) => {
    setSubmitError(null);
    try {
      const { error } = await authClient.signIn.email(values);
      if (error) {
        setSubmitError(AMBIGUOUS_LOGIN_ERROR);
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
            Sign in to Skillshare
          </CardTitle>
          <CardDescription>
            Enter your email and password to continue.
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
                  data-testid="login-error"
                >
                  {submitError}
                </p>
              )}
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
                        autoComplete="current-password"
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
                    data-testid="login-spinner"
                  />
                )}
                Log in
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="underline">
                  Create one
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
