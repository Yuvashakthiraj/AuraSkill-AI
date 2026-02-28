# AuraSkill Phase 3: The Matching Engine

## Recent Fixes (Feb 28, 2026)

### 🐛 Fixed Authentication Errors

**Problem:**
- 401 Unauthorized errors when accessing gap analysis
- `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
- API endpoints returning HTML instead of JSON

**Root Cause:**
Token storage mismatch - Auth system stored token as `vidyamitra_token` but GapAnalysis was looking for `token`

**Solution:**
✅ Updated GapAnalysis.tsx to use correct token key: `vidyamitra_token`  
✅ Added proper 401 handling with redirect to login  
✅ Added user-friendly authentication required page  
✅ Added debug logging for authentication state  
✅ Improved error handling to prevent HTML parsing errors  

**Verification:**
1. Make sure you're logged in to the application
2. Navigate to Gap Analysis page
3. Check browser console - you should see: `✅ User authenticated: { id: ..., email: ... }`
4. No 401 errors should appear
5. Analysis should run successfully

---

## Overview

Phase 3 is the intelligent career gap analysis system that compares market demand (Phase 1) with user skills (Phase 2) to produce:

- **Future-Ready Score**: A comprehensive 0-100 score showing job readiness
- **Gap Analysis**: Detailed breakdown of every skill gap with priority classification
- **Profile Conflicts**: Detects contradictions between resume, GitHub, and assessments
- **Learning Roadmap**: Month-by-month study plan with real course recommendations
- **AI Narrative**: Gemini-powered career assessment with personalized insights

## Architecture

### Backend (Node.js/TypeScript)

**New Files:**
- `server/matchingEngine.ts` - Core gap analysis logic
- `server/roadmapGenerator.ts` - Learning roadmap generation
- `server/db.ts` - Added 4 new database tables

**New Database Tables:**
1. `gap_analyses` - Stores complete gap analysis results
2. `learning_roadmaps` - Stores generated learning plans
3. `ai_narrative_cache` - Caches Gemini API responses
4. `user_skill_profiles` - Stores verified skill scores per user

**API Endpoints:**
- `POST /api/analysis/run` - Run gap analysis for a target role
- `GET /api/analysis/:user_id` - Get latest gap analysis
- `POST /api/roadmap/generate` - Generate learning roadmap
- `GET /api/roadmap/:user_id` - Get latest roadmap
- `POST /api/analysis/narrative` - Generate AI career narrative
- `POST /api/analysis/skill-explain` - Get skill-specific guidance

### Frontend (React/TypeScript)

**New Files:**
- `src/pages/GapAnalysis.tsx` - Complete gap analysis dashboard

**Key Features:**
- Animated circular score gauge
- Interactive skill gap table with sorting/filtering
- Profile conflict detection panel
- Mermaid.js learning roadmap flowchart
- AI-generated insights for every skill
- Month-by-month course recommendations

## Scoring System

### Trust Hierarchy for Verified Scores
```
GitHub (50%) > Assessment (30%) > Resume (20%)
```

### Priority Classification
1. **CRITICAL**: Large gap + growing demand (>15% growth)
2. **IMPORTANT**: Moderate gap + stable/growing demand
3. **MONITOR**: Small gap or stable demand
4. **STRENGTH**: User exceeds market requirement
5. **RESKILL_ALERT**: Strong in declining skills

### Future-Ready Score Components
- **Resume Match** (25%): Resume skills vs market requirements
- **GitHub Match** (30%): Proven code activity
- **Assessment** (25%): Live test performance
- **Market Alignment** (20%): Strong in growing vs declining skills

## Conflict Detection

### Types of Conflicts
1. **Claimed but Unproven**: High resume score, low GitHub/assessment
2. **Proven but Unclaimed**: High GitHub, not on resume
3. **Assessment Contradiction**: Large divergence between GitHub and assessment scores

## Learning Roadmap

### Features
- Respects skill dependencies (e.g., Docker before Kubernetes)
- 20 hours/month study capacity
- Real course recommendations from:
  - Coursera, Udemy, freeCodeCamp, Fast.ai
  - Official documentation sites
  - University courses (MIT, Helsinki)
- Mermaid.js visualization with:
  - Phase-based grouping
  - Color-coded priorities
  - Dependency arrows

### Course Database
Over 50+ curated courses for skills including:
- Python, JavaScript, React, TypeScript, Node.js
- Machine Learning, TensorFlow, PyTorch
- Docker, Kubernetes, AWS, Azure
- SQL, Git, Go, Rust

## Usage

### For Users

1. **Run Analysis**:
   ```
   Navigate to /gap-analysis
   Enter target role (e.g., "Full Stack Developer")
   Click "Run Analysis"
   ```

2. **View Results**:
   - Check your Future-Ready Score and grade
   - Review skill gaps table
   - Read AI insights for each critical gap
   - Fix any profile conflicts

3. **Follow Roadmap**:
   - View month-by-month plan
   - Click course links to start learning
   - Track projected score improvement

### For Developers

**Run the server:**
```bash
npm run dev
```

**Test API endpoints:**
```bash
# Run gap analysis
curl -X POST http://localhost:5173/api/analysis/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetRole": "ML Engineer"}'

