import { useEffect } from "react";
import FrotaInteligente from "@/components/admin/ai-studio/FrotaInteligente";

/**
 * Rota standalone da Frota Inteligente (acessada via sidebar).
 * Aplica o mesmo shell visual (fundo bege/dourado) usado pelo overlay do Brain,
 * porém sem gate — acesso direto pela navegação lateral.
 *
 * O fundo bege é pintado full-bleed cobrindo header + utilitários + main,
 * pra não deixar aquela "faixa branca" no topo entre o tab-bar e o conteúdo.
 */
const BEIGE_BG =
  "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)";

export default function AdminFrotaInteligente() {
  useEffect(() => {
    document.body.classList.add("frota-inteligente-route");
    return () => {
      document.body.classList.remove("frota-inteligente-route");
    };
  }, []);

  return (
    <>
      {/* Overrides globais só enquanto essa rota está montada */}
      <style>{`
        body.frota-inteligente-route .admin-shell > div > header,
        body.frota-inteligente-route .admin-shell > div > .hidden.lg\\:flex,
        body.frota-inteligente-route .admin-shell > div > main {
          background: ${BEIGE_BG} !important;
          border-color: transparent !important;
        }
        body.frota-inteligente-route .admin-shell > div > header {
          box-shadow: none !important;
          backdrop-filter: none !important;
        }
      `}</style>
      <div className="min-h-full -mx-4 -mt-4 lg:-mx-8 lg:-mt-8 px-4 pt-4 lg:px-8 lg:pt-8" style={{ background: BEIGE_BG }}>
        <FrotaInteligente />
      </div>
    </>
  );
}
