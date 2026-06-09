@startuml
!theme plain
title Multi‑Tenant SMB ERP – Full System Sequence Flows

actor "User (Owner/Accountant/Admin)" as User
participant "WebApp" as Web
participant "API Gateway" as Gateway
participant "AuthService" as Auth
participant "OrgService" as Org
participant "AccountingService" as Acct
participant "RecurringService" as Recur
participant "InsightService" as Insight
participant "AIChatbotService" as Chat
participant "ForecastService" as Forecast
participant "AlertService" as Alerts
participant "SuggestionService" as Sugg
participant "Scheduler" as Sched
participant "EmailService" as Email

== 1. Registration & Onboarding (creates chart of accounts) ==
User -> Web: fill registration form (email, password, org name, industry)
Web -> Gateway: POST /register
Gateway -> Auth: createUser(email, password)
Auth --> Gateway: user_id
Gateway -> Org: createOrganization(name, industry, currency)
Org --> Gateway: org_id
Gateway -> Auth: link user to org as owner
Auth --> Gateway: ok

loop Onboarding Questions
    Gateway -> Org: getNextOnboardingQuestion(org_id)
    Org --> Gateway: question
    Gateway --> Web: question
    User -> Web: answer
    Web -> Gateway: POST /onboarding/answer (org_id, answer)
    Gateway -> Org: storeAnswer(org_id, question_key, answer)
end

Gateway -> Acct: generateInitialChartOfAccounts(org_id, industry, answers)
Acct --> Gateway: accounts created
Gateway --> Web: registration complete

== 2. Login & Dashboard (role‑based) ==
User -> Web: login (email, password)
Web -> Gateway: POST /login
Gateway -> Auth: authenticate(email, password)
Auth --> Gateway: JWT (user_id, global_role)
Gateway -> Org: getOrganizationsAndRoles(user_id)
Org --> Gateway: [ {org_id, role} ]
Gateway --> Web: JWT + tenant contexts

alt Normal user (owner/accountant)
    User -> Web: select tenant
    Web -> Gateway: GET /dashboard (tenant header)
    Gateway -> Insight: getDashboardKPIs(tenant)
    Insight --> Gateway: summary data
    Gateway --> Web: dashboard view
else Global admin
    User -> Web: admin dashboard
    Web -> Gateway: GET /admin/dashboard
    Gateway -> Org: getAllOrganizationsStats()
    Org --> Gateway: cross‑tenant stats
    Gateway --> Web: admin view
end

== 3. Owner adds team members ==
User -> Web: invite team member (email, role)
Web -> Gateway: POST /org/{org_id}/invitations (email, role)
Gateway -> Org: createInvitation(org_id, email, role, invited_by)
Org --> Gateway: invitation (token)
Gateway -> Email: send invitation email
Email --> Gateway: queued

Invitee -> Web: accept invitation (token)
Web -> Gateway: POST /accept-invitation (token)
Gateway -> Org: verifyAndAccept(token, user_id)
Org --> Gateway: ok (user joins as role)
Gateway --> Web: success, redirect to dashboard

== 4. CRUD Chart of Accounts ==
User -> Web: view accounts
Web -> Gateway: GET /tenant/accounts
Gateway -> Acct: getAccounts(tenant)
Acct --> Gateway: list
Gateway --> Web: accounts tree

User -> Web: create/update account
Web -> Gateway: POST/PUT /tenant/accounts
Gateway -> Acct: upsertAccount(tenant, data)
Acct --> Gateway: ok

== 5. Journal Entry creation (with optional invoice) ==
User -> Web: create journal entry
Web -> Gateway: POST /tenant/journal-entries (date, description, lines)
Gateway -> Acct: createJournalEntry(tenant, data)
Acct --> Gateway: journal_entry_id

opt while creating JE, add invoice (default = cash sale)
    User -> Web: add invoice line to JE (customer, items, revenue account)
    Web -> Gateway: POST /tenant/journal-entries/{je_id}/attach-invoice
    Gateway -> Acct: createInvoiceFromJE(tenant, je_id, invoice_data)
    Acct -> Acct: create invoice (customer, lines) & link to JE
    Acct -> Acct: auto‑create payment JE (debit cash/bank, credit AR)
    Acct --> Gateway: invoice_id
end

