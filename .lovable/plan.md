# Plano: Cérebro Artificial Zeus — Painel IA Premium

Vou transformar o atual Painel IA em um centro de inteligência que pouquíssimos empresários do mundo possuem, mantendo a linguagem 100% clara (sem siglas ou jargão).

## O que vou adicionar

### 1. Novas "lentes" do cérebro (abas / seções)

**a) Hoje na sua frota** (resumo executivo do dia)
- Quanto você ganhou hoje, quanto vai ganhar amanhã (projeção)
- Quais carros estão rodando agora e quanto cada um está gerando
- Alertas urgentes (carros parados há muito tempo, devoluções atrasadas, manutenções vencidas)

**b) Radar de Oportunidades Perdidas**
- Dias do mês em que você poderia ter alugado mas não alugou (e quanto deixou na mesa)
- Reservas que entraram em contato e desistiram — padrões por preço, data, carro
- Sugestão: "Se você tivesse baixado o preço em X% nestes 3 dias, teria faturado +$Y"

**c) Termômetro de cada cliente**
- Top 10 clientes mais valiosos (quanto cada um já gastou, frequência)
- Clientes em risco de sumir (últimos 90/180 dias sem voltar)
- Clientes "ouro" prontos para upgrade (perfil + histórico)

**d) Saúde Financeira Real**
- Lucro real por carro/mês (receita – manutenção – seguro – depreciação estimada)
- Ponto de equilíbrio: quantos dias por mês cada carro precisa rodar pra dar lucro
- Carros "vampiros": consomem mais do que devolvem

**e) Previsão dos próximos 30 dias**
- Receita esperada com base em reservas confirmadas + projeção histórica
- Picos e vales previstos (semanas fortes/fracas)
- Recomendação de quando aumentar/baixar preço

**f) Conselhos do Cérebro (decisões da semana)**
- 3 a 5 ações concretas que a IA recomenda fazer essa semana
- Cada ação com: impacto estimado em receita, esforço, prioridade
- Ex: "Suba o preço da Tiguan branca em $15/dia entre 12 e 19 de julho — ganho estimado +$210"

### 2. Métricas únicas que pouquíssimos têm

- **Receita por dólar investido na frota** (retorno real do capital)
- **Velocidade de pagamento da frota** (em quantos meses cada carro se paga)
- **Índice de fidelidade** (% de clientes que voltam)
- **Eficiência por dia da semana** (que dia rende mais por carro)
- **Curva de aprendizado de preço** (a IA mostra se você está cobrando barato/caro vs demanda)

### 3. Mudanças visuais

- Header com "última atualização" e botão "atualizar análise"
- Cards de "Revelação da IA" maiores e com narrativa storytelling
- Cada insight com um botão "entendi" / "agir agora" pra rastrear engajamento

## Arquivos

- `src/pages/admin/AiPainel.tsx` — adicionar novas abas/seções e cálculos
- `supabase/functions/intelligence-summary/index.ts` — enriquecer prompt e payload com dados de manutenção, gastos, comportamento de cliente; gerar "Conselhos da Semana" estruturados
- Possivelmente um novo helper `src/lib/aiBrainAnalytics.ts` para cálculos pesados (Pareto, RFM simplificado, projeção)

## O que NÃO vou fazer

- Não vou mudar o resto do admin
- Não vou usar siglas técnicas (nada de "ROI", "RFM", "LTV", "Pareto" na UI — só nomes claros em português)
- Não vou criar dependências novas pesadas

Confirma que posso seguir?