# Generate roadmap
curl -X POST http://localhost:5173/api/roadmap/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetRole": "ML Engineer"}'
```

## Data Flow

```
User Skill Data (Phase 2)          Market Demand (Phase 1)
       |                                    |
       |                                    |
       v                                    v
[ Resume + GitHub + Assessments ]   [ Job Skills + Trends ]
       |                                    |
       +----------------+-------------------+
                        |
                        v
              [ Matching Engine ]
                        |
            +-----------+-----------+
            |           |           |
            v           v           v
      Gap Analysis  Roadmap   AI Narrative
            |           |           |
            v           v           v
        [ SQLite Database Cache ]
            |           |           |
            v           v           v
      [ GapAnalysis.tsx Frontend ]
```

## Key Algorithms

### 1. Verified Score Calculation
```typescript
verified_score = (
  github_score * 0.5 +
  assessment_score * 0.3 +
  resume_score * 0.2
)
```

### 2. Gap Classification
```typescript
if (gap >= 30 && (trend === 'rising' || growth > 15%)) {
  priority = 'CRITICAL'
} else if (gap >= 15 && trend !== 'declining') {
  priority = 'IMPORTANT'
} else if (gap <= 0 && trend === 'declining') {
  priority = 'RESKILL_ALERT'
} else if (gap <= 0) {
  priority = 'STRENGTH'
} else {
  priority = 'MONITOR'
}
```

### 3. Dependency Resolution
Skills are sorted to respect prerequisites:
- Python → Machine Learning → PyTorch → LLM Fine-tuning
- HTML/CSS/JS → React → Next.js
- Linux/Docker → Kubernetes

## Design System

**Colors (Priority-based):**
- CRITICAL: Red (#dc2626)
- IMPORTANT: Amber (#f59e0b)
- MONITOR: Yellow (#eab308)
- STRENGTH: Green (#10b981)
- RESKILL_ALERT: Gray with strikethrough

**Theme:**
- Background: Navy #0A1628
- Cards: Slate with border/50 opacity
- Accent: Indigo/Violet
- Highlights: Teal

## Performance Optimizations

1. **API Response Caching**:
   - AI narratives cached for 7 days
   - Skill explanations cached for 30 days

2. **Database Indexing**:
   - Indexed on user_id, target_role, created_at

3. **Frontend Optimizations**:
   - Lazy rendering for large tables
   - Debounced sorting/filtering
   - Mermaid charts render once on mount

## Future Enhancements

1. **Real-time skill tracking**: Connect to GitHub webhooks
2. **Interview prep**: Generate mock questions for weak skills
3. **Peer comparison**: See how your score compares to others in same role
4. **Skill marketplace**: Find freelance gigs for specific skills
5. **Progress tracking**: Weekly check-ins to update analysis

## Testing

**To test the complete flow:**

1. Upload resume with verified skills
2. Connect GitHub profile (via ProfileAnalyzer)
3. Complete coding practice sessions
4. Run gap analysis for target role
5. Review all sections of the page
6. Click skill rows for AI explanations
7. View learning roadmap with Mermaid chart
8. Click course links to verify they open

## Troubleshooting

**"No gap analysis found"**
- Run analysis first by entering a target role

**Mermaid chart not rendering**
- Check browser console for errors
- Ensure mermaid package is installed: `npm install mermaid`

**Empty skill gaps**
- Verify resume has been uploaded and parsed
- Check user_skill_profiles table has data
- Ensure external AuraSkill API is running (for market data)

**AI narrative not loading**
- Check GEMINI_API_KEY is configured in .env
- Verify rate limits haven't been exceeded
- Check ai_narrative_cache table

## Credits

- **Matching Engine**: Custom algorithm with trust hierarchy
- **Course Database**: Curated from Coursera, Udemy, freeCodeCamp, official docs
- **AI Narratives**: Powered by Google Gemini 2.0 Flash
- **Roadmap Visualization**: Mermaid.js
- **UI Components**: shadcn/ui, Radix UI, Tailwind CSS

---

**Built as Phase 3 of AuraSkill - The Career Intelligence Platform**
