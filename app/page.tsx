import { redirect } from 'next/navigation';

// Root just forwards into the app; the middleware sends unauthenticated users to /login.
export default function Page() {
  redirect('/apercu');
}
