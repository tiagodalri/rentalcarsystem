Auditoria de qualidade — apenas diagnóstico, nada foi editado. Cada item traz arquivo(s), problema e severidade.

## 1. Sobras da marca Zeus (crítico para demonstração)

- **`src/components/WhyZeusSection.tsx`** + `src/i18n/translations.ts` (chaves `whyZeus.*` nos 6 idiomas): o nome do componente e todas as chaves de i18n ainda são `whyZeus`. O texto exibido já está como "Sua Marca", mas o identificador aparece em stack traces, no React DevTools e em qualquer print de código. **Médio.**
- **`src/pages/admin/AdminInspectionReport.tsx:15,437`**: `import zeusLogo from "@/assets/zeus-logo-hd.png"` e `<img src={zeusLogo} alt="Sua Marca" />` — o PDF de vistoria continua carregando o logotipo antigo da Zeus (arquivo real de 482 KB). **Crítico** (o PDF gerado mostra a marca antiga).
- **`src/assets/zeus-logo-*.png`** (8 arquivos): `zeus-logo-hd.png`, `-hd-opaque`, `-light`, `-mark`, `-new`, `-ultra`, `zeus-logo.png`, `zeus-z-mark.png`. Só `zeus-logo-hd.png` está referenciado (item acima); o restante é lixo. **Baixo.**
- **`src/components/inspection/CarRealisticViewer.tsx:78-200`**: helpers `makeZeusPlateTexture`, nomes de mesh `__zeus_plate__`, `__zeus_badge__`, `__zeus_rear_overlay__`, e textos desenhados no canvas `SUA MARCA · ORLANDO FL`. Nome interno é ok, mas o overlay 3D mistura "SUA MARCA" com "ORLANDO FL" hardcoded. **Médio.**
- **`src/components/admin/ai-studio/BrainAccessGate.tsx:94`**: título grande visível na UI `ZEUS BRAIN`. **Crítico** (aparece em tela para prospect).
- **`src/lib/emails/sendZeusEmail.ts`**: nome do arquivo/função + `console.error("[zeus-email] ...")` em vários lugares. Só logs/nomes internos. **Baixo.**
- **`src/hooks/useVehicleZeusContext.ts`** + `src/components/admin/live/tabs/DetailsTab.tsx`: hook e tipo `ZeusBooking` seguem com esse nome. Interno. **Baixo.**
- **`src/pages/admin/AdminPainel.tsx:93,96,361`, `AdminInspection.tsx:331,416,513`, `Checkout.tsx:46,167`, `InstallPrompt.tsx:9`, `BookingWizard.tsx:41`, `MapControlsPanel.tsx:22`, `CarRealisticViewer.tsx:459`, `PublicInspection.tsx:269`**: chaves de `localStorage`/`sessionStorage` prefixadas com `zeus_...`/`zeus:...`/`zeus.*`. Não é visível ao usuário. **Baixo** (mas cuidado: renomear invalida drafts salvos em navegadores existentes).
- **`src/pages/admin/AdminBookings.tsx:877`** e outros PDFs: strings `"SUA MARCA"` em caps são intencionais (é o nome usado nos PDFs whitelabel), sem problema.

## 2. Sobras Orlando / brasileiros / Bruno / Corvette específicas

A memória proíbe qualquer coisa "Orlando-specific" no whitelabel, mas o site público ainda está cheio disso:

