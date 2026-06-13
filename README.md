# CarbonLens - Personal Carbon Footprint Tracker

CarbonLens is a modern, full-stack personal carbon footprint tracker designed to help individuals analyze, understand, and reduce their environmental impact. By logging daily activities, users can visualize their emissions, participate in ecological challenges, and receive real-time, streaming AI coaching insights powered by Claude.

---

## Architecture Diagram (ASCII)

```
               +-------------------------------------------------+
               |                VITE FRONTEND                    |
               |  (React + TailwindCSS + Lucide Icons + Recharts)|
               +-----------------------+-------------------------+
                                       |
                                   REST / SSE
                                       |
                                       v
               +-------------------------------------------------+
               |               EXPRESS BACKEND                   |
               |   (routes, controllers, input validation)       |
               +-----------------------+-------------------------+
                                       |
                         +-------------+-------------+
                         |                           |
                         v                           v
               +-------------------+       +-------------------+
               |    SQLITE DB      |       |  CLAUDE HAIKU AI  |
               | (better-sqlite3)  |       | (Anthropic SDK)   |
               +-------------------+       +-------------------+
```

---

## Features

1. **Environmental Dashboard**: KPI overview of today's emissions, current month's total compared to the global average, and consecutive logging streak. Visualized with Recharts Line and Donut charts.
2. **Activity Logging**: Log items under Transport, Food, Energy, Shopping, and Waste with automatic unit mapping, instant CO₂ previews, and safe HTML sanitization.
3. **Activity History**: Tabular summary of logs with category, keyword, and date filters, deletion capability, and client-side CSV export.
4. **AI Coach Insights**: Real-time streaming reduction recommendations and customized challenge suggestions powered by Claude via SSE.
5. **Eco Challenges**: Enroll in pre-built challenges ("Car-Free Week", "Plant-Based Week", etc.) and monitor progress dynamically updated in relation to logging habits.

---

## Quick Start (3 Commands)

Get the project up and running in under a minute:
```bash
git clone <your-repo-url> && cd carbonlens
npm install
npm run dev
```

---

## Setup & Running Instructions

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed.

### 2. Install Dependencies
Run the installation script in the root directory:
```bash
npm install
```

### 3. Environment Variables
Create a local `.env` file in the root directory (based on `.env.example` template):
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3001
NODE_ENV=development
```

### 4. Start the Application
Run the client and backend API concurrently:
```bash
npm run dev
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

*Note: On initial startup, the backend automatically seeds the database with 30 days of historical records for the user "demo" so you can explore charts immediately!*

---

## API Documentation

All routes are nested under `/api/*`.

| Endpoint | Method | Payload / Query Parameters | Description |
|:---|:---:|:---|:---|
| `/api/users/login` | POST | `{ username: string }` | Log in or register a new user. Username is XSS sanitized. |
| `/api/activities` | GET | `?userId=id&days=30` | Fetch logged activities for user. |
| `/api/activities` | POST | `{ userId, category, activityType, quantity, loggedAt, notes }` | Log a new activity. CO₂ is calculated server-side. |
| `/api/activities/:id` | DELETE | - | Optimistically delete activity log entry. |
| `/api/stats` | GET | `?userId=id&period=week\|month\|year` | Return aggregated dashboard KPIs and charting arrays. |
| `/api/stats/compare` | GET | `?userId=id` | Get annualized user footprint vs global, India, and Paris targets (tons CO₂/yr). |
| `/api/challenges` | GET | `?userId=id` | Get enrolled challenges with progress computed dynamically. |
| `/api/challenges/templates` | GET | `?userId=id` | Fetch 4 AI-generated challenges based on the user's worst emission category. |
| `/api/challenges` | POST | `{ userId, title, description?, target_reduction_kg?, duration_days? }` | Join a predefined or dynamic custom challenge. |
| `/api/challenges/:id` | PUT | `{ status: 'completed'\|'failed' }` | Manually update challenge status. |
| `/api/insights` | POST | `{ userId }` | Get streaming AI insights using SSE from Claude with carbon equivalences. |

---

## Security Guidelines

- **Input Sanitization**: Usernames are sanitized of script/HTML tags, and activity notes are cleaned to prevent persistent XSS.
- **Strict SSE Validation**: `/api/insights` verifies `userId` type and length limits before rate limiting.
- **Production TLS/HTTPS**: This app runs locally on HTTP. When deploying to production, it is highly recommended to configure an SSL certificate (e.g. via Let's Encrypt or Nginx reverse proxy) to serve the app strictly over **HTTPS** to secure cookies, headers, and SSE connections.

---

## Emission Factor References

We have pre-programmed standard carbon multipliers representing average greenhouse gas coefficients, cited from the following databases:
- **EPA GHG Emission Factors Hub (2025)**: For domestic transport (passenger vehicles, public transit), home energy coefficients (electricity, natural gas, fuel oil), and waste lifecycle emissions.
- **IPCC Guidelines for National Greenhouse Gas Inventories**: For food footprint coefficients (beef, chicken, dairy, grains) and shopping item estimations.

---

## Testing

The project uses Jest and Supertest. To execute unit, validation, and API integration tests:
```bash
npm run test
```
This executes all **34 integration and validation test cases** checking calculations, input validation edge cases, rate-limiting security, and DB consistency.

---

## Design System & Styling
- **CSS**: TailwindCSS utility framework.
- **Colors**: Near-black-green backgrounds (`#0a0f0a`), glassmorphic dark-green cards (`#111811`), subtle borders (`#1e2e1e`), and vibrant warning/success accents.
- **Fonts**: Inter (imported via Google Fonts).
- **Icons**: Lucide React.

---

## Architectural Assumptions
- **Authentication**: Local-only username sessions stored in browser `localStorage`. No registration passwords.
- **Auto-Seeding**: On first run, if the `activities` table is empty, the database seeds 30 days of logs for user `demo` dynamically offset from today's date so charts have active data.
- **Challenge Progress**: Active challenge completion is determined by querying the `activities` table. For example, "Car-Free Week" tracks if the user logged 0 car trips during the active challenge dates. If a trip is logged, progress drops to 0. If 7 days pass successfully, the status dynamically resolves to `completed` upon user reload.
