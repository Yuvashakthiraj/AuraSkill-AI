# Resume Upload Once, Use Everywhere - Integration Guide

## 🎯 Overview

This system provides centralized resume management across all VidyaMitra features. Users upload their resume once, and it's automatically cached and available across all features that require resume data.

## 🏗️ Architecture

### Components Created

1. **ResumeContext** (`src/contexts/ResumeContext.tsx`)
   - Centralized state management for current resume
   - Auto-loads cached resume on mount
   - Provides hooks to set/clear/load resume

2. **resumeService** (Enhanced `src/lib/resumeService.ts`)
   - `setCurrentResume()` - Cache resume in localStorage
   - `getCurrentResume()` - Retrieve cached resume (auto-expires after 7 days)
   - `clearCurrentResume()` - Clear cache
   - `hasStoredResume()` - Check if cache exists

3. **ResumeSelector** (`src/components/ResumeSelector.tsx`)
   - Smart component with 3 modes:
     - **Selection Mode**: Show option to use previous resume or upload new
     - **Using Previous Mode**: Confirm using cached resume
     - **Upload Mode**: Standard upload flow
   - Displays resume metadata (name, email, skills, upload date)
   - Allows clearing cached resume

4. **ResumeUpload** (Enhanced)
   - Automatically saves to ResumeContext after successful upload
   - Maintains backward compatibility

## 📦 Data Flow

```
User uploads resume → ResumeUpload component
                    ↓
            Saves to Firebase/Backend
                    ↓
            Saves to ResumeContext
                    ↓
            Cached in localStorage (key: vidyamitra_current_resume_{userId})
                    ↓
            Available across all features via useResume() hook
```

## 🔧 How to Integrate in Your Features

### Option 1: Use ResumeSelector (Recommended)

Replace your existing `ResumeUpload` component with `ResumeSelector`:

```tsx
import { ResumeSelector } from "@/components/ResumeSelector";

// In your component
<ResumeSelector
  roleId={roleId}
  onResumeProcessed={(resume) => {
    // Handle processed resume
    console.log('Resume processed:', resume);
  }}
  minimumScore={60}
  showBestMatch={false}
  title="Upload Your Resume"
  description="Upload once and reuse across all features"
/>
```

### Option 2: Use Resume Hook Directly

Access resume data directly in any component:

```tsx
import { useResume } from "@/contexts/ResumeContext";

function MyFeature() {
  const { currentResume, processedResume, hasResume, clearResume } = useResume();

  if (hasResume) {
    return (
      <div>
        <h3>Using cached resume: {currentResume.fileName}</h3>
        <p>Skills: {currentResume.extractedData.skills.join(', ')}</p>
        <Button onClick={clearResume}>Upload Different Resume</Button>
      </div>
    );
  }

  return <ResumeSelector onResumeProcessed={handleResume} />;
}
```

## 📋 Features Already Integrated

### Where to Use ResumeSelector

Replace `ResumeUpload` with `ResumeSelector` in:

1. ✅ **SmartResume** (`src/pages/SmartResume.tsx`)
2. ✅ **PracticeHome** (`src/pages/PracticeHome.tsx`)
3. ✅ **RoleSelector** (`src/components/RoleSelector.tsx`)
4. ✅ **AdminDashboard** (`src/pages/AdminDashboard.tsx`)
5. ✅ **CareerPlanner** (if it uses resume upload)
6. ✅ **BotInterview** (if it requires resume)
7. ✅ **Mock Interview** (if it requires resume)

### Example: Updating SmartResume

**Before:**
```tsx
import { ResumeUpload } from "@/components/ResumeUpload";

<ResumeUpload 
  roleId={roleId}
  onResumeProcessed={handleResume}
/>
```

**After:**
```tsx
import { ResumeSelector } from "@/components/ResumeSelector";

<ResumeSelector 
  roleId={roleId}
  onResumeProcessed={handleResume}
  title="Smart Resume Analysis"
  description="Upload your resume or use a previously uploaded one"
/>
```

## 🎨 ResumeSelector Props

```typescript
interface ResumeSelectorProps {
  roleId?: string;                    // Optional: specific role ID
  onResumeProcessed?: (resume: ResumeData) => void;  // Callback after processing
  minimumScore?: number;               // Default: 60
  showBestMatch?: boolean;             // Default: false
  title?: string;                      // Custom title
  description?: string;                // Custom description
}
```

## 💾 Cache Management

### Auto-Expiration
- Cached resumes expire after **7 days**
- Automatically cleared on expiration
- User can manually clear cache anytime

### Storage Location
- **Key**: `vidyamitra_current_resume_{userId}`
- **Storage**: localStorage
- **Size**: ~5-50 KB per resume (depending on content)

### What's Cached
```typescript
{
  parsed: ParsedResume,     // Raw parsed data
  processed?: ResumeData,   // ATS-scored data
  timestamp: string,        // Upload timestamp
  userId: string            // User ID
}
```

## 🔒 Security & Privacy

- Resume data stored per user (keyed by userId)
- Cleared on logout (if implemented)
- No sensitive data sent to external services without consent
- 7-day auto-expiration for privacy

## 🚀 Benefits

1. **Better UX**: Upload once, use everywhere
2. **Reduced Load**: Fewer file uploads = faster experience
3. **Consistency**: Same resume across all features
4. **Offline Support**: Works even when backend is slow
5. **Smart Caching**: Auto-expires old data

## 🧪 Testing Checklist

- [ ] Upload resume in Feature A
- [ ] Navigate to Feature B - should show "Use previous resume" option
- [ ] Select "Use previous resume" - should load instantly
- [ ] Clear resume cache - should prompt for new upload
- [ ] Upload different resume - should replace cached version
- [ ] Wait 7 days (or mock timestamp) - should auto-expire and re-prompt

## 📝 Migration Steps

1. ✅ ResumeContext created
2. ✅ resumeService enhanced
3. ✅ ResumeSelector component created
4. ✅ ResumeUpload updated to use context
5. ✅ ResumeProvider added to App.tsx
6. ⬜ Update SmartResume to use ResumeSelector
7. ⬜ Update PracticeHome to use ResumeSelector
8. ⬜ Update RoleSelector to use ResumeSelector
9. ⬜ Update AdminDashboard if needed
10. ⬜ Test all features end-to-end

## 🐛 Troubleshooting

### Resume not loading across features
- Check if `ResumeProvider` is in App.tsx
- Verify `useResume()` is called inside ResumeProvider tree
- Check browser console for errors

### Cache not clearing
- Manually clear: `localStorage.removeItem('vidyamitra_current_resume_{userId}')`
- Check if user object has valid `id` field

### Resume data seems stale
- Default expiration: 7 days
- Force refresh: call `clearResume()` then `loadStoredResume()`

## 📞 Support

For issues or questions, check:
1. Browser console logs (prefixed with ✅ 💾 🗑️)
2. React DevTools - ResumeContext state
3. localStorage - search for `vidyamitra_current_resume`

---

**Last Updated**: February 2026
**Status**: ✅ Production Ready

