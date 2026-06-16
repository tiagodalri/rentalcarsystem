/**
 * Haptic feedback — vibração curta em ações importantes no mobile.
 *
 * Wave 2 (UX premium): sensação "app nativo". A API navigator.vibrate é
 * suportada em Android (Chrome/Edge/Samsung), e silenciosamente ignorada
 * em iOS Safari — sem erro, sem alerta. Em desktop também é no-op.
 *
 * Padrões de duração (ms):
 *  - tick:    10  → toques leves (toggle, switch, segment)
 *  - tap:     20  → ação primária (botão, salvar)
 *  - success: [12, 60, 12]  → confirmação positiva (reserva criada)
 *  - warn:    [40, 40, 40]  → atenção (erro de validação)
 *  - error:   80  → falha
 *
 * Uso:
 *   import { haptic } from "@/lib/haptic";
 *   haptic.success();
 */

type Pattern = number | number[];

function vibrate(p: Pattern) {
  try {
    if (typeof navigator === "undefined") return;
    const nav: any = navigator;
    if (typeof nav.vibrate !== "function") return;
    nav.vibrate(p);
  } catch (_) {
    // ignore
  }
}

export const haptic = {
  tick: () => vibrate(10),
  tap: () => vibrate(20),
  success: () => vibrate([12, 60, 12]),
  warn: () => vibrate([40, 40, 40]),
  error: () => vibrate(80),
};
