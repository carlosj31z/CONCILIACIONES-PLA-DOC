import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * Textarea que crece con el contenido en vez de quedar con su propio scroll
 * interno: al escribir más de lo que entra en el recuadro, la altura se
 * ajusta sola para que todo el texto quede a la vista. El piso lo sigue
 * poniendo el min-height de `.form-field textarea` en el CSS, así que nunca
 * queda más chico que antes — solo crece cuando hace falta.
 */
export function AutoResizeTextarea({ value, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={className ? `textarea-auto ${className}` : "textarea-auto"}
      {...props}
    />
  );
}
