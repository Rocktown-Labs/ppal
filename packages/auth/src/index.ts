/* oxlint-disable sort-keys -- Better Auth options are grouped by subsystem. */

import { expo } from "@better-auth/expo";
import { passkey } from "@better-auth/passkey";
import { stripe } from "@better-auth/stripe";
import type { Subscription } from "@better-auth/stripe";
import { webSubscriptionPlans } from "@ppal/contracts/billing";
import { createDb } from "@ppal/db";
import * as schema from "@ppal/db/schema/auth";
import { env } from "@ppal/env/server";
import { compare } from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { admin, twoFactor } from "better-auth/plugins";
import { Resend } from "resend";
import StripeSdk from "stripe";
import { z } from "zod";

const useSecureCookies = env.BETTER_AUTH_URL.startsWith("https://");

const getResendClient = (): Resend | null => {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

const sendVerificationEmail = async ({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<void> => {
  const resend = getResendClient();
  if (!resend) {
    return;
  }
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL || "noreply@support.myparlaypal.com",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0d1117; color: #f3f4f6; border-radius: 12px; border: 1px solid #2d3748;">
      <h2 style="color: #10b981; margin-top: 0; font-size: 24px;">Welcome to ParlayPal</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">Please confirm your email address by clicking the link below to activate your account and start tracking your slips.</p>
      <div style="margin: 28px 0;">
        <a href="${url}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Verify Email</a>
      </div>
      <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">If you didn't create a ParlayPal account, you can safely ignore this email.</p>
    </div>`,
    subject: "Verify your email - ParlayPal",
    to: email,
    ...(env.RESEND_REPLY_TO_EMAIL
      ? { replyTo: env.RESEND_REPLY_TO_EMAIL }
      : {}),
  });
};

const sendResetPasswordEmail = async ({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<void> => {
  const resend = getResendClient();
  if (!resend) {
    return;
  }
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL || "noreply@support.myparlaypal.com",
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0d1117; color: #f3f4f6; border-radius: 12px; border: 1px solid #2d3748;">
      <h2 style="color: #10b981; margin-top: 0; font-size: 24px;">Reset Your Password</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">We received a request to reset your ParlayPal password. Click the button below to choose a new password:</p>
      <div style="margin: 28px 0;">
        <a href="${url}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    </div>`,
    subject: "Reset your password - ParlayPal",
    to: email,
    ...(env.RESEND_REPLY_TO_EMAIL
      ? { replyTo: env.RESEND_REPLY_TO_EMAIL }
      : {}),
  });
};

const synchronizeStripeEntitlement = async (
  subscription: Subscription
): Promise<void> => {
  if (subscription.plan !== "pro" && subscription.plan !== "creator") {
    return;
  }
  const now = Date.now();
  let status: string = subscription.status;
  if (subscription.status === "canceled") {
    status = "cancelled";
  } else if (
    subscription.status === "unpaid" ||
    subscription.status === "incomplete"
  ) {
    status = "past_due";
  } else if (subscription.status === "incomplete_expired") {
    status = "expired";
  }
  const providerReference =
    subscription.stripeSubscriptionId ?? subscription.id;
  await env.DB.prepare(
    `INSERT INTO billing_entitlements (
      created_at, current_period_end, current_period_start, effective_at, expires_at,
      id, plan, provider_reference, source, status, updated_at, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stripe', ?, ?, ?)
    ON CONFLICT(source, provider_reference) DO UPDATE SET
      current_period_end = excluded.current_period_end,
      current_period_start = excluded.current_period_start,
      expires_at = excluded.expires_at,
      plan = excluded.plan,
      status = excluded.status,
      updated_at = excluded.updated_at,
      user_id = excluded.user_id`
  )
    .bind(
      now,
      subscription.periodEnd?.getTime() ?? null,
      subscription.periodStart?.getTime() ?? null,
      subscription.periodStart?.getTime() ?? now,
      subscription.periodEnd?.getTime() ?? null,
      `stripe:${providerReference}`,
      subscription.plan,
      providerReference,
      status,
      now,
      subscription.referenceId
    )
    .run();
};

const createStripePlugin = () => {
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const proPriceId = env.STRIPE_PRO_PRICE_ID?.trim();
  const creatorPriceId = env.STRIPE_CREATOR_PRICE_ID?.trim();
  if (!(stripeSecretKey && stripeWebhookSecret)) {
    return null;
  }
  const stripeClient = new StripeSdk(stripeSecretKey);
  return stripe({
    stripeClient,
    stripeWebhookSecret,
    subscription: {
      enabled: true,
      onSubscriptionComplete: async ({ subscription }) => {
        await synchronizeStripeEntitlement(subscription);
      },
      onSubscriptionCreated: async ({ subscription }) => {
        await synchronizeStripeEntitlement(subscription);
      },
      onSubscriptionDeleted: async ({ subscription }) => {
        await synchronizeStripeEntitlement(subscription);
      },
      onSubscriptionUpdate: async ({ subscription }) => {
        await synchronizeStripeEntitlement(subscription);
      },
      plans: [
        {
          annualDiscountLookupKey: webSubscriptionPlans.pro.annualLookupKey,
          annualDiscountPriceId:
            env.STRIPE_PRO_ANNUAL_PRICE_ID?.trim() || undefined,
          limits: { monthlyUploads: webSubscriptionPlans.pro.monthlyUploads },
          name: "pro",
          lookupKey: webSubscriptionPlans.pro.lookupKey,
          priceId: proPriceId || undefined,
        },
        {
          annualDiscountLookupKey: webSubscriptionPlans.creator.annualLookupKey,
          annualDiscountPriceId:
            env.STRIPE_CREATOR_ANNUAL_PRICE_ID?.trim() || undefined,
          limits: {
            monthlyUploads: webSubscriptionPlans.creator.monthlyUploads,
          },
          name: "creator",
          lookupKey: webSubscriptionPlans.creator.lookupKey,
          priceId: creatorPriceId || undefined,
        },
      ],
      getCheckoutSessionParams: () => ({
        params: {
          integration_identifier: `parlaypal_web_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
          ...(env.STRIPE_TAX_ENABLED === "true"
            ? {
                automatic_tax: { enabled: true },
                customer_update: { address: "auto" },
              }
            : {}),
        },
      }),
    },
  });
};

export const createAuth = () => {
  const db = createDb();
  const stripePlugin = createStripePlugin();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema,
    }),
    user: {
      additionalFields: {
        termsAccepted: {
          fieldName: "terms_accepted",
          required: false,
          returned: false,
          type: "boolean",
          validator: { input: z.literal(true) },
        },
      },
    },
    trustedOrigins: [
      env.CORS_ORIGIN,

      "https://myparlaypal.com",

      "ppal://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: async ({ hash, password }) => {
          if (/^\$2[aby]\$/u.test(hash)) {
            return await compare(password, hash.replace(/^\$2y\$/u, "$2b$"));
          }
          return await verifyPassword({ hash, password });
        },
      },
      sendResetPassword: async ({ url, user }) => {
        await sendResetPasswordEmail({ email: user.email, url });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ url, user }) => {
        await sendVerificationEmail({ email: user.email, url });
      },
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: env.APPLE_CLIENT_ID,
              clientSecret: env.APPLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
        ? {
            facebook: {
              clientId: env.FACEBOOK_CLIENT_ID,
              clientSecret: env.FACEBOOK_CLIENT_SECRET,
            },
          }
        : {}),
    },
    rateLimit: {
      customRules: {
        "/sign-in/email": { max: 10, window: 60 },
        "/sign-up/email": { max: 5, window: 60 },
      },
      enabled: true,
      max: 100,
      window: 60,
    },
    // Keep a short-lived signed session snapshot in the cookie so server-side
    // auth.api.getSession calls work reliably on Cloudflare Workers without a
    // second request hop. Sensitive operations still bypass this cache when
    // Better Auth requests an authoritative session.
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies,
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
    plugins: [
      expo(),
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
      }),
      twoFactor({
        issuer: "ParlayPal",
      }),
      passkey(),
      ...(stripePlugin ? [stripePlugin] : []),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

export type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
