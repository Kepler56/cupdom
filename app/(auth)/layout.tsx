import type { ReactNode } from 'react';

/** Bare centered shell for the unauthenticated auth pages (no sidebar/topbar). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-input bg-primary text-sm font-bold text-primary-contrast">
            C
          </span>
          <span className="text-lg font-semibold text-text">Cupdom</span>
        </div>
        {children}
      </div>
    </main>
  );
}
