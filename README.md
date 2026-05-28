# Faculty Exam Supervision & Proctoring System (ESMS)

A professional web application for managing exam supervision and proctoring assignments with automated fair workload distribution.

## Features

- **Automated Assignment Algorithm**: Score-based fair distribution of supervision duties
- **Weekly Schedule Dashboard**: Visual grid view with drag-and-drop management
- **Staff Management**: Track faculty members, scores, and availability
- **Room Management**: Configure exam halls with capacity constraints
- **Exam Session Management**: Bulk import and scheduling capabilities
- **Constraint Validation**: Prevent double-booking and enforce business rules
- **PDF Reports**: Generate schedules and workload statistics
- **Locking Mechanism**: Finalize schedules to prevent changes

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **State Management**: Zustand
- **UI Components**: Headless UI, Lucide React Icons
- **PDF Generation**: jsPDF
- **Drag & Drop**: @dnd-kit

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   cd "d:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at https://supabase.com
   - Copy your project URL and anon key
   - Run the migrations in `supabase/migrations/` in your Supabase SQL editor

4. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3010](http://localhost:3010)

## Project Structure

```
├── app/                      # Next.js App Router pages
│   ├── dashboard/           # Weekly schedule dashboard
│   ├── staff/               # Staff management
│   ├── rooms/               # Room management
│   ├── exams/               # Exam session management
│   ├── reports/             # PDF reports and exports
│   └── settings/            # System configuration
├── components/              # React components
│   ├── layout/             # Navigation and page layouts
│   └── dashboard/          # Dashboard-specific components
├── lib/                     # Utilities and business logic
│   ├── algorithms/         # Auto-assignment algorithm
│   ├── stores/             # Zustand state management
│   ├── supabase/           # Supabase client configuration
│   └── utils/              # Helper functions
├── types/                   # TypeScript type definitions
└── supabase/               # Database migrations
    └── migrations/         # SQL migration files
```

## Auto-Assignment Algorithm

The system uses a score-based algorithm to ensure fair workload distribution:

### Staffing Ratios
- 1-9 students: 1 Head Supervisor
- 10-30 students: 1 Head Supervisor + 1 Assistant
- 31-50 students: 1 Head Supervisor + 2 Assistants
- 51-60 students: 1 Head Supervisor + 3 Assistants
- 61+ students: 1 Head Supervisor + 4 Assistants

### Scoring System
- Head Supervisor assignment: +2 points
- Assistant assignment: +1 point
- Algorithm prioritizes staff with lowest scores

### Constraints
- No double booking (same time slot)
- No consecutive shifts (same day, different periods)
- Part-time staff cannot work afternoon sessions
- Only available staff are assigned

## Database Schema

See `supabase/migrations/001_initial_schema.sql` for the complete database schema including:
- `staff` - Faculty members with scores and availability
- `rooms` - Exam halls with capacity
- `exam_sessions` - Scheduled exams
- `assignments` - Staff-to-exam mappings
- `system_settings` - Configuration
- `audit_log` - Change tracking

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```

## Next Steps

1. Complete staff management CRUD interface
2. Implement room management pages
3. Build exam session import functionality
4. Create auto-assignment API endpoint
5. Add drag-and-drop assignment editing
6. Implement PDF report generation
7. Add locking mechanism
8. Create audit trail viewer

## License

Proprietary - University Faculty Internal Use Only

