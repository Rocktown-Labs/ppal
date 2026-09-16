import type { Auth } from "@ppal/auth";
import { webSubscriptionPlans } from "@ppal/contracts/billing";
import type { WebSubscriptionPlan } from "@ppal/contracts/billing";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import StripeSdk from "stripe";

import { getAuthUser } from "../lib/auth";

type BillingInterval = "month" | "year";
type CatalogStatus = "missing" | "needs_sync" | "ready";

interface CatalogPriceSummary {
  amountCents: number | null;
  currency: string | null;
  id: string | null;
  interval: BillingInterval;
  lookupKey: string;
  status: CatalogStatus;
}

interface CatalogPlanSummary {
  annual: CatalogPriceSummary;
  monthly: CatalogPriceSummary;
  plan: WebSubscriptionPlan;
  product: { id: string; name: string } | null;
  productStatus: CatalogStatus;
}

interface StripeCatalogResponse {
  plans: CatalogPlanSummary[];
  secretConfigured: boolean;
  webhookConfigured: boolean;
  webhookUrl: string;
}

class StripeCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeCatalogError";
  }
}

const PLAN_NAMES: readonly WebSubscriptionPlan[] = ["pro", "creator"];

const configuredPriceIds: Record<
  WebSubscriptionPlan,
  Record<BillingInterval, string>
> = {
  creator: {
    month: env.STRIPE_CREATOR_PRICE_ID?.trim() ?? "",
    year: env.STRIPE_CREATOR_ANNUAL_PRICE_ID?.trim() ?? "",
  },
  pro: {
    month: env.STRIPE_PRO_PRICE_ID?.trim() ?? "",
    year: env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim() ?? "",
  },
};

const getStripeClient = (): StripeSdk | null => {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  return secretKey ? new StripeSdk(secretKey) : null;
};

const isDeletedPrice = (
  price: StripeSdk.Price | StripeSdk.DeletedPrice
): price is StripeSdk.DeletedPrice =>
  "deleted" in price && price.deleted === true;

const isDeletedProduct = (
  product: StripeSdk.Product | StripeSdk.DeletedProduct
): product is StripeSdk.DeletedProduct =>
  "deleted" in product && product.deleted === true;

const getPriceProductId = (price: StripeSdk.Price): string | null => {
  if (typeof price.product === "string") {
    return price.product;
  }
  return price.product?.id ?? null;
};

const priceHasExpectedConfiguration = ({
  amountCents,
  interval,
  price,
  productId,
}: {
  amountCents: number;
  interval: BillingInterval;
  price: StripeSdk.Price;
  productId: string;
}): boolean =>
  price.currency === "usd" &&
  price.type === "recurring" &&
  price.unit_amount === amountCents &&
  price.recurring?.interval === interval &&
  getPriceProductId(price) === productId;

const productMatches = (
  product: StripeSdk.Product,
  plan: WebSubscriptionPlan
): boolean =>
  product.metadata.parlaypal_plan === plan ||
  product.name === webSubscriptionPlans[plan].displayName;

const findProduct = async (
  stripe: StripeSdk,
  plan: WebSubscriptionPlan
): Promise<StripeSdk.Product | null> => {
  const products = await stripe.products.list({ active: true, limit: 100 });
  return (
    products.data.find(
      (product) =>
        product.metadata.parlaypal_product ===
          webSubscriptionPlans[plan].productKey || productMatches(product, plan)
    ) ?? null
  );
};

const findProductFromConfiguredPrice = async (
  stripe: StripeSdk,
  plan: WebSubscriptionPlan
): Promise<StripeSdk.Product | null> => {
  const configuredPrices = (["month", "year"] as const)
    .map((interval) => ({
      interval,
      priceId: configuredPriceIds[plan][interval],
    }))
    .filter((entry) => entry.priceId);
  const products = await Promise.all(
    configuredPrices.map(async ({ interval, priceId }) => {
      const price = await stripe.prices.retrieve(priceId);
      if (isDeletedPrice(price)) {
        throw new StripeCatalogError(
          `Configured ${plan} ${interval} price ${priceId} was deleted`
        );
      }
      const productId = getPriceProductId(price);
      if (!productId) {
        throw new StripeCatalogError(
          `Configured ${plan} ${interval} price ${priceId} has no product`
        );
      }
      const planConfig = webSubscriptionPlans[plan];
      const amountCents =
        interval === "month"
          ? planConfig.monthlyPriceCents
          : planConfig.annualPriceCents;
      if (
        !priceHasExpectedConfiguration({
          amountCents,
          interval,
          price,
          productId,
        })
      ) {
        throw new StripeCatalogError(
          `Configured ${plan} ${interval} price ${priceId} does not match the configured ${amountCents} USD ${interval} catalog price`
        );
      }
      const product = await stripe.products.retrieve(productId);
      if (isDeletedProduct(product)) {
        throw new StripeCatalogError(
          `Configured ${plan} ${interval} price ${priceId} belongs to a deleted product`
        );
      }
      return product;
    })
  );
  const product = products[0] ?? null;
  if (product && products.some((candidate) => candidate.id !== product.id)) {
    throw new StripeCatalogError(
      `Configured ${plan} prices belong to different Stripe products`
    );
  }
  return product;
};

