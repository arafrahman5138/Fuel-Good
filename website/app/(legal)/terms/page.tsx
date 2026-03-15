import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Fuel Good",
  description: "Fuel Good terms of service governing your use of the app.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Fuel Good Terms of Service</h1>
      <p className="text-fg-tertiary text-sm italic mb-8">
        Last updated: March 10, 2026
      </p>

      <p>These Terms of Service govern your use of Fuel Good.</p>

      <h2>Service Scope</h2>
      <p>
        Fuel Good provides general wellness, meal-scanning, nutrition, recipe, and 
        AI-assisted food guidance features. The service is for informational and 
        lifestyle support only.
      </p>

      <h2>No Medical Advice</h2>
      <p>
        Fuel Good is not a medical provider and does not diagnose, treat, cure, or 
        prevent disease. Do not rely on the app for emergency or clinical decisions.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for maintaining the security of your account and for 
        activity that occurs under it. You must provide accurate registration 
        information and keep your credentials secure.
      </p>

      <h2>Trials and Subscriptions</h2>
      <p>
        Fuel Good offers auto-renewing subscriptions billed through Apple for iOS 
        digital access. Pricing and available plans may change, but the in-app paywall 
        and App Store checkout screen control the active offer at purchase time.
      </p>
      <p>
        If offered, your subscription may begin with a free trial period. Unless you 
        cancel at least 24 hours before the trial or current billing period ends, the 
        subscription renews automatically at the then-current rate charged through your 
        App Store account.
      </p>
      <p>
        You can manage or cancel your subscription through your Apple account 
        subscription settings. Deleting the app does not cancel an active subscription. 
        Refund requests are handled by Apple under its platform policies.
      </p>
      <p>
        If your subscription expires, payment fails, or the trial ends without a 
        continuing paid subscription, access to the paid portions of the app may stop 
        or be limited until billing is restored.
      </p>

      <h2>Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Misuse the service or attempt unauthorized access</li>
        <li>Upload unlawful or harmful content</li>
        <li>Reverse engineer or interfere with the platform</li>
        <li>Use automated means to abuse the service or exceed intended usage</li>
      </ul>

      <h2>Service Availability</h2>
      <p>
        We may update, suspend, or discontinue features at any time. We do not 
        guarantee uninterrupted availability.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        Some features depend on third-party providers such as Apple, Google, AI 
        providers, hosting vendors, and food data services. Their availability may 
        affect the service.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Fuel Good is provided on an 
        &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate access for misuse, abuse, security concerns, or 
        violation of these terms.
      </p>

      <h2>Contact</h2>
      <p>
        Support:{" "}
        <a href="mailto:support@fuelgood.com">support@fuelgood.com</a>
      </p>
    </>
  );
}
