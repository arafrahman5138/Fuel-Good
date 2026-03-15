import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — Fuel Good",
  description: "Get help with Fuel Good — contact support for account issues, bug reports, or feedback.",
};

export default function SupportPage() {
  return (
    <>
      <h1>Fuel Good Support</h1>

      <p>
        For product support, account issues, bug reports, or feedback:
      </p>

      <div className="my-8 p-6 rounded-2xl bg-surface-elevated border border-border">
        <p className="text-fg font-semibold mb-1">Email us</p>
        <a
          href="mailto:support@fuelgood.com"
          className="text-primary hover:text-primary-light text-lg font-semibold transition-colors"
        >
          support@fuelgood.com
        </a>
        <p className="text-fg-tertiary text-sm mt-2">
          Response target: within 2 business days
        </p>
      </div>

      <h2>Include in Your Message</h2>
      <ul>
        <li>Device model</li>
        <li>iOS version</li>
        <li>App version/build</li>
        <li>What you were doing when the issue happened</li>
        <li>Any request ID or error text shown in the app</li>
      </ul>

      <h2>Common Topics</h2>
      <ul>
        <li>Sign-in issues</li>
        <li>Scan upload failures</li>
        <li>Missing or incorrect meal analysis</li>
        <li>Account and privacy requests</li>
      </ul>
    </>
  );
}
