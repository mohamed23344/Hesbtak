# Hesbtk.AI

Multi-tenant SMB ERP/accounting application with a NestJS backend and TanStack/Vite frontend.

## Architecture

- Shared PostgreSQL database.
- Public schema for platform data: users, organizations, memberships, invitations, plans, subscriptions, audit logs, password reset OTPs.
- One PostgreSQL schema per tenant for accounting data: accounts, onboarding responses, parties, bank accounts, journal entries, invoices, bills, payments, recurring entries, OCR records, AI conversations, forecasts, alerts, alert rules, suggestions.
- Frontend sends `Authorization: Bearer <token>` and `x-tenant-id: <organizationId>` for tenant endpoints.

## What Is Implemented

- Registration provisions user, organization, owner membership, tenant schema, and starter chart of accounts.
- Login stores JWT and tenant context in the frontend.
- Batch onboarding follows the frontend flow and posts all answers together.
- Forgot-password OTP, OTP verification, and password reset.
- Chart of accounts, invoices, journal, transactions, dashboard, forecasting, assistant, notifications, and admin pages are linked to backend endpoints.
- Backend sample endpoint tests are in [Back/README.md](./Back/README.md).

## Forecasting

Forecasting is deterministic, formula-driven, and calculated only from the current tenant's own financial history. It does not use machine learning, AI prediction models, neural networks, LLM-based forecasting, external prediction services, third-party forecasting APIs, industry benchmark datasets, or cross-tenant data.

The `/tenant/forecasts?months=12` endpoint generates revenue, expense, and cash flow forecasts from tenant-scoped accounting records. The backend resolves the tenant from `x-tenant-id`, validates the user's membership, and queries only that tenant's PostgreSQL schema.

Implemented forecasting methods:

- CAGR with seasonal adjustment when there is enough historical monthly data.
- Weighted moving average with linear trend analysis when there is moderate history.
- Historical average projection when there are fewer than three usable historical periods.
- Cash flow projection as `predicted revenue - predicted expenses`.

Forecast source data includes:

- Customer invoices.
- Vendor bills and ledger expense accounts.
- Vendor bills.
- Customer payments.
- Vendor payments.
- Journal entries and journal lines for audit visibility.

Every forecast response includes explainability and audit details:

- `modelVersion`: deterministic formula engine version.
- `forecastPrinciples`: confirms deterministic logic, no external data, no AI/ML, and tenant-only calculation.
- `method`: selected revenue, expense, and cash flow methods.
- `formulaUsed`: formulas used to generate the forecast.
- `sourceData`: historical periods, source tables, and source financial records.
- `calculationDetails`: forecast horizon, historical period count, growth rates, variance coefficients, seasonal factors, and monthly actuals.
- `confidence`: confidence score and explanation.
- `months`: monthly forecast values with predicted revenue, predicted expense, predicted cash flow, and confidence range.

Confidence is calculated only from:

- Historical data availability.
- Historical variance.
- Seasonal consistency.
- Data completeness.

The forecasting page displays the chart plus an audit trail, confidence basis, formulas, and source records so users can inspect how the forecast was produced and reproduce it from the same tenant data.

## Quick Start

Read [STARTUP_AND_ENV.md](./STARTUP_AND_ENV.md) for full setup and missing env values.

Typical local run:

```bash
cd Back
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

```bash
cd Front
npm install
npm run dev
```

Default URLs:

- Backend: `http://localhost:3000/api/v1`
- Frontend: `http://localhost:5173`
