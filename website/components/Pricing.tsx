import { AnimateOnScroll } from "./AnimateOnScroll";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    badge: null,
    features: [
      "AI meal & label scanning",
      "Personalized meal plans",
      "200+ whole-food recipes",
      "AI wellness coach (Healthify)",
      "Nutrition tracking & trends",
      "Smart grocery lists",
      "Cook mode with timers",
    ],
    highlighted: false,
  },
  {
    name: "Annual",
    price: "$49.99",
    period: "/year",
    badge: "Save 58%",
    features: [
      "Everything in Monthly",
      "Best value — just $4.17/month",
      "Priority feature access",
      "Annual commitment savings",
    ],
    highlighted: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 relative">
      <div className="max-w-5xl mx-auto px-6">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-fg-secondary text-lg max-w-2xl mx-auto">
              Start with a free 7-day trial. Cancel anytime from your App
              Store settings.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, i) => (
            <AnimateOnScroll key={plan.name} delay={i * 150}>
              <div
                className={`relative p-8 rounded-2xl border h-full flex flex-col ${
                  plan.highlighted
                    ? "bg-surface border-primary/40 glow-primary"
                    : "bg-surface border-border"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold rounded-pill">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-fg mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-fg">
                      {plan.price}
                    </span>
                    <span className="text-fg-tertiary text-sm">
                      {plan.period}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg text-primary text-xs font-semibold mb-5">
                    7-day free trial included
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-fg-secondary text-sm"
                      >
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="#download"
                  className={`mt-8 block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlighted
                      ? "bg-primary text-white hover:bg-primary-dark"
                      : "bg-surface-elevated text-fg hover:bg-surface-highlight"
                  }`}
                >
                  Start Free Trial
                </a>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
