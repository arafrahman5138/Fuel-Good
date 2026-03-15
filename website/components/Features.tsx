import { AnimateOnScroll } from "./AnimateOnScroll";
import { ScanLine, CalendarDays, BookOpen, MessageCircle } from "lucide-react";

const FEATURES = [
  {
    icon: ScanLine,
    title: "AI Meal Scanning",
    description:
      "Point your camera at any meal or nutrition label for instant whole-food feedback and ingredient analysis.",
    gradient: "from-primary to-emerald-400",
  },
  {
    icon: CalendarDays,
    title: "Smart Meal Plans",
    description:
      "Get personalized weekly meal plans tailored to your taste preferences, dietary needs, and time constraints.",
    gradient: "from-cyan-400 to-blue-500",
  },
  {
    icon: BookOpen,
    title: "Recipe Library",
    description:
      "Browse 200+ whole-food recipes across 17 cuisines, with nutrition data and step-by-step cook mode.",
    gradient: "from-accent to-amber-400",
  },
  {
    icon: MessageCircle,
    title: "AI Wellness Coach",
    description:
      "Chat with Healthify to transform any dish into a whole-food version, get recipe ideas, and nutrition guidance.",
    gradient: "from-violet-400 to-purple-500",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-6xl mx-auto px-6">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Everything you need to{" "}
              <span className="text-primary">eat better</span>
            </h2>
            <p className="text-fg-secondary text-lg max-w-2xl mx-auto">
              Powerful AI tools and curated whole-food content to make
              healthier eating effortless.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((feature, i) => (
            <AnimateOnScroll key={feature.title} delay={i * 100}>
              <div className="group p-6 sm:p-8 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all duration-300 h-full">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-fg">
                  {feature.title}
                </h3>
                <p className="text-fg-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
