# Plan: Add Friends List for Shared Libraries

Add a friends list feature that lets users save shared library profiles for quick access. Friends are tracked one-way (like follows) and linked via share IDs for privacy. Invitation-based only via share URLs with full search, sort, and comparison features.

## Steps

1. **Create database schema** by adding a `friend_lists` table in [supabase/schema.sql](supabase/schema.sql) with columns for `id` (UUID primary key), `user_id` (references `auth.users`), `friend_share_id` (references `share_profiles.share_id`), `nickname` (text, max 50 chars check constraint), `added_at` (timestamp), unique constraint on `(user_id, friend_share_id)`, and RLS policies allowing users CRUD on their own friends.

2. **Implement friend management functions** in [src/services/database.ts](src/services/database.ts) for both Supabase and localStorage modes: `addFriend(userId, shareId, nickname)`, `removeFriend(userId, friendId)`, `getFriends(userId)` returning array with friend profiles/avatars/game counts, `isFriend(userId, shareId)` for duplicate detection, `updateFriendNickname(userId, friendId, newNickname)`, and `getUserShareProfile(userId)` to check if user has sharing enabled.

3. **Create AddFriendModal component** at [src/components/AddFriendModal.tsx](src/components/AddFriendModal.tsx) following [ManualAddGameModal.tsx](src/components/ManualAddGameModal.tsx) patterns: text input for share URL/ID extraction (regex to extract UUID from URLs like `/shared/{uuid}`), fetches profile via `getSharedUserProfile()` on input blur/button click, shows 64px avatar (or `switch.svg` fallback), pre-fills nickname input (max 50 chars) with fetched `displayName`, validates enabled profiles, checks duplicates via `isFriend()`, shows error states for invalid/disabled shares.

4. **Create RemoveFriendModal component** at [src/components/RemoveFriendModal.tsx](src/components/RemoveFriendModal.tsx) matching delete game confirmation pattern from [Library.tsx](src/pages/Library.tsx), displays friend nickname, "Are you sure you want to remove this friend?" message, Cancel (`.btn-cancel`) and Remove (`.btn-delete`) buttons.

5. **Create EditNicknameModal component** at [src/components/EditNicknameModal.tsx](src/components/EditNicknameModal.tsx) with single text input pre-filled with current nickname (max 50 chars, validation), Save/Cancel buttons, calls `updateFriendNickname()` on submit.

6. **Create Friends page** at [src/pages/Friends.tsx](src/pages/Friends.tsx) with search input filtering by nickname, sort dropdown ("Date Added ↓", "Date Added ↑", "Nickname A-Z", "Nickname Z-A", "Most Games", "Fewest Games"), grid/list/compact view toggle matching [Library.tsx](src/pages/Library.tsx), friend cards showing avatar (with `switch.svg` fallback), nickname, game count, action buttons (View Library → `/shared/{shareId}`, Compare button that on-click fetches `getUserShareProfile()` and either navigates to `/compare/{userShareId}/{friendShareId}` or shows tooltip "Enable sharing in Settings to compare libraries", Edit Nickname, Remove), "Add Friend" button in header, empty state with instructions ("Visit a shared library and click 'Add Friend' to save them here") and example share URL format.

7. **Add "Add Friend" integration** to [SharedLibrary.tsx](src/pages/SharedLibrary.tsx) with button in header near user info that triggers `AddFriendModal`, passes current `shareId` and pre-fetched `userInfo.displayName` to pre-fill nickname, checks `isFriend()` on mount to conditionally render "Add Friend" button or "✓ In Friends List" indicator with link to `/friends`.

8. **Update routing and navigation** by adding `/friends` route in [App.tsx](src/App.tsx) with `ProtectedRoute` wrapper, and adding "Friends" navigation link in [Header.tsx](src/components/Header.tsx) between "Library" and "Settings" when authenticated.

9. **Update homepage feature section** in [Home.tsx](src/pages/Home.tsx) by updating the "Share & Compare" feature card (🔗 icon) text to: "Share your collection with friends, save their libraries to your friends list for quick access, and easily compare collections to find games in common."

## Further Considerations

1. **Compare button logic** - Fetch logged-in user's `share_profiles.enabled` status on-demand when clicking Compare button to determine tooltip vs navigation.

2. **Nickname character limit** - Enforce 50 character max length in both modal validation and database schema check constraint.

3. **Friend count display** - Show page title as "Friends" without count in header.
