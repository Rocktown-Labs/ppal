import { redirect } from "@tanstack/react-router";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

/**
 * Route guard for auth entry views. Sends an already-signed-in visitor to
 * their next destination instead of showing them a sign-in form they cannot
 * use: members with a finished profile land on the dashboard, brand-new
 * accounts continue the profile wizard.
 */
export const redirectSignedInVisitor = async (): Promise<void> => {
  const session = await authClient.getSession();
  if (!session.data) {
    return;
  }
  let profile: Awaited<
    ReturnType<typeof api.community.getMe>
  >["user"]["profile"];
  try {
    const response = await api.community.getMe();
    const { profile: currentProfile } = response.user;
    profile = currentProfile;
  } catch {
    // If the API is briefly unavailable, leave the auth form usable.
    return;
  }
  throw redirect({
    to: profile?.username?.trim() ? "/dashboard" : "/dashboard/onboarding",
  });
};
