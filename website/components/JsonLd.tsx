export default function JsonLd() {
  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Fuel Good",
    applicationCategory: "HealthApplication",
    operatingSystem: "iOS",
    offers: [
      {
        "@type": "Offer",
        price: "9.99",
        priceCurrency: "USD",
        description: "Monthly subscription with 7-day free trial",
      },
      {
        "@type": "Offer",
        price: "49.99",
        priceCurrency: "USD",
        description: "Annual subscription with 7-day free trial",
      },
    ],
    description:
      "Scan meals, explore whole-food recipes, and get AI-powered wellness guidance designed to help you make better everyday food decisions.",
    url: "https://fuelgood.app",
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Fuel Good",
    url: "https://fuelgood.app",
    email: "support@fuelgood.com",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
