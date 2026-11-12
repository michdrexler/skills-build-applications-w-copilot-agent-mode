# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Record your plan here before editing code.

- Presentation tier decision: Keep the React UI thin and data-driven, using the shared API client for `/api` calls so every screen reflects the backend contract and uses consistent loading, empty, and error states.
- Logic tier decision: Implement the Express routes and services in TypeScript, keeping validation and business logic in the backend instead of the browser so API responses remain authoritative and consistent.
- Data tier decision: Model the domain in Mongoose with required fields, references, and seed data that matches the contract; keep MongoDB concerns isolated from the HTTP layer.
- Activity tracking approach: Store user/team references, minutes, type, computed points, and occurredAt while validating user and team IDs from existing records and returning deliberate 4xx responses instead of raw cast errors.
- Team management approach: Require a team name and maintain a members array with seeded members populated from the user dataset; expose team names and mascots through the API without leaking persistence details.
- Leaderboard approach: Aggregate activity points by team, sort descending, and assign a 1-based rank so the response remains deterministic and stable for UI rendering.
- Workout suggestions approach: Match a user by email, inspect their recent activity pattern or fitness goal, and return the most relevant workout suggestions with a clear explanation tied to the user's behavior.

## Test plan

Record the commands you run and what each failure means.

- Data-tier command: `npm run test:data --prefix octofit-tracker/backend` — validates model shape, required fields, and seed data idempotency. If this fails, fix the schema/seed layer before writing API logic.
- API command: `npm run test:api --prefix octofit-tracker/backend` — validates endpoint behavior, validation errors, leaderboard ordering, and workout recommendation logic. If this fails, fix the Express routing/service layer and HTTP error handling.
- Frontend command: `npm test --prefix octofit-tracker/frontend` — validates the presentation tier's loading, empty, success, and error states. If this fails, fix the React components and API client integration.
- Backend build command: `npm run build --prefix octofit-tracker/backend` — catches TypeScript issues and contract mismatches in the server code.
- Frontend build command: `npm run build --prefix octofit-tracker/frontend` — catches TypeScript and Vite build issues in the presentation layer.
- Recommended execution order: data tests first, then API tests, then frontend tests, then both build checks. This keeps fixes aligned with the tier boundaries and minimizes churn.
