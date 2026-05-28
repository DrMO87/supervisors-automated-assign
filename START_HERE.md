# 🚀 START HERE - ESMS Setup Guide

Welcome to the Faculty Exam Supervision & Proctoring System (ESMS)!

## ⚡ Quick Start (Choose Your Path)

### 🎯 Path 1: I Want to Get Started FAST (5 minutes)
**Best for:** First-time users who want guided setup

1. **Run the setup wizard:**
   ```bash
   Double-click: setup-supabase.bat
   ```
2. **Follow the prompts** - it will guide you through everything
3. **Done!** Your app will start automatically

---

### 📚 Path 2: I Want Step-by-Step Instructions (15 minutes)
**Best for:** Users who want to understand each step

1. **Read:** `COMPLETE_SETUP_GUIDE.md`
2. **Follow:** All 7 parts in order
3. **Verify:** Use the checklist at the end

---

### 🖼️ Path 3: I Want Visual Guidance (20 minutes)
**Best for:** Visual learners who want screenshots descriptions

1. **Read:** `VISUAL_SETUP_GUIDE.md`
2. **See:** Detailed descriptions of what you'll see
3. **Follow:** Step-by-step with visual aids

---

### 🔧 Path 4: I'm Having Issues
**Best for:** Troubleshooting errors

1. **Run diagnostics:**
   ```bash
   Double-click: troubleshoot.bat
   ```
2. **Read the output** - it will tell you what's wrong
3. **Follow the suggested fixes**

---

## 📋 Current Error Fix

### Error: "ENOENT: app-paths-manifest.json"

**Quick Fix:**
1. Close the development server (Ctrl+C)
2. Run: `clear-cache.bat`
3. Run: `start-app.bat`

**Why this happens:** Next.js cache corruption

---

## 🗂️ Documentation Index

### Setup Guides
| Document | Purpose | Time | Difficulty |
|----------|---------|------|------------|
| **COMPLETE_SETUP_GUIDE.md** | Full setup with troubleshooting | 15 min | ⭐ Easy |
| **VISUAL_SETUP_GUIDE.md** | Step-by-step with screenshots | 20 min | ⭐ Easy |
| **QUICK_START.md** | Minimal quick start | 5 min | ⭐ Easy |
| **SUPABASE_SETUP.md** | Detailed Supabase guide | 10 min | ⭐⭐ Medium |
| **WHERE_TO_FIND_KEYS.md** | Visual guide for API keys | 5 min | ⭐ Easy |

### Reference Guides
| Document | Purpose |
|----------|---------|
| **SUPABASE_QUICK_REFERENCE.md** | Quick commands and URLs |
| **BATCH_FILES_GUIDE.md** | All batch files explained |
| **DEVELOPER_GUIDE.md** | Development guidelines |
| **PROJECT_SUMMARY.md** | Feature list and status |
| **README.md** | Project overview |

### Batch Files
| File | Purpose | When to Use |
|------|---------|-------------|
| **setup-supabase.bat** | Automated setup wizard | First time setup |
| **start-app.bat** | Start development server | Daily development |
| **clear-cache.bat** | Clear Next.js cache | Fix cache errors |
| **troubleshoot.bat** | Diagnose issues | When having problems |
| **open-supabase.bat** | Open Supabase dashboard | Manage database |
| **build-app.bat** | Build for production | Before deployment |
| **start-production.bat** | Start production server | Test production build |

---

## ✅ Setup Checklist

Use this to track your progress:

### Prerequisites
- [ ] Node.js installed (v18.17.0+)
- [ ] Project files downloaded
- [ ] Can open Command Prompt/PowerShell

### Supabase Setup
- [ ] Supabase account created
- [ ] ESMS project created in Supabase
- [ ] Database password saved
- [ ] Project URL copied
- [ ] anon public key copied
- [ ] service_role key copied

### Configuration
- [ ] `.env.local` file updated with real keys
- [ ] No placeholder values in `.env.local`
- [ ] File saved

### Database
- [ ] SQL Editor opened in Supabase
- [ ] `001_initial_schema.sql` migration run
- [ ] `002_rls_policies.sql` migration run
- [ ] 6 tables visible in Table Editor
- [ ] `system_settings` has default values

### Application
- [ ] Cache cleared (`clear-cache.bat`)
- [ ] Dependencies installed (`npm install`)
- [ ] Development server starts (`start-app.bat`)
- [ ] Browser opens automatically
- [ ] Home page loads without errors
- [ ] Dashboard page loads
- [ ] Staff page loads

### Optional
- [ ] Sample staff added
- [ ] Sample room added
- [ ] Sample exam session added
- [ ] Data visible in app

---

## 🎯 What to Do After Setup

### 1. Explore the Application
- Click through all navigation items
- Understand the layout
- Check the dashboard weekly view

### 2. Add Your Data
- Add real staff members
- Add your exam halls/rooms
- Add upcoming exam sessions

### 3. Test Features
- Try the auto-assignment algorithm
- View staff scores
- Navigate the weekly schedule

### 4. Customize (Optional)
- Adjust system settings
- Modify staffing ratios
- Configure working hours

---

## 🆘 Getting Help

### Step 1: Run Diagnostics
```bash
troubleshoot.bat
```
This will tell you exactly what's wrong.

### Step 2: Check Common Issues
See `COMPLETE_SETUP_GUIDE.md` → "Common Issues & Solutions"

### Step 3: Review Documentation
- **Setup issues:** `COMPLETE_SETUP_GUIDE.md`
- **Supabase issues:** `SUPABASE_SETUP.md`
- **Can't find keys:** `WHERE_TO_FIND_KEYS.md`
- **Batch file issues:** `BATCH_FILES_GUIDE.md`

---

## 📞 Quick Reference

### Important URLs
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Local App:** http://localhost:3000
- **Node.js Download:** https://nodejs.org/

### Important Commands
```bash
# Start the app
start-app.bat

# Fix cache errors
clear-cache.bat

# Diagnose issues
troubleshoot.bat

# Setup Supabase
setup-supabase.bat

# Open Supabase
open-supabase.bat
```

### Important Files
- **Environment:** `.env.local`
- **Dependencies:** `package.json`
- **Migrations:** `supabase/migrations/`

---

## 🎓 Learning Path

### Week 1: Setup & Basics
1. Complete setup (this guide)
2. Add sample data
3. Explore all pages
4. Understand the workflow

### Week 2: Data Management
1. Add real staff members
2. Add real rooms
3. Add real exam sessions
4. Test auto-assignment

### Week 3: Advanced Features
1. Understand the algorithm
2. Customize settings
3. Generate reports
4. Export data

---

## 🎉 Ready to Start?

### Recommended First Steps:

1. **Run the setup wizard:**
   ```bash
   setup-supabase.bat
   ```

2. **If you prefer manual setup:**
   - Read: `COMPLETE_SETUP_GUIDE.md`
   - Follow all 7 parts

3. **If you're having issues:**
   - Run: `troubleshoot.bat`
   - Check the output
   - Follow suggested fixes

4. **After successful setup:**
   - Add sample data
   - Explore the app
   - Read `DEVELOPER_GUIDE.md` for next steps

---

**Good luck!** 🚀 You're about to have a fully functional exam supervision system!

**Questions?** Check the documentation files listed above - they cover everything in detail!