const resolveProduct = async (
  stripe: StripeSdk,
  plan: WebSubscriptionPlan,
  mutate: boolean
): Promise<StripeSdk.Product | null> => {
  const configuredProduct = await findProductFromConfiguredPrice(stripe, plan);
  const existing = configuredProduct ? null : await findProduct(stripe, plan);
  const product = configuredProduct ?? existing;
  if (product) {
    if (
      mutate &&
      (product.metadata.parlaypal_plan !== plan ||
        product.metadata.parlaypal_product !==
          webSubscriptionPlans[plan].productKey)
    ) {
      return stripe.products.update(product.id, {
        metadata: {
          ...product.metadata,
          parlaypal_plan: plan,
          parlaypal_product: webSubscriptionPlans[plan].productKey,
        },
      });
    }
    return product;
  }
  if (!mutate) {
    return null;
  }
  return stripe.products.create(
    {
      description: webSubscriptionPlans[plan].description,
      metadata: {
        parlaypal_plan: plan,
        parlaypal_product: webSubscriptionPlans[plan].productKey,
      },
      name: webSubscriptionPlans[plan].displayName,
    },
    { idempotencyKey: `parlaypal-product-${plan}` }
  );
};

const findPriceByLookupKey = async (
  stripe: StripeSdk,
  lookupKey: string
): Promise<StripeSdk.Price | null> => {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  return prices.data[0] ?? null;
};

const findMatchingProductPrice = async (
  stripe: StripeSdk,
  productId: string,
  plan: WebSubscriptionPlan,
  interval: BillingInterval
): Promise<StripeSdk.Price | null> => {
  const planConfig = webSubscriptionPlans[plan];
  const prices = await stripe.prices.list({ limit: 100, product: productId });
  return (
    prices.data.find((price) =>
      priceHasExpectedConfiguration({
        amountCents:
          interval === "month"
            ? planConfig.monthlyPriceCents
            : planConfig.annualPriceCents,
        interval,
        price,
        productId,
      })
    ) ?? null
  );
};

const resolvePrice = async (
  stripe: StripeSdk,
  plan: WebSubscriptionPlan,
  product: StripeSdk.Product | null,
  interval: BillingInterval,
  mutate: boolean
): Promise<StripeSdk.Price | null> => {
  const planConfig = webSubscriptionPlans[plan];
  const lookupKey =
    interval === "month" ? planConfig.lookupKey : planConfig.annualLookupKey;
  const amountCents =
    interval === "month"
      ? planConfig.monthlyPriceCents
      : planConfig.annualPriceCents;
  const configuredPriceId = configuredPriceIds[plan][interval];
  let price = await findPriceByLookupKey(stripe, lookupKey);

  if (!price && configuredPriceId) {
    const configuredPrice = await stripe.prices.retrieve(configuredPriceId);
    if (isDeletedPrice(configuredPrice)) {
      throw new StripeCatalogError(
        `Configured ${plan} ${interval} price ${configuredPriceId} was deleted`
      );
    }
    price = configuredPrice;
  }

  if (!price && product) {
    price = await findMatchingProductPrice(stripe, product.id, plan, interval);
  }

  if (!price) {
    if (!mutate || !product) {
      return null;
    }
    return stripe.prices.create(
      {
        currency: "usd",
        lookup_key: lookupKey,
        metadata: {
          parlaypal_interval: interval,
          parlaypal_plan: plan,
        },
        product: product.id,
        recurring: { interval },
        unit_amount: amountCents,
      },
      { idempotencyKey: `parlaypal-price-${plan}-${interval}` }
    );
  }

  if (!product) {
    throw new StripeCatalogError(
      `Stripe price ${price.id} exists but its product could not be resolved`
    );
  }

  if (
    !priceHasExpectedConfiguration({
      amountCents,
      interval,
      price,
      productId: product.id,
    })
  ) {
    throw new StripeCatalogError(
      `Stripe ${plan} ${interval} price ${price.id} does not match the configured ${amountCents} USD ${interval} catalog price`
    );
  }

  if (!mutate || (price.active && price.lookup_key === lookupKey)) {
    return price;
  }

  try {
    return await stripe.prices.update(price.id, {
      active: true,
      lookup_key: lookupKey,
      metadata: {
        ...price.metadata,
        parlaypal_interval: interval,
        parlaypal_plan: plan,
      },
    });
  } catch (error) {
    throw new StripeCatalogError(
      `Could not assign lookup key ${lookupKey} to Stripe price ${price.id}: ${error instanceof Error ? error.message : "Stripe rejected the update"}`
    );
  }
};

