# CalculaConfia Frontend (Guia Atualizado)

## Visão Geral
- Aplicação Next.js (App Router) com TypeScript.
- Landing page em `/` com modal de autenticação, card de compra e CTAs.
- Plataforma protegida em `/platform`, que carrega a calculadora dinâmica.
- Autenticação baseada em cookie HTTP-only (`/login` gera `access_token`), gerenciada pelo `AuthContext`.
- Integração Mercado Pago Checkout Pro (PIX) via SDK oficial (`window.MercadoPago`).

## Stack
- Next.js 14 + React 18
- React Query (mutations auxiliares) + Context API (`AuthProvider`)
- Axios (instância em `src/lib/api.ts` com `withCredentials: true`)
- TailwindCSS + componentes utilitários próprios
- Swiper (hero), Flatpickr/IMask (calculadora)

## Estrutura Principal
- `src/app/layout.tsx`: registra provedores, carrega fontes e scripts (Mercado Pago + gradient).
- `src/app/page.tsx`: landing page, controle de login, compra e redirecionamentos automáticos.
- `src/app/platform/page.tsx`: encapsula `Calculator` (lazy, client-only).
- `src/components/AuthModal.tsx`: login/registro/verificação.
- `src/components/Calculator.tsx`: fluxo completo da plataforma (cadastro de contas, cálculo, timeline, resultado).
- `src/contexts/AuthContext.tsx`: sessão (login/logout/refresh) e exposição do usuário atual.
- `src/lib/api.ts`: cliente HTTP com helpers (`login`, `logout`, `getMe`, `createOrder`, `getCreditsHistory`, etc.).

## Autenticação e Sessão
- `AuthProvider` chama `getMe()` na montagem para recuperar o usuário com base no cookie.
- `AuthModal` lida com:
  - Registro (`/register`) + envio e verificação de código (`/auth/send-verification-code`, `/auth/verify-account`).
  - Login (`/login` – formulário URL-encoded) com feedback visual.
- Após login, o `AuthContext` chama `refresh()` (`GET /me`) e atualiza `user`.
- A landing page monitora `user` com helper `extractCreditsFromUser` + `inferPurchaseFromUser`:
  - Se detectar créditos > 0 ou qualquer sinal de compra (ex.: `referral_code`, flags booleanas), redireciona imediatamente para `/platform`.
  - Caso contrário, faz uma chamada única a `/credits/history` para confirmar ausência de compras. Se não houver histórico, abre o card de compra (apenas uma vez por login).
- Logout (`/logout`) é exposto no FAB de sessão e limpa os estados locais.
- O cookie mantém a sessão ativa ao navegar entre landing e plataforma.

## Fluxo de Pagamento e Créditos
- Card de compra (`Comprar créditos`) dispara `POST /payments/create-order` via `createOrderMutation`.
- Sucesso na criação da ordem:
  - Instancia o SDK do Mercado Pago (`mp.checkout`) com `preference_id` quando disponível.
  - Inicia `startBalancePolling`, que chama `refresh()` a cada 4s por até 2 minutos.
  - Exibe status informando que o redirecionamento será automático após aprovação.
- Botão “Já paguei, verificar saldo” também dispara `refresh()` + reinicia o polling.
- Assim que `refresh()` retorna créditos > 0, a landing fecha modais, interrompe o polling e redireciona automaticamente para `/platform`.
- Se o webhook não creditar em 2 minutos, o modal de status informa que o pagamento ainda está em processamento (sem quebrar o fluxo, o usuário pode tentar novamente).

## Plataforma (`/platform`)
- Carrega `Calculator` dinamicamente (SSR desligado) para evitar dependências do navegador no build.
- `Calculator` gerencia toda a jornada de cálculo: seleção de faturas (até 12), máscaras e calendário, timeline de processamento e resultado final.
- Consumo de crédito/cálculo acontece via `POST /calcular`. O componente exibe mensagens amigáveis para erros ou saldo insuficiente.

## HTTP Helpers (`src/lib/api.ts`)
- Axios com `baseURL` definido por `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_API_BASE_URL` (fallback para produção ou localhost).
- Funções relevantes:
  - `login`, `logout`, `getMe`, `register`, `sendVerificationCode`, `verifyAccount`.
  - `createOrder` (pagamento), `calcular` (plataforma).
  - `getCreditsHistory` (novo) e `getCreditsBalance` (exposto para possíveis usos futuros).
  - `extractErrorMessage` padroniza mensagens das respostas da API.

## Variáveis de Ambiente (frontend)
- `NEXT_PUBLIC_API_URL` ou `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- (opcional) `NEXT_PUBLIC_ENV`, `NEXT_PUBLIC_PUBLIC_BASE_URL`

## Comportamento de UI/UX
- Modal de status de pagamento mostra mensagens de erro, info e sucesso utilizando ícones do Lucide.
- O card de compra só é aberto automaticamente uma vez por login; o usuário pode fechá-lo e utilizar os CTAs para reabrir.
- FAB de sessão (canto inferior esquerdo) exibe nome/logado e permite logout sem sair da landing.
- Responsividade calibrada para mobile/desktop; seções com animações otimizadas para `prefers-reduced-motion`.

## Boas Práticas
- Sempre usar `useAuth()` para acessar sessão e métodos `login/logout/refresh`.
- Para novas chamadas autenticadas, reutilizar a instância `api` (cookies já incluídos).
- Se adicionar novos fluxos de pagamento, respeitar o polling centralizado na landing (evitar duplicidade).
- Ao criar novos componentes client-side que dependam de autenticação, garantir que rodem dentro de `AppProviders`.