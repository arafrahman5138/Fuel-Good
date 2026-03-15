import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/support", label: "Support" },
];

export function Footer() {
  return (
    <footer className="border-t border-border py-12 bg-surface">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            <span className="text-fg font-semibold tracking-tight">
              Fuel Good
            </span>
          </div>

          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-fg-tertiary hover:text-fg-secondary transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="text-fg-tertiary text-sm">
            <a
              href="mailto:support@fuelgood.com"
              className="hover:text-fg-secondary transition-colors"
            >
              support@fuelgood.com
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-fg-tertiary text-xs">
          &copy; {new Date().getFullYear()} Fuel Good. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
