import { AnimateOnScroll } from "./AnimateOnScroll";
import { AppStoreBadge } from "./Hero";

export function FinalCTA() {
  return (
    <section
      id="download"
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Background accents */}
      <div className="absolute inset-0 hero-gradient-subtle" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <AnimateOnScroll>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
            Ready to{" "}
            <span className="bg-gradient-to-r from-primary via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              fuel your best self
            </span>
            ?
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={100}>
          <p className="text-fg-secondary text-lg sm:text-xl mb-10 max-w-xl mx-auto">
            Join thousands choosing whole-food nutrition. Start your free
            7-day trial today — no commitment required.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={200}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <AppStoreBadge />
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
