import { createFileRoute } from "@tanstack/react-router";

import { LegalShell } from "@/components/legal/legal-shell";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

const PrivacyPage = () => (
  <LegalShell
    description="How ParlayPal collects, uses, and protects information when you use our web and mobile services."
    eyebrow="Legal & Support"
    title="Privacy Policy"
  >
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        1. Information we collect
      </h2>
      <p className="leading-7 text-zinc-400">
        We collect information you provide when you create an account, such as
        your name, email address, profile details, uploaded bet-slip images,
        notification preferences, and messages or support requests. If you sign
        in with Google or Facebook, we receive the profile information that
        provider shares with your permission.
      </p>
      <p className="leading-7 text-zinc-400">
        We also receive technical and usage information needed to operate the
        service, such as device and browser details, approximate network
        information, log events, and feature activity. Payment details are
        handled by the applicable billing provider and are not stored by
        ParlayPal as complete card numbers.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        2. How we use information
      </h2>
      <p className="leading-7 text-zinc-400">
        We use information to authenticate accounts, extract and track slips,
        send requested notifications, provide subscriptions, improve
        reliability, prevent abuse, respond to support requests, and comply with
        legal obligations. We do not sell uploaded slip images or use private
        account data to place wagers on your behalf.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">3. Service providers</h2>
      <p className="leading-7 text-zinc-400">
        We use trusted providers to run parts of the service, including
        Cloudflare for hosting and storage, sports-data providers for event
        information, Resend for transactional email, Stripe for web billing, and
        app-store or mobile subscription providers when applicable. These
        providers receive only the information needed for their services and
        operate under their own terms and privacy policies.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        4. Sharing and public profiles
      </h2>
      <p className="leading-7 text-zinc-400">
        We do not share private slip images or account details publicly unless
        you choose a feature that makes information public. If you publish a
        profile or scorecard, the information shown there may be visible to
        other people. We may disclose information when required by law or when
        necessary to protect users, the service, or our legal rights.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">5. Your choices</h2>
      <p className="leading-7 text-zinc-400">
        You can update account and notification settings in the dashboard,
        disconnect linked accounts where supported, and request help with
        access, correction, or deletion by contacting support. Some records may
        be retained when needed for security, billing, dispute resolution, or
        legal compliance.
      </p>
    </section>

    <section className="space-y-4">
      <h2 className="text-xl font-bold text-white">
        6. Security, children, and changes
      </h2>
      <p className="leading-7 text-zinc-400">
        We use reasonable safeguards designed to protect information, but no
        online service can guarantee absolute security. ParlayPal is not
        intended for children under 13. We may update this policy as the service
        changes; the updated version will be posted here with a new effective
        date.
      </p>
      <p className="leading-7 text-zinc-400">
        Privacy questions or requests can be sent to{" "}
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

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [{ href: absoluteUrl("/privacy"), rel: "canonical" }],
    meta: [
      { title: `Privacy Policy | ${SITE_NAME}` },
      {
        content:
          "Read the ParlayPal Privacy Policy to learn how we handle account, slip, sports tracking, and notification data.",
        name: "description",
      },
    ],
  }),
});
