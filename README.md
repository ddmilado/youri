# YourIntAI

**YourIntAI** is a premium, AI-powered platform designed to help businesses audit their international presence. It specializes in detecting legal, localization, and conversion-killing issues on websites for the German and international markets.

---

## 🚀 Key Features

- **AI-Powered Deep Audits**: Automatically analyzes websites for GDPR/DSGVO compliance, Impressum accuracy, consumer rights, and localization quality.
- **Dynamic Scoring**: Real-time audit scoring (0-100) based on the severity of the findings found by specialized AI agents.
- **Shareable Reports**: Generate public, anonymous URLs for audits to share findings with clients or team members without requiring an account.
- **Premium Dashboard**: A sleek, glassmorphic interface to manage audits, keyword searches, and AI leads.
- **PDF Export**: Professional PDF report generation for offline distribution.
- **Enterprise Hardened**: Built with strict TypeScript, automated cleaning of AI outputs, and robust error handling.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with **Vite** for lightning-fast development.
- **TypeScript** for type-safe code.
- **Tailwind CSS** + **Shadcn UI** for a premium design system.
- **Framer Motion** for smooth, meaningful animations.
- **TanStack React Query** for efficient state management and caching.

### Backend & Infrastructure
- **Supabase**: Handles Authentication, Database (PostgreSQL), and Row Level Security (RLS).
- **Edge Functions**: Deno-based serverless functions for AI orchestration.
- **OpenAI GPT-4o**: Powering the specialized audit agents.
- **Firecrawl**: Advanced web crawling and content extraction.

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase CLI (optional for local dev)
- API Keys: OpenAI, Firecrawl

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourinternationaltech/yourintai.git
   cd yourintai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 📦 Project Structure

- `src/pages`: Main application views (Dashboard, Audit Reports, Jobs).
- `src/components`: Reusable UI components built with Radix UI and Tailwind.
- `src/contexts`: Global state providers (Authentication).
- `src/lib`: Core utilities for Supabase client, formatting, and API interaction.
- `supabase/functions`: AI workflow and lead generation logic.

---


Built with ❤️ by **YourInternational**

