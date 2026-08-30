import { useState, type KeyboardEvent } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailTagInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  /** Sugerencias de correos frecuentes (autocompletado simple, sin librerías). */
  suggestions?: string[];
}

/**
 * Campo "de etiquetas" para destinatarios de correo: el usuario escribe o
 * pega direcciones y presiona Enter, coma o espacio para convertirlas en
 * chips. No requiere que sepa nada de SMTP ni de Outlook: solo escribe el
 * correo. La validación de formato ocurre aquí mismo (feedback inmediato) y
 * se repite en el backend antes de encolar el envío.
 */
export function EmailTagInput({ value, onChange, placeholder, suggestions = [] }: EmailTagInputProps) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const candidatos = raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (candidatos.length === 0) return;

    const nuevos = candidatos.filter((email) => !value.includes(email));
    if (nuevos.length > 0) onChange([...value, ...nuevos]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (/[,;\s]/.test(pasted)) {
      e.preventDefault();
      commit(pasted);
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const opcionesVisibles = suggestions.filter(
    (s) => s.toLowerCase().includes(draft.toLowerCase()) && !value.includes(s) && draft.length > 0
  );

  return (
    <div>
      <div className="tag-input field-glow" onClick={() => document.getElementById("email-tag-input-field")?.focus()}>
        {value.map((email, i) => {
          const valido = EMAIL_REGEX.test(email);
          return (
            <span key={`${email}-${i}`} className={`tag-pill${valido ? "" : " invalid"}`} title={valido ? email : "Formato inválido"}>
              {email}
              <button type="button" onClick={() => removeAt(i)} aria-label={`Quitar ${email}`}>
                ×
              </button>
            </span>
          );
        })}
        <input
          id="email-tag-input-field"
          type="text"
          value={draft}
          placeholder={value.length === 0 ? placeholder ?? "Escribe un correo y presiona Enter…" : ""}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>
      {opcionesVisibles.length > 0 && (
        <div className="hint" style={{ marginTop: 4 }}>
          Sugerencias:{" "}
          {opcionesVisibles.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commit(s)}
              style={{ border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", marginRight: 8, padding: 0 }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
