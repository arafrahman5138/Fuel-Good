import { AnimateOnScroll } from "./AnimateOnScroll";
import { Camera, Brain, Utensils } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Camera,
    title: "Scan or log your meals",
    description:
      "Use your camera to scan meals and nutrition labels, or browse our whole-food recipe library.",
  },
  {
    number: "02",
    icon: Brain,
    title: "Get AI-powered insights",
    description:
      "Receive instant ingredient analysis, nutrition feedback, and personalized whole-food recommendations.",
  },
  {
    number: "03",
    icon: Utensils,
    title: "Follow your meal plan",
    description:
      "Cook with step-by-step guidance, auto-generated grocery lists, and weekly plans tuned to your preferences.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32 bg-surface-elevated/50 relative"
    >
      <div className="max-w-6xl mx-auto px-6">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-fg-secondary text-lg max-w-2xl mx-auto">
              Three simple steps to transform your relationship with food.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-[4.5rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-primary/50 via-primary/30 to-primary/50" />

          {STEPS.map((step, i) => (
            <AnimateOnScroll key={step.number} delay={i * 150}>
              <div className="flex flex-col items-center text-center relative">
                {/* Step number + icon */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center group-hover:border-primary/30 transition-colors">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                    {step.number}
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-2 text-fg">
                  {step.title}
                </h3>
                <p className="text-fg-secondary leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
