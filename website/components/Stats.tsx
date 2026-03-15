"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Globe, Sparkles } from "lucide-react";

const STATS = [
  { icon: BookOpen, value: 200, suffix: "+", label: "Whole-food recipes" },
  { icon: Globe, value: 17, suffix: "", label: "Global cuisines" },
  { icon: Sparkles, value: 24, suffix: "/7", label: "AI wellness coach" },
];

function Counter({
  target,
  suffix,
}: {
  target: number;
  suffix: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const start = performance.now();

          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="py-20 md:py-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {STATS.map((stat, i) => (
            <AnimateOnScroll key={stat.label} delay={i * 100}>
              <div className="flex flex-col items-center text-center p-6">
                <stat.icon className="w-6 h-6 text-primary mb-3" />
                <div className="text-4xl sm:text-5xl font-black text-fg mb-2">
                  <Counter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-fg-secondary text-sm font-medium">
                  {stat.label}
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