const summarizePrice = (
  price: StripeSdk.Price | null,
  plan: WebSubscriptionPlan,
  interval: BillingInterval
): CatalogPriceSummary => {
  const planConfig = webSubscriptionPlans[plan];
  const lookupKey =
    interval === "month" ? planConfig.lookupKey : planConfig.annualLookupKey;
  const expectedAmount =
    interval === "month"
      ? planConfig.monthlyPriceCents
      : planConfig.annualPriceCents;
  const isReady = Boolean(
    price &&
    price.active &&
    price.lookup_key === lookupKey &&
    priceHasExpectedConfiguration({
      amountCents: expectedAmount,
      interval,
      price,
      productId: getPriceProductId(price) ?? "",
    })
  );
  const hasPrice = Boolean(price);
  let status: CatalogStatus = "missing";
  if (isReady) {
    status = "ready";
  } else if (hasPrice) {
    status = "needs_sync";
  }
  return {
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    id: price?.id ?? null,
    interval,
    lookupKey,
    status,
  };
};

const syncStripeCatalog = (
  stripe: StripeSdk,
  mutate: boolean
): Promise<StripeCatalogResponse["plans"]> =>
  Promise.all(
    PLAN_NAMES.map(async (plan) => {
      const product = await resolveProduct(stripe, plan, mutate);
      const [monthly, annual] = await Promise.all([
        resolvePrice(stripe, plan, product, "month", mutate),
        resolvePrice(stripe, plan, product, "year", mutate),
      ]);
      const productIsManaged =
        product?.metadata.parlaypal_plan === plan &&
        product.metadata.parlaypal_product ===
          webSubscriptionPlans[plan].productKey;
      let productStatus: CatalogStatus = "missing";
      if (product) {
        productStatus = productIsManaged ? "ready" : "needs_sync";
      }
      return {
        annual: summarizePrice(annual, plan, "year"),
        monthly: summarizePrice(monthly, plan, "month"),
        plan,
        product: product ? { id: product.id, name: product.name } : null,
        productStatus,
      };
    })
  );

const responseMeta = (): Pick<
  StripeCatalogResponse,
  "secretConfigured" | "webhookConfigured" | "webhookUrl"
> => ({
  secretConfigured: Boolean(env.STRIPE_SECRET_KEY?.trim()),
  webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
  webhookUrl: "https://api.myparlaypal.com/api/auth/stripe/webhook",
});

export const createAdminBillingRoutes = (auth: Auth) =>
  new Hono()
    .get("/admin/stripe/catalog", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      if (user.role !== "admin") {
        return c.json(
          { code: "FORBIDDEN", error: "Admin access required" },
          403
        );
      }
      const stripe = getStripeClient();
      if (!stripe) {
        return c.json(
          {
            ...responseMeta(),
            code: "STRIPE_NOT_CONFIGURED",
            error: "Stripe secret key is not configured",
          },
          503
        );
      }
      try {
        return c.json({
          ...responseMeta(),
          plans: await syncStripeCatalog(stripe, false),
        });
      } catch (error) {
        return c.json(
          {
            ...responseMeta(),
            code: "STRIPE_CATALOG_READ_FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Stripe catalog could not be read",
          },
          502
        );
      }
    })
    .post("/admin/stripe/catalog/sync", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      if (user.role !== "admin") {
        return c.json(
          { code: "FORBIDDEN", error: "Admin access required" },
          403
        );
      }
      const stripe = getStripeClient();
      if (!stripe) {
        return c.json(
          {
            ...responseMeta(),
            code: "STRIPE_NOT_CONFIGURED",
            error: "Stripe secret key is not configured",
          },
          503
        );
      }
      try {
        return c.json({
          ...responseMeta(),
          plans: await syncStripeCatalog(stripe, true),
        });
      } catch (error) {
        const status = error instanceof StripeCatalogError ? 409 : 502;
        return c.json(
          {
            ...responseMeta(),
            code:
              error instanceof StripeCatalogError
                ? "STRIPE_CATALOG_MISMATCH"
                : "STRIPE_CATALOG_SYNC_FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Stripe catalog sync failed",
          },
          status
        );
      }
    });
