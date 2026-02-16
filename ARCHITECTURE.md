ARCHITECTURE — Flowdesk
This document explains the engineering decisions behind Flowdesk.
The goal of this project was not simply building a financial tracker, but designing a deterministic mobile decision system that remains reliable in unstable mobile environments.
1. Architectural Philosophy
The project follows one central rule:
UI must never contain business intelligence.
Why?
Because financial decisions need to be:
testable
reproducible
database independent
predictable
Instead of “screens controlling behavior”, the application is structured around decision engines.
The UI only renders conclusions.
2. System Layers
Flowdesk uses a layered architecture:
Presentation Layer (React Native UI)
State Layer (Zustand)
Service Layer (Firestore access)
Decision Layer (Pure Engines)
Presentation Layer
Responsible only for:
rendering data
triggering actions
optimistic feedback
No calculations or business rules exist here.
State Layer
Stores normalized entities:
clients
receivables
appointments
State never decides behavior — it only holds data.
Service Layer
The Firestore service is intentionally thin.
It performs:
persistence
audit recording
conflict-safe updates
No business rules exist here.
Decision Layer (Core of the Product)
The actual product logic lives here.
Every important feature is a deterministic engine:
Engine	Purpose
DailyTasks	What user should do today
RiskAnalysis	Predict late payments
CashFlowForecast	Predict future balance
ReminderEngine	Suggest reminders
FinancialScore	Monthly performance score
InsightEngine	Detect behavioral trends
ActivityFeed	Describe business events
All engines:
pure functions
no side effects
no database calls
3. Why deterministic engines
Financial software must not depend on UI state.
Example:
Instead of:
button pressed → mark paid
The system works as:
history changes → risk recalculated → tasks updated → insights updated
The UI reacts to the model, not the opposite.
4. Audit Trail as a Source of Truth
Receivables are not stored as a static status.
They are stored as an evolving history:
CREATED
CHARGE_SENT
LATE
PAID
RESCHEDULED
EDITED
Current state is derived — not stored.
This prevents data corruption and enables prediction engines.
5. Optimistic UI with Safe Recovery
Mobile networks are unreliable.
The app assumes failure is normal.
Every financial action follows this pipeline:
optimistic update
→ guarded execution
→ audit record
→ sync feedback
→ undo window
→ retry if needed
This prevents:
duplicate payments
inconsistent states
user distrust
6. Action Guard
Financial actions must be idempotent.
A guard prevents repeated execution:
runGuardedAction(key, fn)
This solves the common mobile problem:
double taps during network delay.
7. Undo System
Users make mistakes more than systems fail.
Every destructive action:
keeps previous snapshot
exposes undo window
restores state and database
This dramatically increases trust in financial apps.
8. Prediction before automation
The system never auto-charges users.
Instead it predicts and suggests actions.
Reason:
automation without confidence causes abandonment.
Guidance creates engagement.
9. Why Firestore
Chosen not for simplicity, but for:
offline cache
realtime updates
conflict resolution
The architecture avoids Firestore coupling by isolating it in services.
Engines remain portable.
10. Design goal
Flowdesk is not a CRUD financial app.
It is a behavioral system:
data → interpretation → suggestion → action → learning
The user is not managing finances.
The system is managing attention.
