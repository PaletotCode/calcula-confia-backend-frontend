# Infraestrutura e Migração CalculaConfia

Este documento consolida as decisões recentes para manter o domínio `calculaconfia.com.br` servindo o frontend Next.js e a API FastAPI hospedada no Railway por trás do Worker da Cloudflare.

## Visão Geral

- **Domínio**: `calculaconfia.com.br` administrado pela Cloudflare.
- **Frontend**: Next.js rodando na Vercel (ou outro host estático) acessado diretamente por `https://calculaconfia.com.br`.
- **Backend**: FastAPI + Celery + Redis no Railway (`https://calculaconfia-production.up.railway.app`).
- **Banco de dados**: PostgreSQL e Redis oferecidos pelo Railway.
- **Autenticação**: Cookie HttpOnly `access_token` (`Domain=.calculaconfia.com.br`, `Path=/`, `SameSite=None`, `Secure`).

## Worker Cloudflare (Proxy da API)

O Worker intercepta requisições `https://calculaconfia.com.br/api/*` e encaminha para o Railway mantendo o `Host` original. Isso garante que a FastAPI valide o `TrustedHost` corretamente e emita o cookie para o domínio principal.

Trecho simplificado:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      url.hostname = "calculaconfia-production.up.railway.app";
      return fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }
    return fetch(request);
  },
};
```

## Variáveis no Railway (API FastAPI)

| Nome | Valor de produção | Observações |
| ---- | ----------------- | ----------- |
| `PUBLIC_BASE_URL` | `https://calculaconfia.com.br` | Usado em e-mails, webhook Mercado Pago e geração de URLs absolutas. |
| `FRONTEND_URL` | `https://calculaconfia.com.br` | Referência para CORS e templates de e-mail. |
| `EXTRA_CORS_ORIGINS` | `https://calculaconfia.com.br` | Complementa a lista padrão; alimenta o `CORSMiddleware`. |
| `COOKIE_DOMAIN` | `.calculaconfia.com.br` | Garante que o cookie seja aceito pelo domínio raiz e subdomínios. |
| `ALLOWED_HOSTS` | `calculaconfia.com.br,www.calculaconfia.com.br,calculaconfia-production.up.railway.app` | Usado pelo `TrustedHostMiddleware`. |
| `REDIS_URL` / `CELERY_*` | conforme provisionado | Mantêm o worker Celery e cache funcionando. |
| `DATABASE_URL` | URL PostgreSQL do Railway | Principal banco de dados. |

## CORS e TrustedHost

- O `CORSMiddleware` usa `allow_origins` derivado de `FRONTEND_URL` + `EXTRA_CORS_ORIGINS` e `allow_credentials=True`, exigido para trabalhar com cookies cross-site.
- O `TrustedHostMiddleware` aceita `calculaconfia.com.br`, `www.calculaconfia.com.br` e o domínio Railway para saúde interna. O Worker encaminha com `Host: calculaconfia.com.br`, satisfazendo a verificação.

## Cookies e Logout

- Login (`POST /api/v1/login`) gera o cookie `access_token` com `SameSite=None; Secure; Domain=.calculaconfia.com.br; Path=/`.
- Logout (`POST /api/v1/logout`) executa:

  ```python
  @router.post("/logout")
  def logout(response: Response):
      response.delete_cookie(
          "access_token",
          domain=settings.COOKIE_DOMAIN,
          path="/",
      )
      return {"message": "Logged out"}
  ```

- O frontend usa `axios` com `withCredentials` para todas as chamadas autenticadas e o helper [`clearAccessTokenCookie`](../src/lib/auth-cookies.ts) remove o cookie manualmente (cobrindo `www.calculaconfia.com.br`, domínio raiz e `localhost`).

## Passo a passo da migração recente

1. **Cookie cross-site**: definimos `COOKIE_DOMAIN=.calculaconfia.com.br` e passamos para `response.set_cookie` com `SameSite=None; Secure` para suportar o proxy da Cloudflare.
2. **CORS**: removemos o wildcard e usamos `FRONTEND_URL` + `EXTRA_CORS_ORIGINS` para montar `allow_origins`, mantendo `allow_credentials=True`.
3. **TrustedHost**: configuramos `ALLOWED_HOSTS=calculaconfia.com.br,www.calculaconfia.com.br,calculaconfia-production.up.railway.app`.
4. **Worker Cloudflare**: criamos o proxy que encaminha `/api/*` mantendo o `Host` original, eliminando divergências de domínio.
5. **Validação**: com curl e navegador confirmamos que:
   - O login gera `access_token` com `Domain=.calculaconfia.com.br`;
   - `GET /api/v1/me` responde 401 sem cookie e 200 após o login;
   - O middleware do Next.js permite `/platform` apenas autenticado, sem loops.
6. **Logout confiável**: o frontend chama `POST /api/v1/logout`, executa `clearAccessTokenCookie` e redireciona para `/`, impedindo acesso subsequente a `/platform`.

## Checklist de Smoke Tests

- [ ] `curl -I https://calculaconfia.com.br/api/v1/health` retorna 200.
- [ ] Login via landing page cria o cookie `access_token` com o domínio correto (verificar via DevTools > Application > Cookies).
- [ ] Após clicar em **Sair**, o cookie `access_token` desaparece e `/platform` redireciona para `/`.
- [ ] Cloudflare Worker responde com 522? Se sim, validar a URL Railway e credenciais.

## Referências adicionais

- [FastAPI CORS docs](https://fastapi.tiangolo.com/tutorial/cors/)
- [Cloudflare Workers - Request.cf](https://developers.cloudflare.com/workers/runtime-apis/request/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)