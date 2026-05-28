# Batch Files Guide

Quick reference for all the batch files in this project.

## 📁 Available Batch Files

### 🚀 **start-app.bat** - Start Development Server
**Purpose:** Start the ESMS application in development mode

**What it does:**
- ✅ Checks if Node.js is installed
- ✅ Checks if dependencies are installed
- ✅ Checks if .env.local exists
- ✅ Opens browser automatically to http://localhost:3000
- ✅ Starts Next.js development server

**When to use:**
- Every time you want to run the app
- After making code changes
- Daily development work

**Usage:**
```bash
# Just double-click the file
start-app.bat
```

**What you'll see:**
- Terminal window with server logs
- Browser opens automatically after 3 seconds
- App available at http://localhost:3000

**To stop:**
- Press `Ctrl+C` in the terminal window

---

### 🏗️ **build-app.bat** - Build for Production
**Purpose:** Create an optimized production build

**What it does:**
- ✅ Checks Node.js installation
- ✅ Installs dependencies if missing
- ✅ Runs `npm run build`
- ✅ Shows build success/failure

**When to use:**
- Before deploying to production
- To test production build locally
- To check for build errors

**Usage:**
```bash
build-app.bat
```

**After successful build:**
- Run `start-production.bat` to test production build

---

### 🌐 **start-production.bat** - Start Production Server
**Purpose:** Run the production build locally

**What it does:**
- ✅ Checks if production build exists
- ✅ Checks if .env.local exists
- ✅ Opens browser automatically
- ✅ Starts production server

**When to use:**
- After running `build-app.bat`
- To test production performance
- Before deploying to hosting

**Usage:**
```bash
# First build, then start
build-app.bat
start-production.bat
```

---

### 🧹 **clear-cache.bat** - Clear Next.js Cache
**Purpose:** Fix cache-related errors and build issues

**What it does:**
- ✅ Removes `.next` folder
- ✅ Removes `node_modules/.cache`
- ✅ Removes `tsconfig.tsbuildinfo`
- ✅ Shows what was cleared

**When to use:**
- ❌ Error: "ENOENT: app-paths-manifest.json"
- ❌ Build errors after updating code
- ❌ Weird behavior or stale data
- ❌ After updating dependencies

**Usage:**
```bash
clear-cache.bat
# Then restart the app
start-app.bat
```

---

### 🔧 **setup-supabase.bat** - Automated Supabase Setup
**Purpose:** Guide you through Supabase setup step-by-step

**What it does:**
- ✅ Opens Supabase dashboard
- ✅ Prompts for API keys
- ✅ Automatically updates .env.local
- ✅ Opens migration files
- ✅ Guides through database setup
- ✅ Tests connection

**When to use:**
- First time setup
- Setting up on a new machine
- If you lost your .env.local file

**Usage:**
```bash
setup-supabase.bat
```

**Follow the prompts:**
1. Create Supabase project
2. Copy API keys when prompted
3. Paste into the wizard
4. Run migrations as instructed
5. Test the app

---

### 🌍 **open-supabase.bat** - Quick Access to Supabase
**Purpose:** Quickly open your Supabase dashboard

**What it does:**
- ✅ Reads your Supabase URL from .env.local
- ✅ Offers menu to open different sections
- ✅ Opens in your default browser

**When to use:**
- Need to check database tables
- Want to run SQL queries
- Need to view API settings
- Managing data

**Usage:**
```bash
open-supabase.bat
```

**Menu options:**
1. Dashboard (Overview)
2. Table Editor
3. SQL Editor
4. API Settings
5. All of the above

---

### 🔍 **troubleshoot.bat** - Diagnostic Tool
**Purpose:** Diagnose common setup and runtime issues

**What it does:**
- ✅ Checks Node.js installation
- ✅ Checks if dependencies installed
- ✅ Checks .env.local configuration
- ✅ Checks for cache issues
- ✅ Checks port availability
- ✅ Provides fix suggestions

**When to use:**
- App won't start
- Getting errors
- Not sure what's wrong
- Before asking for help

**Usage:**
```bash
troubleshoot.bat
```

**Reads the output:**
- ✅ = Everything OK
- ⚠️ = Warning (might cause issues)
- ❌ = Problem found (needs fixing)

---

## 🎯 Common Workflows

### First Time Setup
```bash
1. setup-supabase.bat     # Set up Supabase
2. clear-cache.bat        # Clear any cache
3. start-app.bat          # Start the app
```

### Daily Development
```bash
start-app.bat             # Start and code!
```

### After Pulling New Code
```bash
1. npm install            # Update dependencies
2. clear-cache.bat        # Clear cache
3. start-app.bat          # Start fresh
```

### When You Get Errors
```bash
1. troubleshoot.bat       # Diagnose the issue
2. clear-cache.bat        # Try clearing cache
3. start-app.bat          # Restart
```

### Before Deployment
```bash
1. build-app.bat          # Build for production
2. start-production.bat   # Test production build
```

### Lost Supabase Config
```bash
1. setup-supabase.bat     # Reconfigure
2. clear-cache.bat        # Clear cache
3. start-app.bat          # Start fresh
```

---

## 🆘 Troubleshooting Batch Files

### Batch file won't run
**Problem:** Double-clicking does nothing

**Solutions:**
- Right-click → "Run as administrator"
- Check file extension is `.bat` not `.bat.txt`
- Open Command Prompt and run manually: `.\start-app.bat`

### "Command not found" errors
**Problem:** Node.js or npm not recognized

**Solutions:**
- Install Node.js from https://nodejs.org/
- Restart computer after installing
- Add Node.js to PATH environment variable

### Browser doesn't open automatically
**Problem:** Browser should open but doesn't

**Solutions:**
- Manually open: http://localhost:3000
- Check if popup blocker is active
- Check default browser is set

### Port 3000 already in use
**Problem:** Another app using port 3000

**Solutions:**
- Close other apps using port 3000
- Change port in `package.json`: `"dev": "next dev -p 3001"`
- Update `.env.local`: `NEXT_PUBLIC_APP_URL=http://localhost:3001`

---

## 📝 Tips & Tricks

### Run from Command Line
You can run any batch file from PowerShell or Command Prompt:
```bash
cd "D:\HUE\DEVELOPED SOFTWARE\Supervisors Automated Assign"
.\start-app.bat
```

### Create Desktop Shortcuts
1. Right-click batch file
2. "Send to" → "Desktop (create shortcut)"
3. Rename shortcut to "Start ESMS"

### Run Multiple Commands
Create your own batch file:
```batch
@echo off
call clear-cache.bat
call start-app.bat
```

### Silent Mode
To run without pauses, edit the batch file and remove `pause` commands.

---

## 🔗 Related Documentation

- **COMPLETE_SETUP_GUIDE.md** - Full setup instructions
- **VISUAL_SETUP_GUIDE.md** - Step-by-step with screenshots
- **SUPABASE_QUICK_REFERENCE.md** - Supabase commands
- **QUICK_START.md** - 5-minute quick start

---

**Need more help?** Run `troubleshoot.bat` to diagnose issues!

