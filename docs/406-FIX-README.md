# 406 Error Fix - Complete Documentation Index

This directory contains comprehensive documentation for the fix addressing Supabase 406 (Not Acceptable) errors.

## 📋 Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| [406-ERROR-FIX-SUMMARY.md](406-ERROR-FIX-SUMMARY.md) | Executive summary and impact analysis | All stakeholders |
| [MANUAL-TESTING-GUIDE-406-FIX.md](MANUAL-TESTING-GUIDE-406-FIX.md) | Step-by-step testing instructions | QA, Testers |
| [../SUPABASE-406-FIX.md](../SUPABASE-406-FIX.md) | Technical details and code examples | Developers |

## 🎯 Quick Summary

**Problem:** Users were seeing 406 errors in the console when using share profiles, following users, and viewing user profiles.

**Root Cause:** Database queries used `.single()` which requires exactly 1 row, but returned 0 rows for legitimate "not found" scenarios.

**Solution:** Changed 6 queries from `.single()` to `.maybeSingle()` to gracefully handle 0 or 1 row results.

**Result:** ✅ Zero 406 errors, better UX for new users, all features working correctly.

## 📊 What Was Changed?

### Code Changes
- **File:** `src/services/database.ts`
- **Lines Changed:** 6 (replacing `.single()` with `.maybeSingle()`)
- **Functions Fixed:** 6 database query functions

### Functions Updated
1. `getSharedProfileByShareId()` - Lookup shared profile by ID
2. `getSharedUserProfile()` - Get user profile for shared library
3. `getUserProfile()` - Get user profile info
4. `isFollowing()` - Check if following a user
5. `isFollowingShareId()` - Helper to check following status
6. `getShareProfileByUserId()` - Get share profile by user ID

## 🧪 Testing

### Quick Test
Open browser console and perform these actions:
1. Create a new user account
2. Try to enable sharing
3. Follow another user
4. View a shared library

**Expected:** No 406 errors in console

### Comprehensive Test
See [MANUAL-TESTING-GUIDE-406-FIX.md](MANUAL-TESTING-GUIDE-406-FIX.md) for detailed testing scenarios.

## 📚 Technical Background

### What is `.single()` vs `.maybeSingle()`?

```typescript
// .single() - Expects exactly 1 row
// ❌ Returns 406 error if 0 rows
// ❌ Returns error if 2+ rows
const { data, error } = await supabase
  .from('table')
  .select()
  .single();

// .maybeSingle() - Expects 0 or 1 row
// ✅ Returns null if 0 rows (no error)
// ❌ Returns error if 2+ rows
const { data, error } = await supabase
  .from('table')
  .select()
  .maybeSingle();
```

### When to Use Each

| Operation | Use | Reason |
|-----------|-----|--------|
| SELECT (optional record) | `.maybeSingle()` | Record might not exist |
| INSERT | `.single()` | Always returns 1 row |
| UPDATE | `.single()` | Always returns 1 row |
| UPSERT | `.single()` | Always returns 1 row |

## 🔍 Verification

### Build Status
```bash
npm run build  # ✅ PASSED
npm run lint   # ✅ PASSED
```

### Query Audit
- **Total `.single()` calls:** 6 (all write operations ✅)
- **Total `.maybeSingle()` calls:** 7 (all read operations ✅)

## 📖 Reading Guide

### For Project Managers
Start with: [406-ERROR-FIX-SUMMARY.md](406-ERROR-FIX-SUMMARY.md)
- Understand the impact
- Review the before/after comparison
- Check the verification status

### For QA/Testers
Start with: [MANUAL-TESTING-GUIDE-406-FIX.md](MANUAL-TESTING-GUIDE-406-FIX.md)
- Follow the test scenarios
- Verify no 406 errors appear
- Report any issues found

### For Developers
Start with: [../SUPABASE-406-FIX.md](../SUPABASE-406-FIX.md)
- Review the code changes
- Understand the technical details
- Learn when to use `.single()` vs `.maybeSingle()`

## 🎉 Results

### Before Fix
- ❌ 406 errors for new users
- ❌ Console filled with error messages
- ❌ Confusing error states in UI
- ❌ "Not found" treated as errors

### After Fix
- ✅ Zero 406 errors
- ✅ Clean console output
- ✅ Clear UI states
- ✅ "Not found" handled gracefully

## 🔗 References

- [Supabase .single() vs .maybeSingle()](https://github.com/orgs/supabase/discussions/2284)
- [PostgREST Error Codes](https://postgrest.org/en/stable/references/errors.html)
- [Supabase HTTP Status Codes](https://supabase.com/docs/guides/troubleshooting/http-status-codes)

## 📞 Support

If you encounter any issues:
1. Check the [MANUAL-TESTING-GUIDE-406-FIX.md](MANUAL-TESTING-GUIDE-406-FIX.md)
2. Review the console for error messages
3. Report issues with screenshots and steps to reproduce

---

**Last Updated:** 2026-01-19
**Fix Version:** 1.0.0
**Status:** ✅ Complete and Verified
