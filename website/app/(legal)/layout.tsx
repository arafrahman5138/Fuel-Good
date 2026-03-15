import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-6">
          <article className="[&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:text-fg [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:text-fg-secondary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mb-4 [&_li]:text-fg-secondary [&_li]:leading-relaxed [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary-light [&_a]:transition-colors [&_strong]:text-fg">
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
