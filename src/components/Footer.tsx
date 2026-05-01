import { Link } from "react-router-dom";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card py-6 mt-auto">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} Pixel Pulse. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link to="/cookies" className="hover:text-foreground transition-colors">
            Cookie Policy
          </Link>
          <Link to="/guidelines" className="hover:text-foreground transition-colors">
            Content Guidelines
          </Link>
        </nav>
      </div>
    </footer>
  );
}
