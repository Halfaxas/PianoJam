import { useToastStore } from "../state/toastStore";

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    // Always mounted so screen readers announce toasts as they arrive.
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
          title="Dismiss"
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
