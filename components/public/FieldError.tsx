// Inline French validation message shown under a lead-form field (Spec 3A, AC-4).
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger-fg">
      {message}
    </p>
  );
}