== 6. Full invoice lifecycle (customer & vendor) ==
group Create Invoice (Customer Invoice)
    User -> Web: new invoice (choose type "customer")
    Web -> Gateway: POST /tenant/invoices (customer_id, lines, dates)
    Gateway -> Acct: createInvoice(tenant, data)
    Acct -> Acct: create invoice, auto‑generate JE (DR AR, CR Revenue)
    Acct -> Alerts: schedule upcoming payment alert (due_date)
    Alerts --> Acct: alert scheduled
    Acct --> Gateway: invoice_id, status = unpaid
end

group Log Payment / Change Status to Paid
    User -> Web: record payment (invoice_id, amount, method)
    Web -> Gateway: POST /tenant/customer-payments
    Gateway -> Acct: createPayment(tenant, invoice_id, payment_data)
    Acct -> Acct: create payment JE (DR Cash, CR AR)
    Acct -> Acct: update invoice status (paid/partial)
    Acct --> Gateway: payment_id
end

group Vendor Bill & Payment (similar)
    User -> Web: create vendor bill
    Web -> Gateway: POST /tenant/vendor-bills
    Gateway -> Acct: createVendorBill(tenant, data)
    Acct -> Acct: create bill, JE (DR Expense, CR AP)
    Acct -> Alerts: schedule due date alert
    Acct --> Gateway: bill_id

    User -> Web: log vendor payment
    Web -> Gateway: POST /tenant/vendor-payments
    Gateway -> Acct: createVendorPayment(tenant, bill_id, payment_data)
    Acct -> Acct: JE (DR AP, CR Cash) and update bill status
    Acct --> Gateway: ok
end

== 7. Automate monthly expense (recurring entries) ==
User -> Web: define recurring entry (monthly wages)
Web -> Gateway: POST /tenant/recurring-entries (template, frequency, start_date)
Gateway -> Recur: createRecurringEntry(tenant, data)
Recur --> Gateway: entry_id

Sched -> Recur: every day/hour, check for ready recurring entries
Recur -> Recur: if next_run <= today, generate journal entry
Recur -> Acct: createJournalEntry(tenant, template lines)
Acct --> Recur: je_id
Recur -> Recur: update next_run, log execution

== 8. Dashboard insights (real‑time) ==
User -> Web: view dashboard (KPIs, cashflow)
Web -> Gateway: GET /tenant/insights/dashboard
Gateway -> Insight: calculateDashboard(tenant)
Insight -> Acct: fetch account balances, AR/AP, cash
Acct --> Insight: raw data
Insight --> Gateway: formatted KPIs, charts
Gateway --> Web: dashboard view

== 9. Formula-driven forecast & expected liabilities ==
User -> Web: open forecasts page
Web -> Gateway: GET /tenant/forecasts?months=12
Gateway -> Forecast: generateForecast(tenant, months)
Forecast -> Acct: fetch tenant invoices, expenses, bills, payments, and journal data
Forecast -> Forecast: apply CAGR, weighted moving average, trend, and seasonal formulas
Forecast -> Forecast: compute confidence from availability, variance, seasonality, and completeness
Forecast --> Gateway: predicted revenue/expense/cashflow with audit details
Gateway --> Web: forecast charts

== 10. Chatbot on financial insights ==
User -> Web: open chat, ask question
Web -> Gateway: POST /tenant/chatbot (session_id, question)
Gateway -> Chat: getResponse(tenant, user_id, question)
Chat -> Acct: retrieve recent transactions, balances
Acct --> Chat: financial snapshot
Chat -> Chat: generate natural language answer
Chat --> Gateway: response
Gateway --> Web: chatbot reply

== 11. System‑triggered alerts ==
Sched -> Alerts: evaluate alert rules (daily/hourly)
Alerts -> Acct: check thresholds (expenses, due dates, cash)
Acct --> Alerts: entities exceeding rules
Alerts -> Alerts: create alert records
Alerts -> Web: WebSocket push (unread count / alert details)
Web --> User: notification badge / popup

== 12. Budgeting & cost‑optimisation suggestions ==
Sched -> Sugg: run suggestion engine (weekly)
Sugg -> Acct: fetch spending patterns, budget vs actual
Acct --> Sugg: data
Sugg -> Sugg: generate recommendations (e.g., “cut office supplies”)
Sugg -> Alerts: create suggestion alert (type = suggestion)
Alerts -> Web: push to user
User -> Web: view suggestions list
Web -> Gateway: GET /tenant/suggestions
Gateway -> Sugg: getActiveSuggestions(tenant)
Sugg --> Gateway: list
Gateway --> Web: suggestions with accept/dismiss actions
@enduml
