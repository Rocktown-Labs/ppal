import { authClient } from "./auth-client";

export const startWebSubscriptionCheckout = async ({
  billingPeriod,
  cancelPath,
  plan,
  successPath,
}: {
  billingPeriod: "monthly" | "yearly";
  cancelPath: string;
  plan: "creator" | "pro";
  successPath: string;
}): Promise<void> => {
  const checkout = await authClient.subscription.upgrade({
    annual: billingPeriod === "yearly",
    cancelUrl: `${window.location.origin}${cancelPath}`,
    disableRedirect: true,
    plan,
    successUrl: `${window.location.origin}${successPath}`,
  });
  if (checkout.error) {
    throw new Error(checkout.error.message ?? "Checkout could not be started");
  }
  const checkoutUrl = checkout.data?.url;
  if (!checkoutUrl) {
    throw new Error("Stripe did not return a checkout URL");
  }
  window.location.assign(checkoutUrl);
};
