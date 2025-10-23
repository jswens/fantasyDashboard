# Deployment Guide - Fantasy League Dashboard

## 🎯 Best Free Hosting Options for Your App

Your Next.js fantasy league dashboard is **perfect for free tier hosting** because:
- ✅ Small user base (12 team owners)
- ✅ JSON file-based data storage
- ✅ API routes work on serverless platforms
- ✅ Infrequent data updates
- ✅ Low concurrent usage

---

## 🚀 Option 1: Vercel (Recommended - Best for Next.js)

### Why Vercel?
- **Native Next.js support** (created by Next.js team)
- **Generous free tier**: 100GB bandwidth, 1000 functions/day
- **Automatic deployments** from Git
- **Built-in analytics and performance monitoring**
- **Edge functions** for fast API responses

### Step-by-Step Deployment:

#### 1. **Prepare Your Repository**
```bash
# Ensure your app builds successfully
npm run build

# Create .env.example for documentation
cp .env.local .env.example
```

#### 2. **Create .env.example**
```bash
# Copy your current .env.local but remove sensitive values
NEXT_PUBLIC_SLEEPER_LEAGUE_ID=your_league_id_here
FREE_AGENTS_PASSWORD=your_password_here
```

#### 3. **Push to GitHub**
```bash
# Initialize git repository (if not already done)
git init
git add .
git commit -m "Initial commit: Fantasy League Dashboard"

# Create GitHub repository and push
git branch -M main
git remote add origin https://github.com/yourusername/fantasy-league-dashboard.git
git push -u origin main
```

#### 4. **Deploy to Vercel**
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click "New Project"
3. Import your GitHub repository
4. Configure settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

#### 5. **Set Environment Variables**
In Vercel dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SLEEPER_LEAGUE_ID = 1257419382598942720
FREE_AGENTS_PASSWORD = your_secure_password
```

#### 6. **Deploy!**
- Vercel automatically builds and deploys
- You'll get a URL like: `https://fantasy-league-dashboard-xyz.vercel.app`
- Every git push triggers automatic redeployment

### Vercel Free Tier Limits:
- ✅ **Bandwidth**: 100GB/month (more than enough)
- ✅ **Function Executions**: 1000/day (perfect for your use case)
- ✅ **Build Minutes**: 6000/month
- ✅ **Custom Domains**: Yes (free)

---

## 🌐 Option 2: Netlify (Great Alternative)

### Why Netlify?
- **Excellent for static sites** with serverless functions
- **Form handling** and authentication features
- **Split testing** capabilities
- **CDN** for fast global delivery

### Step-by-Step Deployment:

#### 1. **Configure for Static Export** (Required for Netlify)
Update `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
```

#### 2. **Create Netlify Functions**
Create `netlify/functions/` directory and move API routes:
```bash
mkdir -p netlify/functions
# Convert your API routes to Netlify functions format
```

#### 3. **Deploy via Git**
1. Push to GitHub (same as Vercel steps 1-3)
2. Go to [netlify.com](https://netlify.com) and sign up
3. Click "New site from Git"
4. Connect GitHub and select repository
5. Configure build settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `out`

### Netlify Free Tier Limits:
- ✅ **Bandwidth**: 100GB/month
- ✅ **Build Minutes**: 300/month
- ✅ **Functions**: 125K requests/month
- ✅ **Forms**: 100 submissions/month

---

## ☁️ Option 3: Railway (Good for Full-Stack Apps)

### Why Railway?
- **Database support** (if you want to upgrade from JSON files)
- **Environment variable management**
- **Automatic HTTPS**
- **Simple deployment process**

### Deployment Steps:
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

### Railway Free Tier:
- ✅ **$5 credit/month** (usually enough for small apps)
- ✅ **512MB RAM** per service
- ✅ **1GB storage**

---

## 📦 Deployment Preparation Checklist

### 1. **Code Cleanup**
```bash
# Remove test files
rm test-*.js analyze-zero-cap.js

# Clean up logs and temp files
rm -rf .next node_modules

# Install fresh dependencies
npm ci
```

### 2. **Environment Variables Setup**
Create `.env.example`:
```bash
# Sleeper League Configuration
NEXT_PUBLIC_SLEEPER_LEAGUE_ID=your_league_id_here

# Free Agents Feature (when implemented)
FREE_AGENTS_PASSWORD=your_secure_password_here
```

### 3. **Build Verification**
```bash
# Test production build locally
npm run build
npm run start

# Test at http://localhost:3000
# Verify all features work
```

### 4. **Data Files Preparation**
Ensure these files are in your repo:
```
data/
├── capsheet.csv          # Required
├── players.json          # Optional (will be generated)
└── processed-players-cache.json  # Optional (will be generated)
```

### 5. **Security Check**
```bash
# Ensure sensitive data isn't committed
cat .gitignore

# Should include:
# .env*.local
# .env
# /data/*-cache.json (if you want fresh data on each deploy)
```

---

## 🔧 Platform-Specific Configurations

### For Vercel (Recommended):
Create `vercel.json`:
```json
{
  "functions": {
    "src/pages/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### For Static Hosting (Netlify):
Create `_redirects` file in `public/`:
```
/api/* /.netlify/functions/:splat 200
/* /index.html 200
```

---

## 🚀 Recommended Deployment Flow

### **Best Choice: Vercel**
1. ✅ **Push to GitHub**
2. ✅ **Connect to Vercel** 
3. ✅ **Set environment variables**
4. ✅ **Deploy automatically**

### **Why Vercel is Best for You:**
- **Zero configuration** for Next.js
- **Serverless functions** work perfectly with your API routes
- **JSON file persistence** across deployments
- **Automatic HTTPS** and CDN
- **Custom domain** support (free)
- **Analytics** to track usage

### **Post-Deployment:**
1. **Test all features** on production URL
2. **Set up custom domain** (optional)
3. **Monitor performance** via Vercel dashboard
4. **Enable automatic deployments** for future updates

---

## 💰 Cost Breakdown

### Vercel Free Tier (Recommended):
- **Cost**: $0/month
- **Perfect for**: Your use case (12 users, low traffic)
- **Upgrade Path**: Pro plan ($20/month) if you exceed limits

### Your Expected Usage:
- **Daily API calls**: ~50-100 (well under 1000 limit)
- **Monthly bandwidth**: ~1-5GB (well under 100GB limit)
- **Build frequency**: ~5-10/month (well under limits)

---

## 🎉 Quick Start Command

Want to deploy right now? Run this:

```bash
# 1. Build and test locally
npm run build && npm run start

# 2. Push to GitHub (if not already done)
git add . && git commit -m "Ready for deployment"
git push origin main

# 3. Go to vercel.com, import your repo, and deploy!
```

Your fantasy league dashboard will be live in under 5 minutes! 🚀
