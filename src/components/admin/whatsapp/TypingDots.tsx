/**
 * Small animated 3-dot indicator used for "typing…" presence hints.
 * Uses Tailwind's built-in animate-bounce with staggered delays.
 */
export function TypingDots({
  className = "",
  dotClassName = "bg-primary",
}: {
  className?: string;
  dotClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex items-end gap-0.5 h-3 ${className}`}
    >
      <span
        className={`w-1 h-1 rounded-full animate-bounce ${dotClassName}`}
        style={{ animationDelay: "0ms", animationDuration: "900ms" }}
      />
      <span
        className={`w-1 h-1 rounded-full animate-bounce ${dotClassName}`}
        style={{ animationDelay: "150ms", animationDuration: "900ms" }}
      />
      <span
        className={`w-1 h-1 rounded-full animate-bounce ${dotClassName}`}
        style={{ animationDelay: "300ms", animationDuration: "900ms" }}
      />
    </span>
  );
}
