# Windows Setup Guide for ADHD Accountability Bot

## Prerequisites

### Option 1: Visual Studio Build Tools (Recommended)
Install Visual Studio Build Tools to compile native modules:

1. Download and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. During installation, select "C++ build tools" workload
3. Include Windows 10/11 SDK

### Option 2: Using Pre-compiled Binaries
If you encounter compilation issues, you can try:

```bash
npm install --target-platform=win32 --target-arch=x64 --fallback-to-build=false
```

### Option 3: Alternative SQLite Package
Replace `better-sqlite3` with `sqlite3` in package.json:

```json
{
  "dependencies": {
    "sqlite3": "^5.1.6",
    "dayjs": "^1.11.13",
    "dotenv": "^16.4.5",
    "telegraf": "^4.16.3",
    "node-cron": "^3.0.3"
  }
}
```

## Setup Steps

1. **Clone and navigate to the bot directory:**
   ```bash
   cd adhd-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   
   If this fails, try with node-gyp verbose logging:
   ```bash
   npm install --loglevel verbose
   ```

3. **Setup environment:**
   ```bash
   copy .env.example .env
   ```
   
   Edit `.env` and add your Telegram bot token from [@BotFather](https://t.me/BotFather)

4. **Initialize database:**
   ```bash
   npm run db:reset
   ```

5. **Start the bot:**
   ```bash
   npm run dev
   ```

## Troubleshooting

### Visual Studio Errors
If you see "Could not find any Visual Studio installation":

1. Install Visual Studio 2022 Community with C++ development tools
2. Or install only Visual Studio Build Tools with C++ workload
3. Restart your terminal/command prompt

### Python Errors
Ensure Python 3.x is installed and available in PATH:
```bash
python --version
```

### Alternative: Using WSL
For a smoother experience on Windows, consider using WSL2:

1. Install WSL2 with Ubuntu
2. Install Node.js in WSL2
3. Clone and run the bot from within WSL2

## Production Deployment

For production deployment on Windows Server:

1. Use Windows Service wrapper (node-windows)
2. Set up proper logging
3. Configure process monitoring
4. Set up automated backups

## Database Location

The SQLite database will be created at:
```
./data/adhd.sqlite
```

Ensure this directory exists and has write permissions.