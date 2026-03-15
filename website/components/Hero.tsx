import { AnimateOnScroll } from "./AnimateOnScroll";
import { Smartphone, Sparkles, ChefHat, MessageCircle, ScanLine, UtensilsCrossed, Apple, Leaf } from "lucide-react";

export function AppStoreBadge() {
  return (
    <a
      href="https://apps.apple.com/app/fuel-good/id0000000000"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-100 transition-colors group"
    >
      <Apple className="w-7 h-7" fill="currentColor" />
      <div className="text-left">
        <div className="text-[10px] leading-tight font-medium">
          Download on the
        </div>
        <div className="text-lg leading-tight font-semibold -mt-0.5">
          App Store
        </div>
      </div>
    </a>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 hero-gradient-subtle" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-info/5 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left column - Copy */}
          <div className="flex-1 text-center lg:text-left">
            <AnimateOnScroll>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-primary/10 border border-primary/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary text-xs font-semibold tracking-wide uppercase">
                  AI-Powered Nutrition
                </span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-hero font-black tracking-tight leading-[1.1] mb-6">
                Eat real.{" "}
                <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Feel amazing.
                </span>
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={200}>
              <p className="text-fg-secondary text-lg sm:text-xl leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Scan meals, explore whole-food recipes, and get AI-powered 
                wellness guidance designed to help you make better everyday 
                food decisions.
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={300}>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <AppStoreBadge />
                <span className="text-fg-tertiary text-sm">
                  Free 7-day trial &middot; No commitment
                </span>
              </div>
            </AnimateOnScroll>
          </div>

          {/* Right column - Phone mockup */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <AnimateOnScroll delay={400}>
              <div className="relative">
                {/* Phone frame */}
                <div className="w-[280px] sm:w-[300px] h-[580px] sm:h-[620px] rounded-[3rem] border-[6px] border-surface-elevated bg-surface shadow-2xl overflow-hidden">
                  {/* Status bar mockup */}
                  <div className="h-12 bg-surface-elevated flex items-center justify-center">
                    <div className="w-24 h-6 bg-surface-highlight rounded-full" />
                  </div>
                  {/* Screen content placeholder */}
                  <div className="flex flex-col items-center justify-center h-[calc(100%-48px)] px-6 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                      <Leaf className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-fg font-bold text-lg mb-1">Fuel Good</h3>
                      <p className="text-fg-tertiary text-sm">
                        Your whole-food companion
                      </p>
                    </div>
                    {/* Feature preview pills */}
                    <div className="flex flex-col gap-2 w-full mt-4">
                      {[
                        { icon: ScanLine, label: "Scan a meal" },
                        { icon: UtensilsCrossed, label: "Explore recipes" },
                        { icon: MessageCircle, label: "Ask Healthify" },
                      ].map(({ icon: Icon, label }) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 px-4 py-3 bg-surface-elevated rounded-xl"
                        >
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-fg-secondary text-sm">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Glow effect behind phone */}
                <div className="absolute -inset-8 bg-primary/10 rounded-full blur-3xl -z-10" />
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </div>
    </section>
  );
}
