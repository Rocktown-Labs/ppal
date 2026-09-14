import { Input } from "@ppal/ui/components/input";
import { Label } from "@ppal/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

const SignUpForm = ({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) => {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          name: value.name,
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
            toast.success("Sign up successful");
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        name: z.string().min(2, "Name must be at least 2 characters"),
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
            Create your account
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Start tracking every leg with live real-time updates
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
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label
                    htmlFor={field.name}
                    className="text-xs font-semibold text-zinc-300"
                  >
                    Your Name
                  </Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="Alex Morgan"
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
                    placeholder="At least 8 characters"
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
                {isSubmitting ? "Creating account..." : "Get Started Free →"}
              </button>
            )}
          </form.Subscribe>
        </form>

        <div className="mt-6 border-t border-zinc-800 pt-4 text-center">
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="cursor-pointer text-xs font-semibold text-zinc-400 transition hover:text-emerald-400"
          >
            Already have an account?{" "}
            <span className="text-emerald-400">Sign in</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignUpForm;
