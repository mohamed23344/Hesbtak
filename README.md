# Hesbtak.ai

<p align="center">
  <img src="https://github.com/user-attachments/assets/fd324e04-92f4-4975-948c-74777ad98511" alt="Hesbtak.ai Logo" width="420">
</p>

<h1 align="center">Hesbtak.ai</h1>

<p align="center">
  <strong>AI-Powered Multi-Tenant ERP & Accounting Platform</strong>
</p>

<p align="center">
  Graduation Project • ITI Intensive Program (MERN Stack)
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB" />
  <img src="https://img.shields.io/badge/Backend-NestJS-E0234E" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791" />
  <img src="https://img.shields.io/badge/ORM-Prisma-2D3748" />
  <img src="https://img.shields.io/badge/License-Academic-blue" />
</p>

---

## 📖 Overview

**Hesbtak.ai** is a cloud-based ERP and accounting platform built for Small and Medium Businesses (SMBs).

The platform combines modern accounting workflows, AI-powered assistance, financial forecasting, and tenant-isolated infrastructure to deliver a scalable SaaS solution capable of serving multiple organizations securely.

Built with **React**, **NestJS**, **Prisma**, and **PostgreSQL**, the project demonstrates enterprise-grade architecture, multi-tenancy, financial systems design, and AI integration.

---
## 👥 Team Members

| Name | GitHub |
|--------|---------|
| Mohamed Ahmed | [@mohamedAbdEl-Kawy](https://github.com/mohamedAbdEl-Kawy) |
| Hussien Ahmed | [@hussien103](https://github.com/hussien103) |
| Mohamed Khaled | [@Mohamedkhaled81](https://github.com/Mohamedkhaled81) |
| Omar Ezzat | [@omar-ezzat](https://github.com/omar-ezzat) |
| Mario Nassif | [@marionasef](https://github.com/marionasef) |

---
## ✨ Features

### 🏢 Multi-Tenant Architecture
- Tenant-aware authentication and authorization
- Automated organization provisioning
- Schema-based tenant isolation
- Secure data separation

### 💰 Accounting System
- Chart of Accounts
- Journal Entries
- General Ledger
- Accounts Receivable
- Accounts Payable
- Financial Statements

### 📄 Invoicing & Payments
- Customer Invoices
- Supplier Bills
- Payment Tracking
- Transaction History

### 📊 Financial Reporting
- Balance Sheet
- Income Statement
- Cash Flow Analysis
- Financial Insights

### 📈 Forecasting Engine
- CAGR-based forecasting
- Seasonal adjustments
- Explainable financial projections
- Deterministic calculations

### 🤖 AI Assistant
- Accounting guidance
- Business insights
- Context-aware assistance
- Productivity enhancements

### 🔐 Security
- JWT Authentication
- Role-Based Access Control (RBAC)
- Tenant-scoped authorization
- Secure API architecture

---

## 🏗️ System Architecture

```text
┌─────────────────────┐
│     React + Vite    │
│      Frontend       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      NestJS API     │
│      Backend        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│       Prisma        │
│         ORM         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     PostgreSQL      │
│ Multi-Tenant Schemas│
└─────────────────────┘
```

## 📂 Project Structure

```text
Hesbtak.ai
│
├── Front/        # React + Vite Frontend
├── Back/         # NestJS Backend API
├── AI/           # AI Services & Prompts
├── prisma/       # Database Schema & Migrations
├── uploads/      # Uploaded Files
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query

### Backend
- NestJS
- Node.js
- TypeScript
- JWT Authentication

### Database
- PostgreSQL
- Prisma ORM

### DevOps & Tools
- Docker
- ESLint
- Prettier
- Jest

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- npm or pnpm
- Docker (Optional)

### Backend Setup

```bash
# Backend
cd Back

npm install

npx prisma generate

npx prisma migrate deploy

npm run start:dev

### Frontend Setup

```bash
cd Front

npm install

npm run dev
```

---

## 🗄️ Database Migration

```bash
npx prisma migrate dev
```

Production:

```bash
npx prisma migrate deploy
```

---

## 🧪 Testing

Run End-to-End tests:

```bash
npm run test:e2e
```

---

## 🐳 Docker

```bash
docker-compose up --build
```

---

## 🎓 Academic Project

This project was developed as a graduation project for the **ITI Intensive Program (MERN Stack)**.

The goal was to design and implement a scalable SaaS ERP platform capable of serving multiple organizations through secure multi-tenant architecture while leveraging AI to improve business workflows.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📬 Contact

For questions, suggestions, or collaboration opportunities, please open an issue or contact the project team.

---

<p align="center">
  Built with ❤️ by the Hesbtak.ai Team
</p>
