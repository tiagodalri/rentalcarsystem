import FrotaInteligente from "@/components/admin/ai-studio/FrotaInteligente";

/**
 * Rota standalone da Frota Inteligente (acessada via sidebar).
 * Aplica o mesmo shell visual (fundo bege/dourado) usado pelo overlay do Brain,
 * porém sem gate — acesso direto pela navegação lateral.
 */
export default function AdminFrotaInteligente() {
  return (
    <div
      className="min-h-full"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(154,122,58,0.10), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)",
      }}
    >
      <FrotaInteligente />
    </div>
  );
}
