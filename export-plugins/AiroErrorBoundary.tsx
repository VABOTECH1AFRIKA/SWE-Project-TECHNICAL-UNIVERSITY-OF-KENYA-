import type { ReactNode } from 'react';

interface AiroErrorBoundaryProps {
  children: ReactNode;
  // captureGlobalErrors is accepted to keep the call-site signature compatible
  // with the real dev-tools AiroErrorBoundary; global error listeners are
  // intentionally not set up in exported standalone projects.
  captureGlobalErrors?: boolean;
}

/** Standalone passthrough — AAB dev-tools error UI is not bundled in exports. */
export default function AiroErrorBoundary({ children }: AiroErrorBoundaryProps) {
  return <>{children}</>;
}
