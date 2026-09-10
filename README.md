# LumynTCG

Base professionale per una dashboard di collezioni TCG, ispirata ai principali pattern UX di Collectr.

## Avvio

```bash
npm install
cd frontend && npm install
cd ../backend && npm install
cd .. && npm run dev
```

Frontend: `http://localhost:5173` · API: `http://localhost:4000/api/health`

## Struttura

- `frontend/`: React + Vite, dashboard responsive, catalogo, portfolio e modal di aggiunta.
- `backend/`: Express REST API con endpoint cards, portfolio e trade analyzer.
- `database/schema.sql`: schema PostgreSQL per utenti, set, carte, varianti, collezioni e storico prezzi.

## Deploy produzione

### Railway (backend + PostgreSQL)

1. Crea un progetto Railway e aggiungi un servizio PostgreSQL.
2. Collega il repository al servizio backend e imposta **Root Directory** su `backend`.
3. Configura `DATABASE_URL` usando la variabile PostgreSQL di Railway.
4. Configura `JWT_SECRET` con un valore casuale lungo e `FRONTEND_URL` con il dominio Vercel.
5. Aggiungi opzionalmente le credenziali dei provider prezzi.
6. Applica lo schema al database usando il client SQL Railway:

```sql
\i database/schema.sql
\i database/seed.sql
```

Il file [backend/railway.toml](C:/Users/luigi/OneDrive/Desktop/LumynTCG/backend/railway.toml) configura start command e health check.

### Vercel (frontend)

1. Importa il repository in Vercel.
2. Imposta **Root Directory** su `frontend`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Configura `VITE_API_URL=https://<railway-service>.up.railway.app/api`.
6. Deploya e copia il dominio Vercel nella variabile Railway `FRONTEND_URL`.

Il file [frontend/vercel.json](C:/Users/luigi/OneDrive/Desktop/LumynTCG/frontend/vercel.json) abilita il fallback SPA.

## Autenticazione

Il backend espone `POST /api/auth/register`, `POST /api/auth/login` e `GET /api/auth/me`.
Gli endpoint portfolio richiedono `Authorization: Bearer <token>`. Copiare `.env.example` in `.env`,
impostare `DATABASE_URL` e `JWT_SECRET`, quindi applicare `database/schema.sql` al database PostgreSQL.

## Provider prezzi

`POST /api/prices/refresh` accetta `{ "provider": "demo" | "tcgplayer" | "cardmarket" }`.
Per PokéWallet configurare `POKEWALLET_API_KEY` con la chiave privata dell'account PokéWallet.
Per TCGPlayer configurare `TCGPLAYER_CLIENT_ID` e `TCGPLAYER_CLIENT_SECRET`.
Per CardMarket configurare `CARDMARKET_API_URL` e `CARDMARKET_API_TOKEN` secondo il proxy/API account scelto.
Le credenziali non sono incluse nel repository; senza configurazione è disponibile solo il provider demo.
