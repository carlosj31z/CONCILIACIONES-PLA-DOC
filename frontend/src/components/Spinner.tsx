interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "sm" }: SpinnerProps) {
  return <span className={`spinner spinner-${size}`} role="status" aria-label="Cargando" />;
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="loading-state">
      <Spinner size="md" />
      <span>{label}</span>
    </div>
  );
}