- **`src/i18n/translations.ts`** (pt, en, es, it, de, fr): descrição da empresa, tagline, `howItWorks.step3Desc`, `testimonials.t3–t6Text` (menções a Bruno, Corvette, Disney), `tagline: "Sua Marca. Concierge premium para brasileiros em Orlando."`, blocos `whyZeus.*`, `vehicleDetails["Corvette Stingray C8"]` etc. Textos aparecem na home, testimonials e vitrine. **Crítico** (o prospect vai ler "brasileiros em Orlando" e "atendimento do Bruno").
- **`src/pages/VehicleDetail.tsx:173,174,356,377,384`**: SEO title/description e blocos "Aeroporto de Orlando (MCO)", "Um concierge da Sua Marca…". **Crítico.**
- **`src/pages/AboutUs.tsx:55,56,109,127,130,188`**: página Sobre inteira falando "brasileiros em Orlando". **Crítico.**
- **`src/pages/Contato.tsx:77`**: meta description menciona Orlando. **Médio.**
- **`src/pages/admin/AdminContractTemplate.tsx:87,88`**: preview do contrato usa `Orlando International Airport (MCO)` como local. Interno, mas aparece na preview. **Baixo.**
- **`public/llms.txt:3,6`**: descrição pública ainda fala "Orlando", "brasileiros", "Disney", frota "Corvette, Mustang…". **Crítico** para SEO/AI crawlers.
- **`public/sitemap.xml:172,178`**: URLs `/veiculo/Corvette%20Stingray%20C8` e `/reserva/...`. Não é branding específico da Zeus, mas depende se essas rotas ainda existem/tem sentido. **Baixo.**

## 3. Telefones/WhatsApp inconsistentes (crítico)

A memória diz "NUNCA reintroduzir WhatsApp real (+1 689-298-1754)" e o placeholder oficial é `+1 555-000-0000`.

- **Ainda com o número real da Zeus (`16892981754`)**:
  - `src/pages/SearchResults.tsx:173`
  - `src/pages/BookingDetails.tsx:470`
  - `src/pages/BookingConfirmed.tsx:172`
- **Com placeholder correto (`15550000000`)**:
  - `src/components/WhatsAppBubble.tsx:3`
  - `src/components/Footer.tsx:21`
  - `src/pages/BookingDetailClient.tsx:425`

**Crítico** — três páginas do fluxo público/cliente ainda mandam o prospect para o WhatsApp real da Zeus.

## 4. E-mails transacionais indo para conta pessoal

- **`src/lib/emails/sendZeusEmail.ts:6`**: `const TEST_RECIPIENT = "tiagodalri1@live.com"` e `recipientEmail: opts.recipientEmail ?? TEST_RECIPIENT`. Todos os disparos (`booking-confirmed`, `booking-updated`, `booking-cancelled`, `inspection-checkin`, `inspection-checkout`) chamados de `AdminBookings.tsx`, `BookingWizard.tsx` e `AdminInspection.tsx` **não passam `recipientEmail`** — então cada reserva feita numa demo dispara e-mail para uma caixa pessoal. **Crítico** (privacidade + confusão em demo).

## 5. Bugs recorrentes das conversas anteriores

- **Rotas "picadas" no mapa (Bouncie)**: `src/hooks/useTripTrail.tsx` já faz snapping (comentário linha 26 "no more cutting through…") e `src/hooks/useTripReplay.ts:268-364` faz downsample/interpolação. Aparentemente resolvido. **Sem ação** — vale confirmar em `AdminLive` com uma viagem real.
- **Timeout na geração de frota fictícia do Tour Guiado**: `src/components/admin/guided-tour/GuidedTour.tsx:80-108` implementa retry 3× com backoff simples de 600 ms sobre `demo_start_presentation`. Aparentemente resolvido, mas o retry só espera 600 ms fixos — se o problema for cold-start >2 s do Postgres, ainda pode falhar. **Médio** (monitorar).
- **Compartilhamento WhatsApp de vistoria**: `src/components/admin/ShareWhatsAppInspectionButton.tsx` — no fluxo mobile o botão dispara download automático das fotos em background enquanto redireciona o usuário via `window.location.href`. Em iOS Safari isso costuma bloquear os downloads porque a página perdeu foco; em Android o comportamento é irregular. Além disso, no wa.me sem número (`https://wa.me/?text=...`) o iOS às vezes abre o "escolher contato" e some com o texto. **Médio** — o fix atual funciona no desktop mas segue frágil em mobile.
- **Clientes duplicados vindos do Turo**: não encontrei nenhuma lógica de dedupe de customers em `src/lib/turo/*` nem nas edge functions. `csvParser.ts` só dedupa por `reservationId`, e não vi nada como `findOrCreateCustomer` por e-mail/telefone. **Crítico** — o bug provavelmente continua.

## 6. Fluxo público (o que um prospect vê)

