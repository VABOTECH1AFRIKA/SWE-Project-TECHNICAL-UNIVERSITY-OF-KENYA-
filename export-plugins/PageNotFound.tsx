import { Link } from 'react-router-dom';

/** Standalone 404 page — AAB dev-tools PageNotFound is not bundled in exports. */
export default function PageNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you requested does not exist.</p>
      <Link className="mt-4 underline" to="/">
        Go home
      </Link>
    </main>
  );
}
