import { createFileRoute } from "@tanstack/react-router";

import { LegalShell } from "@/components/legal/legal-shell";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

const TermsPage = () => (
  <LegalShell
    description="The rules for using ParlayPal, our sportsbook-independent live bet tracking companion."
    eyebrow="Legal & Support"
    title="Terms of Service"
  >
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">1. Using ParlayPal</h2>
      <p className="leading-7 text-zinc-400">
        ParlayPal provides tools to read uploaded bet slips, match selections to
        sports events, track game progress, and deliver notifications. It is not
        a sportsbook, gambling operator, payment processor, or source of
        wagering advice. ParlayPal does not accept wagers, hold betting funds,
        or determine the outcome of a wager.
      </p>
      <p className="leading-7 text-zinc-400">
        You must be at least 18 years old, or the minimum legal age where you
        live, and you are responsible for following the laws that apply to you.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">2. Your account</h2>
      <p className="leading-7 text-zinc-400">
        Keep your login details secure and provide accurate information. You are
        responsible for activity under your account and must tell us if you
        believe it has been accessed without permission.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">3. Uploaded content</h2>
      <p className="leading-7 text-zinc-400">
        You keep ownership of images and information you upload. You give
        ParlayPal permission to process that content to extract, display, and
        track your selections and to provide the service. Only upload content
        you are allowed to share.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        4. Accuracy and availability
      </h2>
      <p className="leading-7 text-zinc-400">
        Sports data, extracted text, scores, player statistics, event status,
        and notifications can be delayed, incomplete, or incorrect. They are
        provided for tracking and informational purposes only. Always verify a
        result with your sportsbook or official source. We do not guarantee
        uninterrupted service or that every slip, market, or sport can be
        matched.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">5. Subscriptions</h2>
      <p className="leading-7 text-zinc-400">
        Paid web subscriptions are billed through Stripe and are governed by the
        plan and checkout terms shown at purchase. Mobile subscriptions may be
        billed through the applicable app store. You can manage or cancel a
        subscription through the relevant billing provider. A cancellation
        generally takes effect at the end of the current billing period unless
        the checkout terms say otherwise.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        6. Prohibited use and termination
      </h2>
      <p className="leading-7 text-zinc-400">
        Do not abuse the service, bypass usage limits, reverse engineer the
        product, upload unlawful or harmful content, impersonate another person,
        or use ParlayPal to violate a sportsbook&apos;s rules or applicable law.
        We may suspend or terminate access when reasonably necessary to protect
        the service, users, or third parties.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">7. Changes and contact</h2>
      <p className="leading-7 text-zinc-400">
        We may update these terms as the service changes. The updated version
        will be posted here with a new effective date. Questions about these
        terms can be sent to{" "}
        <a
          className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
          href="mailto:support@myparlaypal.com"
        >
          support@myparlaypal.com
        </a>
        .
      </p>
    </section>
  </LegalShell>
);

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    links: [{ href: absoluteUrl("/terms"), rel: "canonical" }],
    meta: [
      { title: `Terms of Service | ${SITE_NAME}` },
      {
        content:
          "Read the ParlayPal Terms of Service for our sportsbook-independent live bet tracking companion.",
        name: "description",
      },
    ],
  }),
});
