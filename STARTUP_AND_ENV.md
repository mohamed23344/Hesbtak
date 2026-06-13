# Startup And Env

## Required Local Services

- Node.js compatible with the installed dependencies.
- PostgreSQL with `pgvector` extension available. The provided Docker Compose uses `pgvector/pgvector:pg16`.
- Redis is included in Docker Compose but currently reserved for future queues/cache.

## Backend Env

Create `Back/.env` from `Back/.env.example`.

Required:

```bash
PORT=3000
APP_PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hesbtk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=hesbtk
POSTGRES_PORT=5432
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
GOOGLE_EMAIL=
GOOGLE_APP_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_SMTP_REJECT_UNAUTHORIZED=true
AI_LLM_PROVIDER=groq
GROQ_API_KEY=
OPENAI_API_KEY=
AI_EMBEDDING_PROVIDER=mock
HF_TOKEN=your_hugging_face_token
HF_EMBEDDING_MODEL=BAAI/bge-m3
```

`GOOGLE_EMAIL` and `GOOGLE_APP_PASSWORD` are used for OTP, invitation, and organization-access emails. Use a Google app password. `GOOGLE_CLIENT_ID` is the OAuth 2.0 Web client ID used to verify Google sign-in tokens.

`AI_LLM_PROVIDER` switches the chatbot between `groq`, `openai`, and
`huggingface`. Configure the matching `GROQ_API_KEY`, `OPENAI_API_KEY`, or
`HF_TOKEN`. Use `AI_LLM_MODEL` for a shared model override, or provider-specific
values such as `OPENAI_CHAT_MODEL`, `GROQ_CHAT_MODEL`, and
`HUGGINGFACE_CHAT_MODEL`. Local embeddings default to
the deterministic `mock` provider. Set `AI_EMBEDDING_PROVIDER=huggingface` and
provide `HF_TOKEN` to use hosted Hugging Face embeddings.
The same token enables invoice image extraction with
`Qwen/Qwen3-VL-235B-A22B-Instruct` through the Novita inference provider.

If your local Windows machine shows `SELF_SIGNED_CERT_IN_CHAIN` while sending OTP, set:

```bash
GOOGLE_SMTP_REJECT_UNAUTHORIZED=false
```

Use that only for local development. In production, keep it `true` and install the correct trusted CA certificate instead.

Currently optional/reserved:

```bash
REDIS_PASSWORD=redis
REDIS_PORT=6379
REDIS_URL=redis://:redis@localhost:6379
```

Important: `docker-compose.yml` maps the backend container with `APP_PORT`, while Nest itself listens on `PORT`.

## Frontend Env

Create `Front/.env` from `Front/.env.example`.

```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_GOOGLE_CLIENT_ID=
```

If this is missing, the frontend defaults to `http://localhost:3000/api/v1`.
Use the same Google OAuth client ID on both applications. Add the frontend origin, such as `http://localhost:5173`, to its authorized JavaScript origins in Google Cloud Console.

## Start With Docker For Database

From `Back`:

```bash
docker compose up -d postgres redis
```

Then run the backend locally:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

## Start Frontend

From `Front`:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Build Checks

Backend:

```bash
cd Back
npm run build
```

Frontend:

```bash
cd Front
npm run build
```

## Missing Production Integrations

- OTP, invitation, and organization membership emails use Gmail SMTP when `GOOGLE_EMAIL` and `GOOGLE_APP_PASSWORD` are set.
- Real payment/subscription provider. The public `plans` and `subscriptions` models exist, but billing automation is not integrated.
- Real OCR extraction pipeline. The frontend OCR page is still a UI stub.
- Real ML/LLM services. Chatbot assistance can use configured LLM services; forecasting is deterministic formula logic from tenant ledger data only.
- WebSocket push for notifications. Alerts are stored and fetched over HTTP.
