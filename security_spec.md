# Firestore Security Threat Model & Spec

## Data Invariants
1. A user can only access their own user document `/users/{userId}` and nested resources.
2. A user can only access, create, or modify their own archived duty dates `/users/{userId}/dutyDates/{dateId}`.
3. Nested items under `/users/{userId}/dutyDates/{dateId}/newPatients`, `generalOrders`, and `handovers` must belong to the active user and contain timestamps validated against `request.time`.

## The "Dirty Dozen" Threat Payloads
Here are twelve payloads designed to test and violate security boundaries, which our rules must strictly deny:
1. **Unauthenticated User Profile Retrieval**: Read `/users/attacker_uid` when signed out. (Deny)
2. **Identity Theft Draft**: Creating a user profile document with user ID `victim_uid` but authorized as `attacker_uid`. (Deny)
3. **Cross-Tenant Duty Date Read**: Reading `/users/victim_uid/dutyDates/2026-05-25` as `attacker_uid`. (Deny)
4. **Cross-Tenant Duty Date Append**: Modifying `/users/victim_uid/dutyDates/2026-05-25` as `attacker_uid`. (Deny)
5. **Backdated Timestamp Injection**: Creating/Updating a patient with client-supplied `createdAt = 2020-01-01` rather than `request.time`. (Deny)
6. **Bypassing Patient Schema**: Inserting field `shadow_field: "malicious"` under newPatients. (Deny)
7. **Cross-Tenant Order Retrieval**: Listing generalOrders under another user's path. (Deny)
8. **Malicious ID Injection**: Creating a DutyDate with ID `invalid//id` containing unsafe characters. (Deny)
9. **Unverified Email Access**: Creating a profile when authenticated but with `email_verified == false`. (Deny)
10. **State Corruption Check**: Attempting to bypass validations during updates for generalOrders. (Deny)
11. **Malicious Key Extension**: Attempting to inject extra attributes during updates inside affectedKeys. (Deny)
12. **Denial of Wallet Size Violation**: Inserting a mattress payload (diagnosis of 100KB) into a new patient. (Deny)

## FireStore Rules Test Blueprint (Conceptual)
```typescript
// firestore.rules.test.ts
// Verifies that all the payloads above return PERMISSION_DENIED.
```
