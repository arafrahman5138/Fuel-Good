import Link from "next/link";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
];

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-fg font-semibold text-lg tracking-tight">
            Fuel Good
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-fg-secondary hover:text-fg transition-colors text-sm font-medium"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#download"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          Download
        </a>
      </div>
    </header>
  );
}
