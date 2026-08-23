import { Link } from 'react-router';

/**
 * Footer component for website
 *
 * A simple, customizable footer with copyright and links.
 * This component is designed to be directly edited by the AI agent
 * to match the specific needs of each website.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © {currentYear} App. All rights reserved.
          </div>

          <nav className="flex gap-6">
            <Link
              to="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
