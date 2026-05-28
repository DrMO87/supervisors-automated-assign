# ESMS Developer Guide

Complete guide for developers working on the Faculty Exam Supervision & Proctoring System.

## 📚 Documentation Index

1. **QUICK_START.md** - Get running in 5 minutes
2. **SETUP_GUIDE.md** - Detailed setup instructions
3. **PROJECT_SUMMARY.md** - Feature list and project status
4. **README.md** - Architecture and overview
5. **This file** - Development guidelines

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom components
- **Database**: Supabase (PostgreSQL)
- **State**: Zustand + React Query
- **UI Components**: Headless UI, Lucide Icons
- **Drag & Drop**: @dnd-kit (to be implemented)
- **PDF**: jsPDF (to be implemented)

### Project Structure

```
├── app/                          # Next.js App Router pages
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home page
│   ├── providers.tsx            # React Query provider
│   ├── globals.css              # Global styles
│   ├── dashboard/               # Weekly schedule dashboard
│   │   ├── layout.tsx          # Dashboard layout
│   │   └── page.tsx            # Dashboard page
│   ├── staff/                   # Staff management
│   ├── rooms/                   # Room management
│   ├── exams/                   # Exam sessions
│   ├── reports/                 # Reports & exports
│   └── settings/                # System settings
│
├── components/                   # React components
│   ├── layout/                  # Layout components
│   │   ├── navigation.tsx      # Main navigation
│   │   └── page-header.tsx     # Page header component
│   ├── dashboard/               # Dashboard components
│   │   ├── weekly-schedule-grid.tsx
│   │   ├── week-navigator.tsx
│   │   ├── exam-session-card.tsx
│   │   └── auto-assign-button.tsx
│   └── staff/                   # Staff components
│       └── staff-table.tsx
│
├── lib/                         # Business logic & utilities
│   ├── algorithms/              # Core algorithms
│   │   └── auto-assignment.ts  # Auto-assignment logic
│   ├── stores/                  # Zustand stores
│   │   └── scheduling-store.ts # Scheduling state
│   ├── supabase/                # Database clients
│   │   ├── client.ts           # Client-side client
│   │   └── server.ts           # Server-side client
│   └── utils/                   # Helper functions
│       ├── cn.ts               # Class name utility
│       └── date-helpers.ts     # Date utilities
│
├── types/                       # TypeScript definitions
│   └── database.types.ts       # Database types
│
└── supabase/                    # Database migrations
    └── migrations/
        ├── 001_initial_schema.sql
        └── 002_rls_policies.sql
```

## 🔑 Key Concepts

### 1. Auto-Assignment Algorithm

Located in `lib/algorithms/auto-assignment.ts`, this is the core business logic:

**Key Functions:**
- `calculateRequiredStaff()` - Determines staff needed based on student count
- `isStaffAvailable()` - Validates constraints
- `sortStaffByPriority()` - Orders staff by score and job title
- `assignStaffToSession()` - Main assignment function
- `updateStaffScores()` - Updates scores after assignment

**Staffing Ratios:**
```typescript
1-9 students   → 1 Head Supervisor
10-30 students → 1 Head + 1 Assistant
31-50 students → 1 Head + 2 Assistants
51-60 students → 1 Head + 3 Assistants
61+ students   → 1 Head + 4 Assistants
```

**Constraints:**
1. No double booking (same time slot)
2. No consecutive shifts (same day, different periods)
3. Part-time staff cannot work Period 2 (afternoon)
4. Only available staff are assigned

**Scoring:**
- Head Supervisor: +2 points
- Assistant: +1 point
- Algorithm prioritizes lowest scores

### 2. Database Schema

**Core Tables:**
- `staff` - Faculty members with scores and availability
- `rooms` - Exam halls with capacity
- `exam_sessions` - Scheduled exams
- `assignments` - Staff-to-exam mappings
- `system_settings` - Configuration
- `audit_log` - Change tracking

**Key Relationships:**
```
exam_sessions → room (many-to-one)
assignments → exam_session (many-to-one)
assignments → staff (many-to-one)
```

### 3. State Management

**Zustand Store** (`lib/stores/scheduling-store.ts`):
- Manages global scheduling state
- Stores exam sessions, staff, rooms
- Provides computed getters
- Handles filters and selections

**React Query**:
- Handles data fetching
- Provides caching
- Manages loading states

## 🛠️ Development Workflow

### Adding a New Feature

1. **Create Types** (if needed)
   ```typescript
   // types/database.types.ts
   export interface NewFeature {
     id: string;
     // ... fields
   }
   ```

2. **Create Database Migration** (if needed)
   ```sql
   -- supabase/migrations/003_new_feature.sql
   CREATE TABLE new_feature (...);
   ```

3. **Create Component**
   ```typescript
   // components/feature/feature-component.tsx
   'use client';
   export function FeatureComponent() {
     // Implementation
   }
   ```

4. **Create Page**
   ```typescript
   // app/feature/page.tsx
   import { FeatureComponent } from '@/components/feature/feature-component';
   export default function FeaturePage() {
     return <FeatureComponent />;
   }
   ```

### Code Style Guidelines

**TypeScript:**
- Use explicit types, avoid `any`
- Prefer interfaces over types for objects
- Use type inference where obvious

**React:**
- Use functional components
- Prefer hooks over class components
- Use `'use client'` for client components
- Keep components small and focused

**Naming:**
- Components: PascalCase (`StaffTable`)
- Files: kebab-case (`staff-table.tsx`)
- Functions: camelCase (`loadStaff`)
- Constants: UPPER_SNAKE_CASE (`MAX_CAPACITY`)

**Imports:**
- Use absolute imports with `@/` prefix
- Group imports: React → Next → External → Internal

## 🧪 Testing

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Build Test
```bash
npm run build
```

## 🚀 Deployment

### Environment Variables

**Development** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Production** (Vercel):
Set the same variables in Vercel dashboard.

### Deployment Steps

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy!

## 📝 Common Tasks

### Add a New Page
1. Create `app/new-page/page.tsx`
2. Create `app/new-page/layout.tsx` (optional)
3. Add to navigation in `components/layout/navigation.tsx`

### Add a Database Table
1. Create migration in `supabase/migrations/`
2. Add types to `types/database.types.ts`
3. Add RLS policies if needed

### Add a Zustand Store
1. Create in `lib/stores/`
2. Define interface with state and actions
3. Use `create()` with devtools middleware

## 🐛 Debugging

### Common Issues

**"Failed to fetch"**
- Check Supabase credentials in `.env.local`
- Verify RLS policies allow access
- Check network tab for actual error

**TypeScript Errors**
- Run `npm run type-check` for details
- Check import paths use `@/` prefix
- Verify types are exported

**Build Failures**
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for unused imports

## 📖 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Query](https://tanstack.com/query/latest)

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit for review

---

**Happy Coding!** 🎉