- **`src/pages/NotFound.tsx:15`**: `"Oops! Page not found"` em inglês misturado com resto pt-BR. **Baixo.**
- **`src/pages/VehicleDetail.tsx`, `AboutUs.tsx`, `Contato.tsx`, `Frota.tsx`, `Checkout.tsx`, `Index.tsx`, `SearchResults.tsx`, `BookingConfirmed.tsx`**: nenhum problema técnico grave encontrado além dos listados acima (Orlando + WhatsApp). Todos os imports de imagem de frota apontam para assets existentes (`src/data/vehicleImages.ts`).
- **`src/components/WhyZeusSection.tsx`** ainda é renderizado na home via `Index.tsx` — bloco chamado internamente de "Zeus" mas texto ok.
- **`en-US` locale**: várias tabelas admin (`TuroDiffTable.tsx`, `MobileBookingCard.tsx`, `FleetCalendar/BookingBar.tsx`, `TransactionsTab.tsx`, `OverviewTab.tsx`) usam `toLocaleString("en-US")` para formatar USD. Consistente com moeda USD, ok. **Sem ação.**

## 7. Capitalização e gramática "Sua Marca"

- `src/pages/VehicleDetail.tsx`, `AboutUs.tsx`, `Contato.tsx`, `AdminBookingDetail.tsx`, `Unsubscribe.tsx`, `BookingDetailClient.tsx`, `AdminTutorials.tsx`, `AdminPainel.tsx`, `lib/whatsapp.ts`: usam construções como "a Sua Marca", "da Sua Marca", "à Sua Marca". Gramaticalmente estranhas — soam como "a Your Brand". Provavelmente resultado do replace automático "Rental Studio" → "Sua Marca". **Médio** (transparente que é whitelabel, mas fica pobre em demo).
- **`src/i18n/translations.ts`**: `"Why Sua Marca?"`, `"¿Por qué Sua Marca?"`, `"Warum Sua Marca?"`, `"Pourquoi Sua Marca ?"` — mesma questão em todos os idiomas, o placeholder "Sua Marca" aparece cru em textos EN/ES/IT/DE/FR. **Médio.**

## 8. Outros pontos

- **`src/pages/admin/AdminContractTemplate.tsx:216`**: aviso visível "A pré-visualização usa dados fictícios apenas para demonstrar o layout." A memória do usuário mandou "remover qualquer texto que apareça NA TELA dizendo que os dados são fictícios/simulados/demonstração" no fluxo do tour. Está no admin (não no tour), mas o usuário pode ter querido isso globalmente. **Baixo** — vale confirmar.
- **`src/components/demo/DemoBadge.tsx`**: componente com `aria-label="Ambiente de demonstração"`. Se estiver montado na UI pública, viola a mesma regra. Precisa checar onde é usado. **Baixo.**
- **`src/pages/NotFound.tsx`** também não tem `<Seo>` — 404 aparece com o title default do index.html.

## 9. O que NÃO encontrei de problema

- `public/brand-mark.png` existe (verificado).
- Nenhum `TODO`/`FIXME`/`lorem ipsum` esquecido em código.
- Nenhum `<img src="">` vazio.
- Nenhuma rota referenciada em `<Link>` sem entrada em `App.tsx` (varredura superficial).
- `WhatsAppBubble.tsx` e `Footer.tsx` já usam o placeholder `+1 555-000-0000`.

---

**Ranking sugerido para atacar depois:**
1. Números reais de WhatsApp em 3 páginas públicas (§3) + TEST_RECIPIENT (§4) — vazamento de dados pessoais + confusão em demo.
2. Textos "Orlando/Bruno/Corvette/brasileiros" em `translations.ts`, `AboutUs.tsx`, `VehicleDetail.tsx`, `Contato.tsx`, `llms.txt` (§2).
3. `ZEUS BRAIN` visível no `BrainAccessGate` + `zeus-logo-hd.png` no PDF de vistoria (§1).
4. Dedupe de customers no import Turo (§5).
5. Frase "a Sua Marca" reescrita para soar natural (§7).
6. Limpeza de assets `zeus-logo-*.png` órfãos, rename de hook/tipo/localStorage keys (§1 baixo).

Diagnóstico apenas — nenhuma alteração feita.