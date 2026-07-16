# GoDrive — Sistema de Locação de Veículos

Sistema completo de gestão de locação de veículos premium em Orlando, FL.

## Stack

- Frontend: Vite + React 18 + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase (Postgres + Auth + Storage + Edge Functions)
- Pagamentos: Stripe (USD)
- Email: Resend (4 triggers transacionais)
- Mapa: Leaflet
- PDF: jsPDF

## Módulos

- Site institucional + Motor de reservas
- Portal do Cliente (autenticado via Supabase Auth)
- Painel Administrativo (4 perfis: admin, finance, operations, support)

## Como rodar localmente

1. Clonar o repositório
2. `npm install`
3. Copiar `.env.example` para `.env` e preencher
4. `npm run dev`

## Variáveis de ambiente

Ver `.env.example` para a lista completa das variáveis necessárias.

## Estrutura

```
src/
├── components/     # Componentes reutilizáveis (UI, booking, admin, client)
├── data/           # Dados estáticos (veículos, planos, imagens)
├── hooks/          # Custom hooks (auth, bookings, vehicles)
├── i18n/           # Internacionalização e contextos (idioma, moeda, tema)
├── integrations/   # Cliente Supabase (auto-gerado)
├── lib/            # Utilitários e adapters
├── pages/          # Páginas públicas, cliente e admin
└── utils/          # Helpers (PDF, etc.)
supabase/
├── functions/      # Edge Functions (email, checkout, cron)
└── migrations/     # Migrações SQL
```
