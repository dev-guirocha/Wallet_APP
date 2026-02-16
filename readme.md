---

# Flowdesk — Intelligent financial workspace for service professionals

A mobile application that helps service professionals manage revenue predictability, payment behavior, and financial decision-making.

Unlike traditional finance trackers, Flowdesk does not focus on bookkeeping — it focuses on **operational cash-flow control**.

The system continuously analyzes receivables, appointments and payment history to guide the user on what to do next.

---

## Why this project exists

Freelancers rarely fail because of low revenue.

They fail because of:

* delayed payments
* inconsistent scheduling
* mental overload managing clients manually

Flowdesk reduces cognitive load by transforming raw financial data into daily actionable decisions.

The product behaves closer to an *operational copilot* than a ledger.

---

## Core product idea

The app answers three questions automatically:

**Today:**
Who should I charge?

**This week:**
Will I run out of money?

**This month:**
Am I improving financially?

---

## Key Features

### Daily execution system

* Automatic daily task generation
* Optimistic task completion
* Undo after financial actions
* Daily progress indicator

### Smart receivables management

* Contextual WhatsApp charge messages
* Risk-based prioritization
* Duplicate action guard
* Full audit trail per receivable

### Financial prediction

* 7-day cash flow forecast
* Negative balance alerts
* Late payment prediction
* Intelligent reminders

### Monthly financial analytics

* Financial score (0-100)
* Month-over-month insights
* Payment behavior trends
* Client reliability tracking

### Activity feed

A timeline describing business events:

* client paid late
* risk increased
* forecast worsened
* recovery improved

This changes the app from tool → monitoring system.

---

## Architecture Overview

The project intentionally separates **UI from decision engines**.

```
UI Layer → React Native components
State Layer → Zustand store
Data Layer → Firestore service
Decision Layer → deterministic engines
```

The goal: product intelligence must be testable without UI or database.

---

## Decision Engines (core of the project)

These modules represent the actual product value:

| Engine           | Responsibility                      |
| ---------------- | ----------------------------------- |
| DailyTasksEngine | Generates what user should do today |
| RiskEngine       | Determines payment risk             |
| CashFlowForecast | Predicts future balance             |
| ReminderEngine   | Suggests reminders                  |
| FinancialScore   | Monthly performance score           |
| InsightEngine    | Month comparison insights           |
| ActivityFeed     | Generates business timeline         |

All engines are pure functions.

They do not access Firestore or UI directly.

---

## Reliability mechanisms

Financial actions cannot be fragile.

The app implements:

* action guard (prevents double execution)
* optimistic UI updates
* undo system
* audit trail
* sync feedback per item
* retry flow for network failures

This prevents data corruption in unstable mobile environments.

---

## Tech Stack

**Mobile**

* React Native (Expo)
* React Navigation

**State**

* Zustand

**Backend**

* Firebase Firestore

**Language**

* JavaScript + progressive TypeScript

**UI**

* Custom design system (no UI framework)

---

## Project Structure

```
src/
  components/       reusable UI system
  screens/          application flows
  store/            global state
  services/         Firestore access
  utils/            helpers
  engines/          product intelligence
```

The engines directory contains most of the product complexity.

---

## Example: deterministic behavior

The app does not simply mark a payment.

It transforms it into historical knowledge:

```
charge sent → late → recovered → improves risk
```

Future decisions depend on past behavior.

This is why audit history exists.

---

## Running locally

### Requirements

* Node LTS
* Expo
* Firebase project

### Install

```
npm install
```

### Run

```
npx expo start
```

---

## What this project demonstrates

This project was intentionally built to showcase:

* product thinking
* behavioral UX
* deterministic business logic
* offline-safe financial operations
* separation of decision engines
* mobile reliability patterns

Not just CRUD.

---

## Author

Guilherme Rocha
Software Developer focused on mobile product engineering

---
