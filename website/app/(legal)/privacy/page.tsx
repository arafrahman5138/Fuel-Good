import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Fuel Good",
  description: "Fuel Good privacy policy — what information we collect and how we use it.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Fuel Good Privacy Policy</h1>
      <p className="text-fg-tertiary text-sm italic mb-8">
        Last updated: March 10, 2026
      </p>

      <p>
        Fuel Good provides general wellness, nutrition, recipe, and meal-scanning 
        features. This Privacy Policy explains what information we collect, how we 
        use it, and the choices you have.
      </p>

      <h2>Information We Collect</h2>
      <p>We may collect:</p>
      <ul>
        <li>Account information such as your name and email address</li>
        <li>Sign-in information from Apple or Google when you choose those providers</li>
        <li>Profile and preference information you enter in the app</li>
        <li>Meal logs, saved recipes, scan results, and other in-app content</li>
        <li>Photos or images you choose to upload for meal or label scanning</li>
        <li>Chat messages and prompts you send to AI-powered features</li>
        <li>Technical and diagnostic information needed to operate, secure, and improve the app</li>
      </ul>

      <h2>How We Use Information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Create and secure your account</li>
        <li>Provide meal scanning, nutrition insights, AI guidance, and recipe features</li>
        <li>Personalize app results based on your preferences and history</li>
        <li>Diagnose reliability issues, investigate bugs, and protect against abuse</li>
        <li>Respond to support requests and operational communications</li>
      </ul>

      <h2>AI and Third-Party Services</h2>
      <p>
        Some features rely on third-party providers for authentication, AI processing, 
        hosting, or food data services. Information may be sent to those providers only 
        as needed to provide the feature you requested.
      </p>

      <h2>Camera and Photos</h2>
      <p>
        Fuel Good accesses your camera or photo library only when you choose to scan 
        a meal or label or upload an image.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain account and app data for as long as needed to operate the service, 
        comply with legal obligations, resolve disputes, and enforce agreements. We may 
        keep limited diagnostic records for security and debugging.
      </p>

      <h2>Your Choices</h2>
      <p>You can:</p>
      <ul>
        <li>Update certain profile and preference information in the app</li>
        <li>Stop using camera or photo features by declining permissions</li>
        <li>Contact us to request support or account-related help</li>
      </ul>

      <h2>Children</h2>
      <p>
        Fuel Good is not intended for children under 13 and is not designed as a kids app.
      </p>

      <h2>Wellness Disclaimer</h2>
      <p>
        Fuel Good is for general wellness and informational use only. It does not provide 
        medical advice or diagnosis.
      </p>

      <h2>Contact</h2>
      <p>
        Support:{" "}
        <a href="mailto:support@fuelgood.com">support@fuelgood.com</a>
      </p>
    </>
  );
}
