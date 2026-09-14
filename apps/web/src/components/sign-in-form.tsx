import { Input } from "@ppal/ui/components/input";
import { Label } from "@ppal/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

const SignInForm = ({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) => {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
          onSuccess: () => {
            navigate({
              to: "/dashboard",
            });
            toast.success("Sign in successful");
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8">
        <img
          src="/images/logo.png"
          alt="ParlayPal"
          className="h-12 w-auto max-w-none object-contain"
        />
      </Link>

      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl ring-1 ring-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Sign in to track your active bets and check your hit rates
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor={field.name}
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Email
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="name@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="border-zinc-700 bg-zinc-800/80 text-white placeholder:text-zinc-500"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-xs text-rose-400">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <div>
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor={field.name}
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Password
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="border-zinc-700 bg-zinc-800/80 text-white placeholder:text-zinc-500"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-xs text-rose-400">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
          </div>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Signing in..." : "Sign In →"}
              </button>
            )}
          </form.Subscribe>
        </form>

        <div className="mt-6 border-t border-zinc-800 pt-4 text-center">
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="cursor-pointer text-xs font-semibold text-zinc-400 transition hover:text-emerald-400"
          >
            Don&apos;t have an account?{" "}
            <span className="text-emerald-400">Create one</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignInForm;
