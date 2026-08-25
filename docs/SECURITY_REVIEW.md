# LearnOrbit Security Review & AI Development Security Guide

**Project:** LearnOrbit
**Purpose:** Security guidance for Claude Code and human developers
**Scope:** Full-stack LearnOrbit V1
**Security standard:** Defense-in-depth, least privilege, secure-by-default

---

## 1. Purpose

This document defines the security requirements Claude Code must follow when developing, modifying, reviewing, or refactoring LearnOrbit.

LearnOrbit is an education/social/video platform with potentially sensitive user data, teacher and student accounts, organizations/channels, educational videos, Shorts, documents, follows, comments, and other user-generated content.

Security must be treated as a first-class requirement.

Claude must **not assume that existing code is secure simply because it already exists**. Existing patterns should be reused only after verifying that they are appropriate and secure.

---

## 1a. Status Index — reconciled 2026-08-24 (pre-Phase-9F)

**This is not a new checklist.** It is a status view over the items already defined below,
using their own numbering and wording. Every requirement in §2–§56 appears exactly once.
Full per-item evidence is in the **Re-verification Record** at the end of this document;
the original §54 checklist is marked in place at its own location.

**Legend:** `[x]` verified fixed/mitigated with code+test evidence · `[ ] OPEN` still
outstanding, LearnOrbit-owned · `[ ] DEFERRED` outstanding, intentionally scheduled ·
`[ ] INHERITED` outstanding only in unmodified upstream LearnHouse code/infrastructure ·
`[ ] N/A` not applicable to V1.

A section is `[x]` only when **nothing** remains outstanding for it.

### Outstanding items (the short list)

| Item | Wording as written below | Status | Severity | What remains |
|---|---|---|---|---|
| §11 | Cross-Site Request Forgery (CSRF) | `[ ] DEFERRED` | MEDIUM | **F3** — `CSRFProtectionMiddleware` written+tested, never registered in `app.py` |
| §54 item 9 | Is CSRF addressed where applicable? | `[ ] DEFERRED` | MEDIUM | **F3** |
| §15 | SSRF | `[ ] INHERITED` | LOW | Guard itself verified; `next.config.js` `images.remotePatterns: '**'` gives the Next image optimizer an arbitrary-host server-side fetch |
| §30 | Security Headers | `[ ] INHERITED` | LOW | No `Permissions-Policy` header |
| §34 | Docker / Container Security | `[ ] INHERITED` | LOW | `apps/api/Dockerfile` has no `USER` — API container runs as root |
| §35 | CI/CD Security | `[ ] INHERITED` | LOW | No `permissions:` block in any `.github/workflows/` file |
| §43 | Payment Security | `[ ] N/A` | — | Stripe is EE-only (`ee/services/payments/`), absent from this build and out of V1 scope |

**No Critical or High severity item is outstanding.**
**No OPEN item remains in LearnOrbit-owned code.** Both findings raised by this audit were
resolved on 2026-08-24: the quiz time limit (§2.19 / §45 / §54.23) and the link-preview
error-detail leak (§19 / §54.15). **F2 rate limiting (§2 rule 17 / §21 / §22 / §54.16 /
§54.17) was implemented on 2026-08-24** — see the *Rate Limiting (F2)* note at the end of
this document. Everything still outstanding is either deferred by plan (F3) or inherited
infrastructure — see the notes at the end of this document.

### Everything else

`[x]` **verified** — §2 rules 1–20 · §3 (all five attacker types) · §4 Authentication ·
§5 Authorization · §6 Multi-Tenant Isolation · §7 API Security · §8 Input Validation ·
§9 SQL Injection · §10 XSS · §12 CORS · §13 File Upload Security · §14 Video and Short Security ·
§16 Path Traversal · §17 Secrets Management · §18 Environment Configuration · §19 Error
Handling · §20 Logging and Monitoring · §23 Database Security · §24 ORM Security · §25 Data Exposure · §26 Account
Enumeration · §27 User-Generated Content · §28 URL Security · §29 Open Redirects · §31 HTTPS /
Transport Security · §32 Cookie Security · §33 Dependency Security · §36 Git Security ·
§37 Frontend Security · §38 Search and Discovery · §39 Pagination and Resource Enumeration ·
§21 Rate Limiting and Abuse Prevention · §22 Denial of Service ·
§40 Caching Security · §41 Background Jobs · §42 AI-Specific Security · §44 Webhooks ·
§45 Business Logic Vulnerabilities · §46 Race Conditions · §47 Sensitive Operations · §48 Privacy · §49 Data Deletion ·
§50 Security Testing Requirements · §51–§53, §55, §56 · §54 items 1–8, 10–24.

**Totals: 101 items — 94 `[x]` · 0 `[ ] OPEN` · 2 `[ ] DEFERRED` · 4 `[ ] INHERITED` · 1 `[ ] N/A`.**

Two caveats that are **not** defects and do not change any status:

* **Browser-level cross-organization isolation (§6, §3 "malicious organization member")** is
  verified at service and router level only. It cannot be exercised in a browser locally —
  `hosting_config.tenancy: single` collapses org routing onto the seeded default org, and
  `tenancy: multi` is hard-rejected whenever the domain contains "localhost".
* **§49 Data Deletion** is `[x]`: every engagement row cascades. `delete_channel_video`
  deliberately leaves the underlying `Activity` because it may still be a course lesson
  (`docs/ARCHITECTURE.md` § "Videos (Phase 2A)"); it stays authorization-gated, so nothing
  becomes *unauthorized*-orphaned.


# 2. Core Security Rules

Claude must follow these rules for every feature:

1. Never trust client-side input.
2. Never rely on frontend authorization.
3. Enforce authorization on the server.
4. Validate all untrusted input.
5. Use parameterized database queries/ORM APIs.
6. Never expose secrets to the frontend.
7. Never hard-code credentials or API keys.
8. Follow existing authentication/session mechanisms.
9. Preserve tenant/organization isolation.
10. Use least privilege.
11. Fail securely.
12. Do not expose unnecessary information in API responses.
13. Do not log passwords, tokens, secrets, or sensitive personal data.
14. Do not disable security controls merely to make tests pass.
15. Do not introduce a dependency unless necessary.
16. Validate file uploads independently of file extensions.
17. Rate-limit security-sensitive and abuse-prone endpoints.
18. Treat AI-generated code as untrusted until reviewed and tested.
19. Security checks must be performed server-side.
20. Do not weaken existing security for convenience.

---

# 3. Threat Model

Claude should consider at least these attacker types:

### Anonymous attacker

Can attempt to:

* access public APIs
* enumerate resources
* bypass authentication
* exploit public upload endpoints
* abuse search/discovery
* attack registration/login
* inject malicious content

### Authenticated normal user

Can attempt to:

* access another user's resources
* modify another user's content
* access private resources
* escalate privileges
* manipulate organization/channel IDs
* bypass UI restrictions
* abuse uploads
* abuse social features

### Malicious creator/teacher

Can attempt to:

* access other organizations
* manipulate content ownership
* access student information
* upload malicious files
* abuse moderation systems
* exploit creator-specific permissions

### Compromised account

Assume an attacker has valid credentials for a normal user.

Security must still prevent the attacker from:

* becoming an administrator
* accessing unrelated organizations
* accessing other users' private data
* accessing server secrets
* modifying resources they don't own

### Malicious organization member

Should not automatically gain access to:

* other organizations
* system administration
* other users' private information
* unrelated channels/resources

---

# 4. Authentication

Review all authentication flows.

Check:

* Login
* Logout
* Registration
* Password reset
* Email verification
* Session management
* Token handling
* OAuth/social login if present
* Account deletion
* Account recovery
* Session expiration
* Concurrent sessions

### Verify

* Passwords are hashed using an appropriate password hashing algorithm.
* Passwords are never stored in plaintext.
* Passwords never appear in logs.
* Password reset tokens are cryptographically secure.
* Password reset tokens expire.
* Reset tokens cannot be reused.
* Authentication tokens cannot be fabricated or modified.
* Sessions are invalidated correctly on logout where applicable.
* Authentication state is not trusted from client-controlled fields.
* Protected APIs reject unauthenticated requests.
* Authentication errors do not unnecessarily reveal whether an account exists.

### Check for

* Authentication bypass
* JWT vulnerabilities
* Weak token generation
* Token leakage
* Session fixation
* Session hijacking
* Missing expiration
* Incorrect cookie configuration
* Password reset abuse
* Account enumeration
* Credential stuffing
* Brute-force attacks

---

# 5. Authorization

Authorization is one of the highest-priority areas for LearnOrbit.

Authentication alone is insufficient.

For every protected operation ask:

> Who is allowed to perform this operation on this exact resource?

Check authorization at the API/service/database layer.

Never rely only on:

* hidden buttons
* disabled frontend controls
* route guards
* UI visibility
* client-side role checks

### Test for IDOR/BOLA

For every resource endpoint, attempt:

```text
User A → resource belonging to User B
```

Examples:

```text
GET /videos/{other_user_video}
PUT /videos/{other_user_video}
DELETE /videos/{other_user_video}

GET /organizations/{other_org}
GET /channels/{other_channel}

PUT /resources/{other_resource}
DELETE /resources/{other_resource}
```

Changing an ID must never bypass authorization.

### Test privilege escalation

Attempt:

```text
student → teacher
student → creator
user → organization admin
organization member → organization owner
normal user → platform admin
```

Also test horizontal privilege escalation:

```text
User A → User B's resources
Teacher A → Teacher B's resources
Organization A → Organization B's resources
```

---

# 6. Multi-Tenant / Organization Isolation

LearnOrbit uses organizations/channels as an important architectural boundary.

Treat organization isolation as a critical security boundary.

Every organization-scoped resource must be checked against the authenticated user's organization membership/permissions.

Check:

* Organizations
* Channels
* Videos
* Shorts
* Educational resources
* Posts
* Comments
* Follows
* Creator resources
* Organization settings
* Organization members
* Organization-specific configuration

Never trust an organization ID supplied by the frontend.

Example attack:

```text
User belongs to Organization A

Request:
organization_id=Organization_B
```

The server must reject access unless the user is legitimately authorized for Organization B.

Check for:

* Cross-tenant data leakage
* Cross-tenant modification
* Cross-tenant deletion
* Cross-tenant search results
* Cross-tenant API responses
* Cross-tenant file access
* Cross-tenant caching
* Cross-tenant analytics leakage

---

# 7. API Security

Review every API endpoint.

For each endpoint document:

```text
Authentication required?
Authorization required?
Allowed roles?
Allowed organization?
Allowed resource owner?
Input validation?
Rate limiting?
Sensitive data returned?
Error handling?
```

Check for:

* Missing authentication
* Missing authorization
* HTTP method bypass
* Excessive data exposure
* Mass assignment
* Parameter tampering
* IDOR/BOLA
* API enumeration
* Missing rate limiting
* Verbose errors
* Unsafe defaults

### Mass assignment

Do not allow clients to modify arbitrary model fields.

Dangerous example:

```json
{
  "name": "Normal User",
  "is_admin": true,
  "role": "admin"
}
```

The server must explicitly define which fields users are allowed to modify.

---

# 8. Input Validation

Treat all client-controlled data as hostile.

Validate:

* Query parameters
* Path parameters
* Request bodies
* Headers
* Form fields
* File metadata
* URLs
* Search queries
* Comments
* Descriptions
* Usernames
* Organization names
* Channel information

Use:

* schema validation
* type validation
* length limits
* range limits
* allowed-value validation
* business-rule validation

Never rely solely on frontend validation.

---

# 9. SQL Injection

Check every database interaction.

Avoid dynamically constructed SQL such as:

```python
query = f"SELECT * FROM users WHERE id = {user_id}"
```

Use:

* ORM query builders
* parameterized queries
* safely bound parameters

Review:

* search
* filtering
* sorting
* pagination
* admin queries
* reporting
* analytics
* raw SQL
* migration scripts

Special attention should be given to user-controlled `ORDER BY`, filters, and search expressions.

---

# 10. Cross-Site Scripting (XSS)

LearnOrbit contains user-generated content.

Review:

* Comments
* Video descriptions
* Short descriptions
* Channel descriptions
* User profiles
* Posts
* Educational resource metadata
* Search results
* Rich text
* Markdown
* HTML rendering

Prevent:

* Stored XSS
* Reflected XSS
* DOM XSS

Do not render arbitrary HTML unless it is explicitly sanitized.

Pay special attention to:

```text
dangerouslySetInnerHTML
innerHTML
HTML rendering libraries
Markdown renderers
rich text editors
user-provided URLs
```

---

# 11. Cross-Site Request Forgery (CSRF)

Review state-changing requests.

Especially:

```text
POST
PUT
PATCH
DELETE
```

Verify the application's authentication mechanism and CSRF protections are appropriate.

Check:

* cookies
* SameSite configuration
* CSRF tokens where required
* origin validation
* cross-origin requests

Do not assume CORS is CSRF protection.

---

# 12. CORS

Review CORS configuration.

Never use overly permissive production configuration such as:

```text
Access-Control-Allow-Origin: *
```

when credentials/authenticated requests require a restricted origin.

Check:

* allowed origins
* allowed methods
* allowed headers
* credentials
* preflight behavior

Avoid reflecting arbitrary `Origin` headers.

---

# 13. File Upload Security

This is a critical LearnOrbit area.

Users may upload:

* Videos
* Shorts
* PDFs
* Images
* Educational resources

Check:

### File validation

Do not trust:

```text
filename
extension
Content-Type
```

Validate actual file characteristics where appropriate.

### Limits

Enforce:

* Maximum file size
* Maximum request size
* Maximum upload duration where applicable
* Resource quotas

### Storage

Uploaded files should not become executable server-side code.

Use controlled storage.

Avoid placing arbitrary user uploads directly into executable web directories.

### Filenames

Never use user-provided filenames directly as filesystem paths.

Prevent:

```text
../
..\ 
absolute paths
path traversal
```

Generate safe server-side object/file identifiers.

### Malware

Consider malware scanning where appropriate for uploaded documents/files.

### Authorization

A user must not be able to access another user's private uploaded files merely by changing an ID or URL.

---

# 14. Video and Short Security

Review:

* Upload authorization
* Ownership
* Organization ownership
* Visibility
* Private/public state
* Deletion
* Replacement
* Metadata modification
* Thumbnail access
* Playback URLs
* Storage URLs

Check whether private videos can be accessed by guessing:

```text
video_id
storage key
URL
signed URL
```

If signed URLs are used:

* Keep expiration short where appropriate.
* Do not expose signing secrets.
* Ensure the server verifies access before issuing them.

---

# 15. SSRF

Check any feature that fetches a URL supplied by a user.

Examples:

* URL previews
* Import tools
* External thumbnails
* Web scraping
* Remote media imports
* External document imports

Prevent access to internal services such as:

```text
localhost
127.0.0.1
private IP ranges
cloud metadata endpoints
internal DNS services
```

Do not allow unrestricted server-side HTTP requests based on arbitrary user URLs.

---

# 16. Path Traversal

Review any endpoint involving:

* filenames
* paths
* resource IDs
* downloads
* file storage
* exports

Prevent:

```text
../
..\ 
absolute paths
encoded traversal
double-encoded traversal
```

Never concatenate untrusted input directly into filesystem paths.

---

# 17. Secrets Management

Search the repository for:

```text
API keys
passwords
tokens
private keys
JWT secrets
database credentials
cloud credentials
storage credentials
payment secrets
OAuth secrets
AI provider keys
```

Secrets must not be committed to Git.

Check:

```text
.env
.env.local
.env.production
Docker files
CI/CD files
frontend code
logs
documentation
tests
fixtures
```

Frontend code must never contain server-side secrets.

If a secret has already been committed:

1. Assume it is compromised.
2. Rotate it.
3. Remove it from active use.
4. Clean repository history where appropriate.

---

# 18. Environment Configuration

Review differences between:

```text
development
test
staging
production
```

Never allow development security shortcuts in production.

Look for:

```text
DEBUG=true
development authentication bypass
test users
default passwords
permissive CORS
verbose errors
unsafe logging
development admin endpoints
```

Production must fail safely when required configuration is missing.

---

# 19. Error Handling

API errors must not reveal:

* Database credentials
* SQL queries
* Stack traces
* Internal filesystem paths
* Environment variables
* Tokens
* Internal architecture unnecessarily
* Sensitive user information

Production responses should be appropriately generic.

Detailed errors can be logged securely server-side.

---

# 20. Logging and Monitoring

Logs should help detect attacks without exposing secrets.

Never log:

* Passwords
* Authentication tokens
* Session cookies
* API keys
* Private keys
* Sensitive personal information unnecessarily

Consider logging security events such as:

* Failed login attempts
* Password reset attempts
* Permission failures
* Suspicious resource access
* Organization access failures
* Account changes
* Role changes
* Security-sensitive configuration changes

Avoid logging complete request bodies indiscriminately.

---

# 21. Rate Limiting and Abuse Prevention

Identify expensive or abuse-prone endpoints.

Examples:

```text
Login
Registration
Password reset
Email verification
Search
Comments
Follows
Uploads
Video processing
AI requests
Resource downloads
```

Apply appropriate rate limits.

For AI features, additionally consider:

* Per-user quotas
* Per-organization quotas
* Request size limits
* Token limits
* Cost controls
* Abuse detection

Never allow a single account to generate unlimited third-party API costs.

---

# 22. Denial of Service

Check for operations that can consume excessive:

* CPU
* RAM
* database connections
* storage
* network bandwidth
* background jobs
* API calls

Pay particular attention to:

* Large uploads
* Large request bodies
* Expensive database queries
* Unbounded pagination
* Regex processing
* Video processing
* PDF processing
* AI requests
* Image processing

Never allow unbounded operations controlled by users.

---

# 23. Database Security

Review:

* Database credentials
* Connection security
* Least-privilege database accounts
* Migrations
* Foreign keys
* Constraints
* Sensitive columns
* Data deletion
* Backup security

Check for:

* Missing ownership constraints
* Missing organization constraints
* Unsafe raw SQL
* Data leakage through joins
* Excessive database privileges

Never expose the database directly to browsers.

---

# 24. ORM Security

Using an ORM does not automatically make the application secure.

Check for:

* Unsafe raw queries
* Mass assignment
* Incorrect relationships
* Missing authorization filters
* Missing organization filters
* Unintended eager loading
* Sensitive fields accidentally serialized

Example:

A query such as:

```python
video = get_video(video_id)
```

is not necessarily sufficient.

The query may need to enforce:

```text
video exists
AND
user is allowed to access video
AND
organization boundaries are respected
```

---

# 25. Data Exposure

Review every API response.

Ask:

> Does the client actually need every field being returned?

Avoid exposing:

* Password hashes
* Internal IDs unnecessarily
* Private emails
* Private profile information
* Internal organization metadata
* Security configuration
* Internal permissions
* Tokens
* Database fields
* Administrative information

Use explicit response schemas.

---

# 26. Account Enumeration

Check whether attackers can determine whether an account exists through:

* Login errors
* Registration
* Password reset
* Email verification
* Search
* User lookup

Avoid unnecessarily revealing:

```text
"Email exists"
"User does not exist"
```

when doing so creates an enumeration vulnerability.

---

# 27. User-Generated Content

All user-generated content must be treated as untrusted.

Review:

* Comments
* Posts
* Descriptions
* Titles
* Names
* URLs
* Markdown
* Rich text
* Images
* Uploaded documents

Protect against:

* XSS
* HTML injection
* malicious links
* phishing content
* oversized payloads
* abusive automation

---

# 28. URL Security

Validate user-provided URLs.

Consider:

* javascript:
* data:
* file:
* localhost
* private IP addresses
* internal hostnames
* malicious redirects

For links rendered to users, ensure dangerous protocols cannot be used.

---

# 29. Open Redirects

Check endpoints such as:

```text
/login?next=
/redirect?url=
/auth/callback?returnUrl=
```

Do not allow attackers to redirect users to arbitrary malicious domains.

Prefer an allowlist or internal-path validation.

---

# 30. Security Headers

Review production HTTP headers including, where appropriate:

* Content-Security-Policy
* X-Content-Type-Options
* Referrer-Policy
* Strict-Transport-Security
* Frame protection
* Permissions-Policy

Do not blindly copy a header configuration.

Ensure it is compatible with LearnOrbit's actual frontend, video player, authentication, and storage architecture.

---

# 31. HTTPS / Transport Security

Production authentication and sensitive data must use HTTPS.

Check:

* HTTPS enforcement
* Secure cookies
* HSTS
* TLS configuration
* Mixed content
* Secure API connections
* Third-party integrations

Never transmit credentials over plain HTTP in production.

---

# 32. Cookie Security

If cookies are used for authentication, review:

```text
Secure
HttpOnly
SameSite
Domain
Path
Expiration
```

Ensure cookies cannot unnecessarily be accessed by JavaScript.

---

# 33. Dependency Security

Before adding dependencies:

1. Determine whether the dependency is actually necessary.
2. Check whether the project already has an equivalent.
3. Check maintenance/activity.
4. Check known vulnerabilities.
5. Avoid unnecessary dependencies.

Regularly scan:

```text
npm dependencies
Python dependencies
Docker images
OS packages
```

Do not blindly upgrade major dependencies without checking compatibility.

---

# 34. Docker / Container Security

Review:

* Base images
* Root user
* Secrets
* Exposed ports
* Installed packages
* Network configuration
* Volume permissions
* Environment variables

Prefer:

* Minimal images
* Non-root processes
* Pinned/reproducible dependencies where practical
* No secrets baked into images
* Only required ports exposed

Never put secrets into:

```dockerfile
ENV SECRET=...
```

or Docker image layers.

---

# 35. CI/CD Security

Review GitHub Actions and other CI/CD systems.

Check:

* Secrets
* Workflow permissions
* Pull request permissions
* Third-party actions
* Dependency installation
* Deployment credentials
* Environment protection

Avoid granting workflows unnecessary write permissions.

Do not expose repository secrets to untrusted pull requests.

---

# 36. Git Security

Before committing:

Check for:

```text
.env
credentials
tokens
private keys
database dumps
personal data
debug files
local configuration
```

Use appropriate secret scanning.

Never commit:

```text
passwords
API keys
private certificates
production credentials
```

---

# 37. Frontend Security

Do not assume frontend code is trusted.

Never put authorization decisions exclusively in React/Next.js/etc.

A user can modify:

* JavaScript
* requests
* local storage
* cookies where accessible
* API parameters

The backend must enforce security.

Review:

* localStorage token handling
* XSS
* unsafe HTML
* exposed environment variables
* client-side secrets
* insecure redirects
* route guards

---

# 38. Search and Discovery

LearnOrbit includes content discovery.

Check whether search can leak:

* private videos
* private resources
* unpublished content
* organization data
* deleted content
* user information

Every search query must respect authorization and visibility rules.

Do not retrieve all data and filter it only on the frontend.

---

# 39. Pagination and Resource Enumeration

Avoid APIs such as:

```text
GET /videos?limit=1000000
```

Enforce:

* Maximum page size
* Safe defaults
* Authorization
* Query limits

Check whether sequential IDs make sensitive resources easily enumerable.

Authorization must still protect resources even if IDs are predictable.

---

# 40. Caching Security

Review caching of:

* User data
* API responses
* Private videos
* Organization data
* Authentication information

Ensure private responses cannot accidentally be served to another user through shared caches.

Be particularly careful with:

```text
CDN caching
browser caching
server-side caching
Redis
Next.js/server caches
```

---

# 41. Background Jobs

Review asynchronous workers for:

* Authorization assumptions
* User-controlled job parameters
* Resource ownership
* Retry abuse
* Queue flooding
* Sensitive data
* Secret exposure

Do not assume a background worker can trust data simply because the API created the job.

---

# 42. AI-Specific Security

If LearnOrbit uses AI features, review:

### Prompt injection

Treat user prompts and uploaded documents as untrusted.

### Data leakage

Ensure one user's data cannot enter another user's AI context.

### System prompt protection

Do not expose secrets through prompts.

### Tool abuse

If AI can call tools/APIs, enforce authorization independently of the AI.

The AI must never be the final security authority.

### Excessive agency

Limit what AI agents can:

* read
* modify
* delete
* execute
* send
* purchase
* call externally

### Cost abuse

Rate-limit AI requests.

### Sensitive data

Avoid sending unnecessary user information to third-party AI providers.

---

# 43. Payment Security

If payments are introduced, review:

* Payment provider integration
* Webhook verification
* Transaction authorization
* Price manipulation
* Currency manipulation
* Replay attacks
* Subscription manipulation

Never trust prices or payment status supplied by the frontend.

The server must verify payment provider events.

Never store raw card information unless there is an explicitly justified, compliant architecture.

---

# 44. Webhooks

All webhooks must verify authenticity.

Check:

* Signature verification
* Timestamp validation
* Replay protection
* Idempotency
* Event authorization
* Input validation

Never trust:

```json
{
  "payment_status": "paid"
}
```

simply because it arrived at an endpoint.

---

# 45. Business Logic Vulnerabilities

Security isn't only technical vulnerabilities.

Test whether users can manipulate workflows.

Examples:

```text
Follow someone repeatedly
Like something repeatedly
Delete resources they don't own
Change ownership
Change organization
Bypass subscription limits
Upload beyond quota
Access unpublished content
Skip required steps
Reuse one-time actions
```

Check for race conditions in important operations.

---

# 46. Race Conditions

Review operations such as:

* Follow/unfollow
* Likes
* Resource deletion
* Account changes
* Role changes
* Payments
* Quotas
* Upload limits
* Organization membership

Test whether simultaneous requests can bypass business rules.

---

# 47. Sensitive Operations

Require appropriate authorization/re-authentication for high-impact operations where applicable:

* Change password
* Change email
* Delete account
* Change ownership
* Change organization permissions
* Add administrators
* Delete major resources
* Change billing

---

# 48. Privacy

Minimize collection and exposure of personal data.

Review:

* User profiles
* Emails
* Names
* Student information
* Teacher information
* Organization information
* Activity data
* Analytics
* IP addresses
* Logs

Only collect what the feature needs.

Avoid exposing private information through APIs, search, URLs, logs, or frontend state.

---

# 49. Data Deletion

Check whether deleting an account/resource actually removes or appropriately anonymizes associated data.

Review:

* Database records
* Uploaded files
* Videos
* Thumbnails
* Cached data
* Background jobs
* Search indexes
* Analytics
* Logs

Do not leave unauthorized orphaned resources accessible.

---

# 50. Security Testing Requirements

For security-sensitive features, test at minimum:

### Authentication

```text
Unauthenticated → rejected
Authenticated → allowed where appropriate
Invalid credentials → rejected
Expired session → rejected
```

### Authorization

```text
User A → own resource → allowed
User A → User B resource → rejected
User A → Organization B → rejected
Normal user → admin action → rejected
```

### Input validation

```text
Missing input → rejected
Invalid type → rejected
Oversized input → rejected
Unexpected field → rejected
Malicious input → safely handled
```

### File uploads

```text
Valid file → accepted
Oversized file → rejected
Invalid file → rejected
Unauthorized upload → rejected
Unauthorized download → rejected
Path traversal → rejected
```

---

# 51. Security Review Method for Claude

When asked to review a feature, Claude must follow this process.

## Step 1 — Understand the feature

Identify:

* Actors
* Resources
* Organizations
* Roles
* APIs
* Database models
* Files
* External services
* Sensitive data

## Step 2 — Identify trust boundaries

Map:

```text
Browser
    ↓
Frontend
    ↓
API
    ↓
Services
    ↓
Database
    ↓
Storage
    ↓
External services
```

Identify what data crosses each boundary.

## Step 3 — Inspect existing security architecture

Before changing code, inspect only the relevant existing implementations for:

* Authentication
* Authorization
* Organization isolation
* API patterns
* File storage
* Validation
* Error handling
* Tests

Reuse established patterns where they are secure.

## Step 4 — Attack the feature mentally

Try:

```text
Unauthenticated access
Wrong user
Wrong organization
Wrong role
Modified IDs
Modified request body
Missing fields
Unexpected fields
Huge values
Malicious files
Repeated requests
Concurrent requests
Direct API requests
```

## Step 5 — Review implementation

Look for:

* Authentication bypass
* Authorization bypass
* IDOR/BOLA
* Injection
* XSS
* CSRF
* SSRF
* Path traversal
* Secrets
* Data leakage
* Rate-limit issues
* Business logic flaws

## Step 6 — Add security tests

Tests should prove that unauthorized operations fail.

Do not only test successful/happy paths.

## Step 7 — Run relevant checks

Run the smallest relevant set of:

* Backend tests
* Frontend tests
* Type checking
* Linting
* Dependency/security checks

Do not skip failures.

## Step 8 — Report findings

Classify findings:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFORMATIONAL
```

For each finding provide:

```text
Location
Vulnerability
Attack scenario
Impact
Recommended fix
Whether fixed
Test proving the fix
```

---

# 52. Severity Guidelines

## CRITICAL

Potential for:

* Remote code execution
* Complete authentication bypass
* Complete tenant isolation bypass
* Database compromise
* Production secret compromise
* Full administrator takeover

## HIGH

Examples:

* IDOR exposing private data
* Privilege escalation
* Stored XSS affecting many users
* Authentication weaknesses
* Unauthorized organization access
* Sensitive file access
* Significant payment manipulation

## MEDIUM

Examples:

* Missing rate limiting
* Information disclosure
* CSRF in limited circumstances
* Weak security headers
* Account enumeration
* Moderate business logic abuse

## LOW

Examples:

* Minor information leakage
* Missing non-critical headers
* Low-impact configuration issues

---

# 53. Claude Code Rules

Claude must NOT:

* Disable authentication to make development easier.
* Remove authorization checks to make APIs work.
* Expose secrets for debugging.
* Commit `.env` files containing secrets.
* Trust frontend role checks.
* Trust user-provided organization IDs.
* Trust user-provided ownership fields.
* Assume uploaded files are safe.
* Disable security middleware without justification.
* Replace secure code with simpler insecure code.
* Ignore security test failures.
* Hide vulnerabilities from the final report.
* Introduce a dependency without justification.
* Perform broad unrelated refactoring during a security fix.

Claude SHOULD:

* Reuse existing secure patterns.
* Make the smallest safe change.
* Add regression tests.
* Explain security-sensitive decisions.
* Preserve backwards compatibility where possible.
* Explicitly identify assumptions.
* Report anything that could not be verified.

---

# 54. Required Security Review Before Declaring a Feature Complete

Before marking a security-sensitive feature complete, Claude should be able to answer:

```text
[x] Is authentication enforced where required?
[x] Is authorization enforced server-side?
[x] Is object ownership checked?
[x] Is organization/tenant isolation enforced?
[x] Are all inputs validated?
[x] Are unexpected fields rejected/ignored safely?
[x] Is SQL injection prevented?
[x] Is XSS prevented?
[ ] Is CSRF addressed where applicable?              <- DEFERRED (F3 CSRF middleware -> Phase 9F)
[x] Is CORS appropriately restricted?
[x] Are file uploads secure?
[x] Are private resources protected?
[x] Are secrets protected?
[x] Are sensitive responses minimized?
[x] Are errors safe?
[x] Is rate limiting needed?                      <- YES; implemented 2026-08-24 (F2, §21)
[x] Is abuse prevention needed?                   <- YES; implemented 2026-08-24 (F2, §21)
[x] Are dependencies safe?
[x] Are security-sensitive operations tested?
[x] Are unauthorized requests tested?
[x] Are cross-user requests tested?
[x] Are cross-organization requests tested?
[x] Have business-logic attacks been considered?
[x] Have relevant security tests been run?
```

---

# 55. LearnOrbit Highest-Priority Security Areas

Given LearnOrbit's architecture and feature set, Claude should prioritize:

### Priority 1 — Authorization

Especially:

```text
User → Resource
User → Channel
User → Organization
User → Video
User → Short
User → Educational Resource
```

### Priority 2 — Organization/Tenant Isolation

No cross-organization data access or modification.

### Priority 3 — Authentication

Secure sessions, passwords, password resets, and account recovery.

### Priority 4 — File Uploads

Videos, Shorts, PDFs, images, and educational resources.

### Priority 5 — API Security

Every endpoint must enforce appropriate authentication, authorization, validation, and rate limiting.

### Priority 6 — User-Generated Content

XSS, malicious URLs, oversized content, spam, and abuse.

### Priority 7 — Secrets

Environment variables, API keys, storage credentials, database credentials, AI keys, and payment secrets.

### Priority 8 — Data Privacy

Minimize and protect student, teacher, creator, and organization data.

### Priority 9 — AI Security

If AI functionality is introduced:

```text
Prompt injection
Data leakage
Tool abuse
Excessive agency
Cost abuse
Third-party data exposure
```

### Priority 10 — Infrastructure

Docker, databases, storage, CI/CD, dependencies, HTTPS, and production configuration.

---

# 56. Final Security Principle

The most important rule for LearnOrbit is:

> **Never trust the client, never trust user-controlled identifiers, and never let the AI itself become a security boundary.**

Every security-sensitive decision must ultimately be enforced by trusted server-side code.

AI-generated code is not considered secure merely because:



* it compiles,
* tests pass,
* the UI works,
* TypeScript passes,
* linting passes,
* or the implementation follows an existing pattern.

Security requires deliberate adversarial review.

When a feature touches authentication, authorization, organizations, files, personal data, payments, or AI, security review is mandatory before considering the feature complete.

---
---

# Re-verification Record — 2026-08-24 (pre-Phase-9F)

> This section is **appended**, not a replacement. Everything above (§1–§56) remains the
> authoritative standard. This record states, item by item, whether the current code on
> `learnorbit-v1` actually satisfies each item — re-confirmed against the code as it stands
> today, not carried over from the Phase 9A / 9E reviews.
>
> **Statuses** (same vocabulary as §1a): `[x]` verified with code+test evidence · `[ ] OPEN` outstanding, LearnOrbit-owned · `[ ] DEFERRED` outstanding, intentionally scheduled · `[ ] INHERITED` outstanding only in unmodified upstream LearnHouse code/infrastructure · `[ ] N/A` not applicable to V1.

## Scope of code changed during this re-verification

**Second pass (checklist reconciliation).** No further code was changed. This pass finished the
remaining sections, marked the original §54 checklist in place, added the §1a Status Index, and
normalised every status to the five-value vocabulary below. One new finding surfaced (§19,
LOW) — reported, not fixed, for the reason given in that row.

Two genuine gaps found in LearnOrbit-owned code were fixed under the "small scoped security
fixes and regression tests" allowance; everything else is report-only.

* `apps/api/src/routers/notifications.py` — `GET /notifications` `page`/`limit` now
  `Query(ge=1)` / `Query(ge=1, le=100)` (§39 max page size).
* `apps/api/src/routers/orgs/orgs.py` — same cap on
  `GET /orgs/{org_id}/videos/{channelvideo_id}/comments`.
* `apps/api/src/tests/routers/test_notifications_router.py`,
  `apps/api/src/tests/routers/test_channel_videos_router.py` — regression tests
  (out-of-range → 422, in-range → 200). Mutation-tested: reverting the cap on
  `/notifications` makes `test_notifications_rejects_out_of_range_pagination_params` fail.

## A. §2 Core Security Rules

| ID | Requirement | Status | Evidence | Remaining action |
|---|---|---|---|---|
| 2.1 | Never trust client-side input | [x] | `services/orgs/channel_video_comments.py::_validate_content`; SQLModel/Pydantic bodies on every LearnOrbit route · `test_channel_videos_service.py`, `test_questions_service.py` | — |
| 2.2 | Never rely on frontend authorization | [x] | Every LearnOrbit mutation goes through `_require_channel_admin` / `resolve_acting_user_id` server-side · `test_channel_videos_service.py`, `test_rbac.py` | — |
| 2.3 | Enforce authorization on the server | [x] | `security/rbac.py`, `is_org_admin`; org-scoped `_get_*_or_404` helpers · `tests/security/test_rbac_runtime.py` (1331 security tests pass) | — |
| 2.4 | Validate all untrusted input | [x] | Typed query params incl. the two pagination caps added this session · `test_notifications_router.py::test_notifications_rejects_out_of_range_pagination_params` | — |
| 2.5 | Use parameterized queries/ORM APIs | [x] | No f-string SQL anywhere; the only `text()` uses are static (`services/health/health.py:11`) or bound (`services/roles/roles.py:240` `:next_val`) | — |
| 2.6 | Never expose secrets to the frontend | [x] | No secret in `NEXT_PUBLIC_*`; no token in `localStorage` (grep over `apps/web/**/*.tsx` returns only UI prefs) | — |
| 2.7 | No hard-coded credentials/API keys | [x] | `git ls-files` + `.env` filter → only `apps/collab/.env.example`; `.gitignore:26-30` covers all `.env*` | — |
| 2.8 | Follow existing auth/session mechanisms | [x] | All new routers use `Depends(get_current_user)`; none re-implement token handling | — |
| 2.9 | Preserve tenant/organization isolation | [x] | `_get_channel_video_or_404(org.id, id, …)` filters on both id and `org_id` · `tests/security/test_rbac_cross_org.py` | Browser-level proof blocked (see §6) |
| 2.10 | Use least privilege | [x] | `ChannelVideoUpdate` omits `org_id`/`activity_id`/`published`/`visibility`; `_PROTECTED_FIELDS` in `services/users/users.py:268` | — |
| 2.11 | Fail securely | [x] | `services/utils/ssrf_guard.py::assert_connected_peer_allowed` raises on unknown peer ("fail closed") · `test_ssrf_guard_service.py` | — |
| 2.12 | Do not expose unnecessary info in responses | [x] | `db/users.py:97 UserReadAuthor` — id/uuid/username/name/avatar only, never email/`is_superadmin`; error messages carry no internal detail either (§19) | — |
| 2.13 | Do not log passwords/tokens/secrets/PII | [x] | No LearnOrbit service logs credentials; webhook secrets handled via `services/webhooks/crypto.py::decrypt_secret`, never logged | — |
| 2.14 | Do not disable security controls to pass tests | [x] | No guard suppression in the diff; mutation test shows the new cap is load-bearing | — |
| 2.15 | Do not add unnecessary dependencies | [x] | Zero dependency changes this session (`git status` shows no manifest/lockfile edits) | — |
| 2.16 | Validate uploads independently of extension | [x] | `security/file_validation.py` magic-byte validators; `get_safe_filename` derives ext from server-determined MIME via `MIME_TO_SAFE_EXT` · `tests/security/test_file_validation.py` | — |
| 2.17 | Rate-limit security-sensitive/abuse-prone endpoints | [x] | **Resolved 2026-08-24.** `services/security/rate_limiting.py::enforce_learnorbit_rate_limit` + the `LEARNORBIT_RATE_LIMITS` table, wired as the first statement of all 33 LearnOrbit mutation handlers in `routers/orgs/orgs.py` and the 3 parent-link handlers in `routers/users.py` · `test_learnorbit_rate_limiting_service.py` (20 cases), `test_learnorbit_rate_limits_router.py` (9 cases, incl. a route-coverage test that fails on any new unprotected LearnOrbit mutation route) | — |
| 2.18 | Treat AI-generated code as untrusted until reviewed/tested | [x] | This re-verification is the process control; every fix here carries a test | — |
| 2.19 | Security checks must be performed server-side | [x] | **Resolved 2026-08-24.** `services/orgs/quiz_attempts.py::_require_within_time_limit`, called from `submit_quiz_attempt` before any answer is read · `test_quiz_attempts_service.py::test_expired_attempt_cannot_be_submitted` and 10 sibling cases | — |
| 2.20 | Do not weaken existing security for convenience | [x] | Diff only adds constraints (`le=100`); no guard relaxed | — |

## B. §3 Threat Model

| ID | Attacker | Status | Evidence | Remaining action |
|---|---|---|---|---|
| 3.1 | Anonymous attacker | [x] | `get_channel_video` serves anonymously only when `published and visibility == "public"`; 401 on `/feed`, `/notifications` · `test_feed_router.py::test_home_feed_rejects_anonymous_caller` | — |
| 3.2 | Authenticated normal user | [x] | `_require_channel_admin` → 403 for non-admins · `test_channel_videos_service.py` non-admin cases | — |
| 3.3 | Malicious creator/teacher | [x] | Admin rights are org-scoped; `_get_org_or_404` + `is_org_admin(org.id)` prevent acting on another org · `test_rbac_cross_org.py` | — |
| 3.4 | Compromised account | [x] | `revoke_user_sessions_before` + Redis `jwt_revoked_before:{user_id}`; refresh rotation with `jti` · `tests/security/test_session_revocation.py` | — |
| 3.5 | Malicious organization member | [x] | Cross-org rejection proven at service/router level (`test_rbac_cross_org.py`, `test_org_auth.py`) | Not provable in a browser — local dev is `tenancy: single`; `multi` is hard-rejected on localhost. Accepted, documented limitation |

## C. §4–§50 Section-by-section

| ID | Requirement | Status | Evidence | Remaining action |
|---|---|---|---|---|
| §4 | Authentication | [x] | `security/auth.py`: Argon2 via `pwdlib`, `_DUMMY_PASSWORD_HASH` timing equalization, `decode_jwt` pins `algorithms=[ALGORITHM]` + `options={"require": ["exp","sub"]}` · `test_auth_core_hardening.py`, `test_auth_policy.py` | — |
| §5 | Authorization / IDOR / BOLA | [x] | Org-scoped `_get_*_or_404` on every LearnOrbit resource; 404-not-403 where existence is sensitive · `test_block_idor.py`, `test_resource_access.py` | — |
| §6 | Multi-tenant / organization isolation | [x] | Enforced and tested in code (§2.9, §3.5 rows) | Browser E2E impossible under `tenancy: single` — accepted limitation, recorded, not a code defect |
| §7 | API security / mass assignment | [x] | `ChannelVideoUpdate` deliberately omits `org_id`/`activity_id`/`published`/`visibility`; `_PROTECTED_FIELDS` strip in `users.py:268` · `test_channel_videos_service.py` | — |
| §8 | Input validation | [x] | Length/emptiness checks (`MAX_COMMENT_LENGTH`), `Literal`-typed enums (`content_format`), pagination bounds · `test_channel_videos_router.py` | — |
| §9 | SQL injection | [x] | Full-tree grep: no interpolated SQL; only static or bound `text()` (see §2.5) | — |
| §10 | XSS | [x] | No unsanitized `dangerouslySetInnerHTML` in LearnOrbit UI; `components/SEO/JsonLd.tsx::serializeJsonLd` escapes `<`/`>`/`&`; inherited editor embeds run `DOMPurify.sanitize` | — |
| §11 | CSRF | [ ] DEFERRED | `security/csrf.py::CSRFProtectionMiddleware` is fully implemented and tested (`tests/security/test_csrf.py`) but **never registered** — `apps/api/app.py` adds only CORS + GZip + EE hooks. Mitigated (not eliminated) by `SameSite=Lax` on `LH_access`/`LH_refresh` | **F3** — register in Phase 9F, as already planned |
| §12 | CORS | [x] | `core/middleware/cors.py` pins `allow_origin_regex` to configured `frontend_domain`/`domain` (+`www.`, +localhost); no arbitrary Origin reflection | — |
| §13 | File upload security | [x] | Magic-byte validation, SVG rejected with 415, size decided **before** buffering via `_stream_length` bounded read, server-derived extension · `test_file_validation.py`, `test_file_validation_runtime.py` | — |
| §14 | Video / Short security | [x] | `get_channel_video` publishes only `published and visibility == "public"`; otherwise org-admin only. Authorized delivery via `routers/stream.py` · `test_media_file_access.py` | — |
| §15 | SSRF | [ ] INHERITED | **API-side fully verified:** `services/utils/ssrf_guard.py` blocks private/reserved/link-local/metadata ranges, blocks `localhost`/`metadata.google.internal`, and defeats DNS rebinding by re-checking the connected peer. Used by `link_preview.py`, `webhooks/dispatch.py`, `orgs/custom_domains.py` · `test_ssrf_guard_service.py` (15 cases), `test_link_preview_service.py`, `test_webhooks_dispatch_service.py` | **Residual (LOW, inherited):** `apps/web/next.config.js` `images.remotePatterns` allows `hostname: '**'` for both http and https, so the Next image optimizer will fetch any user-supplied host server-side. Not LearnOrbit-authored; narrow it when the image-host list is known |
| §16 | Path traversal | [x] | `services/utils/upload_content.py::_safe_content_path` rejects null bytes and `..` segments, then `realpath` + `os.path.commonpath` containment under `content/`; 400 on escape · `test_scorm_extract.py`, `test_import_content_hardening.py` | — |
| §17 | Secrets management | [x] | No `.env` tracked; webhook secrets encrypted at rest (`services/webhooks/crypto.py`) | — |
| §18 | Environment configuration | [x] | `config/config.yaml` + env overrides; `config.py` hard-rejects `tenancy: multi` on localhost domains | — |
| §19 | Error handling | [x] | LearnOrbit services raise typed `HTTPException` with fixed messages (404/403/409/422); no stack traces or ORM errors surfaced. **Resolved 2026-08-24:** `link_preview.py` now returns the reason-free `_BLOCKED_URL_DETAIL` for every SSRF-guard rejection and logs the real cause server-side · `test_link_preview_service.py::test_resolve_block_does_not_leak_internal_address_to_client`, `::test_peer_block_does_not_leak_validated_address_set_to_client`, `::test_every_block_reason_returns_the_same_indistinguishable_message` | — |
| §20 | Logging and monitoring | [x] | No credential/token logging in LearnOrbit services; SSRF/webhook failures log the reason, not the secret | — |
| §21 | Rate limiting and abuse prevention | [x] | **Resolved 2026-08-24.** Same fix as §2.17 — per-action, per-identity ceilings on every LearnOrbit mutation endpoint, keyed to the authenticated user (API tokens resolve to their creator) with a tighter per-IP bucket for anonymous callers. See the *Rate Limiting (F2)* note below for the endpoint list, the limits and their rationale | — |
| §22 | Denial of service | [x] | Page size capped everywhere (§39); upload size decided before buffering; `link_preview._read_capped_text` caps response bodies · `test_resource_exhaustion_limits.py`, `test_resource_limits_end_to_end.py`. **Request-rate DoS resolved 2026-08-24** by the §2.17 / §21 fix | Application-layer only — volumetric/network DoS remains an infrastructure concern (reverse proxy / CDN), not a code control |
| §23 | Database security | [x] | Alembic migrations under `apps/api/migrations/versions/`; FKs with explicit `ondelete`; no dynamic DDL from user input | — |
| §24 | ORM security | [x] | SQLModel `select()` throughout; response models are explicit `*Read` projections, never raw table rows | — |
| §25 | Data exposure | [x] | `ChannelVideoCommentRead` exposes `UserReadAuthor` only; `ChannelVideoReportRead` carries no reporter identity · `db/users.py:97-109` | — |
| §26 | Account enumeration | [x] | Registration: single generic `"Email or username is already in use"` for both conflicts (`services/users/users.py:250-262`). Reset: `"If an account with that email exists…"` (`services/users/password_reset.py`). Login timing equalized via `_DUMMY_PASSWORD_HASH` | — |
| §27 | User-generated content | [x] | Comments/reports length- and emptiness-validated server-side, rendered as React text (auto-escaped), reportable via `channel_video_reports.py` | — |
| §28 | URL security | [x] | No `javascript:`/`data:text/html` sinks in LearnOrbit components (grep clean) | — |
| §29 | Open redirects | [x] | `services/admin/admin.py::_validate_magic_link_redirect` requires a same-origin path starting `/`, and re-validates on consumption (line 1426), falling back to `/` · `test_admin_api.py`, `test_remediation_magic_link.py` | — |
| §30 | Security headers | [ ] INHERITED | `apps/web/next.config.js` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `CSP: frame-ancestors 'none'`, HSTS `max-age=31536000; includeSubDomains`, `X-Download-Options: noopen`, with scoped `SAMEORIGIN`/`ALLOWALL` overrides for embed/player routes | **LOW:** no `Permissions-Policy`. Add `camera=(), microphone=(), geolocation=()` when convenient; not a 9F blocker |
| §31 | HTTPS / transport | [x] | HSTS above; `JWT_COOKIE_SECURE=True`; `security/auth.py` sets `secure=is_secure` | — |
| §32 | Cookie security | [x] | `LH_access`/`LH_refresh`: `httponly=True, secure=is_secure, samesite="lax"` · `test_auth_runtime.py` | — |
| §33 | Dependency security | [x] | No dependency added this session; every CI/Docker install is frozen (`--frozen-lockfile` / `uv sync --frozen`), and `scripts/lockfiles.sh --check` gates manifest drift | — |
| §34 | Docker / container security | [ ] INHERITED | `apps/web/Dockerfile:55` runs `USER nextjs` | **Inherited gap:** `apps/api/Dockerfile` has no `USER` directive → API container runs as root. Infrastructure change, out of scope for this task; raise as its own increment |
| §35 | CI/CD security | [ ] INHERITED | 10 workflows under `.github/workflows/`; all installs frozen | **Inherited gap:** none declares a `permissions:` block, so `GITHUB_TOKEN` gets the repo default scope. Add `permissions: contents: read`; infrastructure, not a 9F blocker |
| §36 | Git security | [x] | `git ls-files` shows no `.env` (only `apps/collab/.env.example`); `.gitignore:25-30` covers `.env*` | — |
| §37 | Frontend security | [x] | No tokens in `localStorage`/`sessionStorage` — only UI preferences (menu collapse, language, filters) and an analytics session id; auth rides httpOnly cookies. OAuth CSRF state deliberately in a cookie (`AuthContext.tsx:171`) | — |
| §38 | Search and discovery | [x] | `/shorts` and `/feed` list only `published` + `public` rows · `test_shorts_router.py::test_pagination_never_exposes_a_draft_or_unlisted_short` | — |
| §39 | Pagination and resource enumeration | [x] | **Fixed this session.** `Query(default=…, ge=1, le=100)` now on `/shorts`, `/feed`, `/orgs/{id}/questions`, `/orgs/{id}/reports`, **`/notifications`**, **`/orgs/{id}/videos/{id}/comments`** · new `test_notifications_router.py` + `test_channel_videos_router.py` pagination tests (mutation-verified) | — |
| §40 | Caching security | [x] | Every authenticated fetch uses `cache: 'no-store'` (`services/utils/ts/requests.ts:64`, `organizations/orgs.ts:92`); the only `revalidate` is `stripe.ts:877` on the public `plans` list | — |
| §41 | Background jobs | [x] | Webhook dispatch re-validates the endpoint URL through the SSRF guard at send time rather than trusting the queued row (`webhooks/dispatch.py:243`) · `test_webhooks_dispatch_service.py` | — |
| §42 | AI-specific security | [x] | No LearnOrbit-authored AI surface in V1; inherited AI routes retain their credit/ownership guards · `test_ai_credit_atomic.py`, `test_ai_cross_org_credit_drain.py`, `test_rag_chat_ownership.py` | — |
| §43 | Payment security | [ ] N/A | Stripe lives entirely under EE (`ee/services/payments/`), gated by `lib/eeGate.ts` and absent from this build. Not a V1 LearnOrbit surface | Out of V1 scope |
| §44 | Webhooks | [x] | Outbound signed with `compute_signature` (`dispatch.py:214`), secret decrypted at send time, body capped by `_read_capped_body`, destination SSRF-checked · `test_webhooks_dispatch_service.py` | — |
| §45 | Business logic vulnerabilities | [x] | **Resolved 2026-08-24.** The expired-attempt hole is closed server-side: `_require_within_time_limit` rejects a late submission with 409 and the attempt is left ungraded (`status` still `in_progress`, zero `QuizAnswer` rows) · mutation-verified three ways — removing the call, flipping `>` to `>=`, and clobbering aware `tzinfo` each break a distinct test | — |
| §46 | Race conditions | [x] | DB-level `UniqueConstraint` on every engagement table: `unique_org_follow_user`, likes, saves, reports, `unique_parent_child_link`, `uq_quizanswer_attempt_question` — double-submit cannot double-count | — |
| §47 | Sensitive operations | [x] | Password change stamps `password_changed_at` and revokes prior sessions; reset codes are single-use (`r.delete(reset_key)`), 1 h TTL, `isalnum()`-guarded against Redis key injection | — |
| §48 | Privacy | [x] | Parent→child visibility requires an accepted `ParentChildLink`; `services/users/parent_links.py` checks the link before returning activity · `test_parent_links_service.py`, `test_parent_links_router.py` | — |
| §49 | Data deletion | [x] | All engagement rows cascade: likes/saves/reports/shares/follows declare `ondelete="CASCADE"` on both `channelvideo.id` and `user.id` | **Documented, deliberate:** `delete_channel_video` removes only the discovery post; the underlying `Activity` (upload/HLS/captions) survives because it may still be a course lesson (`docs/ARCHITECTURE.md` § "Videos (Phase 2A)"). The Activity stays authorization-gated, so nothing becomes *unauthorized*-orphaned. Accepted limitation |
| §50 | Security testing requirements | [x] | `src/tests/security/` — 1331 passed, 4 skipped, 1 pre-existing EE failure. Auth, authz, input validation and upload categories all covered | — |

## D. §51–§56 Process Compliance

| ID | Requirement | Status | Evidence | Remaining action |
|---|---|---|---|---|
| §51 | Security review method (8 steps) | [x] | This record follows steps 1–8: features understood, trust boundaries mapped, existing architecture inspected, features attacked mentally (unbounded page, expired-timer submit, DNS rebinding), implementation reviewed, tests added, checks run, findings reported below | — |
| §52 | Severity guidelines | [x] | Every open item below carries an explicit severity | — |
| §53 | Claude Code rules | [x] | No architecture rewritten; only two scoped fixes, both test-backed; no commit made | — |
| §55 | Priorities 1–10 | [x] | P1 Authorization §5 · P2 Isolation §6 · P3 Authentication §4 · P4 Uploads §13 · P5 API §7 · P6 UGC §27 · P7 Secrets §17 · P8 Privacy §48 · P9 AI §42 · P10 Infrastructure §34/§35 — all covered above | — |
| §56 | Final security principle | [x] | No feature was declared complete on documentation alone; each `[x]` row names code **and** a test | — |

## E. §54 Pre-Completion Checklist

| ID | Question | Status | Evidence | Remaining action |
|---|---|---|---|---|
| 54.1 | Is authentication enforced where required? | [x] | 401 on `/feed`, `/notifications`, all mutations · `test_feed_router.py`, `test_notifications_router.py` | — |
| 54.2 | Is authorization enforced server-side? | [x] | `_require_channel_admin`, `is_org_admin` | — |
| 54.3 | Is object ownership checked? | [x] | `submit_quiz_attempt` ownership check; comment delete author/admin check | — |
| 54.4 | Is organization/tenant isolation enforced? | [x] | `_get_*_or_404(org.id, …)` · `test_rbac_cross_org.py` | — |
| 54.5 | Are all inputs validated? | [x] | incl. the two pagination caps added here | — |
| 54.6 | Are unexpected fields rejected/ignored safely? | [x] | `*Update` schemas omit protected columns; `_PROTECTED_FIELDS` strip | — |
| 54.7 | Is SQL injection prevented? | [x] | §9 | — |
| 54.8 | Is XSS prevented? | [x] | §10 | — |
| 54.9 | Is CSRF addressed where applicable? | [ ] DEFERRED | Middleware written + tested, not registered; `SameSite=Lax` mitigates | **F3 → 9F** |
| 54.10 | Is CORS appropriately restricted? | [x] | §12 | — |
| 54.11 | Are file uploads secure? | [x] | §13 | — |
| 54.12 | Are private resources protected? | [x] | §14 | — |
| 54.13 | Are secrets protected? | [x] | §17, §36 | — |
| 54.14 | Are sensitive responses minimized? | [x] | §25 | — |
| 54.15 | Are errors safe? | [x] | §19 — link-preview SSRF detail leak, fixed 2026-08-24 | — |
| 54.16 | Is rate limiting needed? | [x] | Yes — **implemented 2026-08-24** on every LearnOrbit mutation endpoint (§2.17 row) | — |
| 54.17 | Is abuse prevention needed? | [x] | Page size capped, uniqueness constraints prevent double-counting, and **request-rate abuse is now capped per action per identity** (§2.17 / §21 rows) | — |
| 54.18 | Are dependencies safe? | [x] | §33 | — |
| 54.19 | Are security-sensitive operations tested? | [x] | §50 | — |
| 54.20 | Are unauthorized requests tested? | [x] | anonymous-caller tests on every list endpoint | — |
| 54.21 | Are cross-user requests tested? | [x] | `test_notifications_router.py` cross-user read/mark-read cases | — |
| 54.22 | Are cross-organization requests tested? | [x] | `test_rbac_cross_org.py`, `test_org_auth.py` | — |
| 54.23 | Have business-logic attacks been considered? | [x] | Considered, one found, now fixed — see §45 | — |
| 54.24 | Have relevant security tests been run? | [x] | See "Verification run" below | — |

## Totals

Identical to the §1a Status Index at the top of this document.

* `[x]` **Verified:** 94 / 101
* `[ ]` **OPEN:** 0 / 101 — both findings from this audit (§2.19 / §45 / §54.23 and
  §19 / §54.15) were resolved on 2026-08-24
* `[ ]` **DEFERRED:** 2 / 101 — §11, §54.9 — **one** root cause: F3 CSRF middleware.
  F2 rate limiting (§2.17, §21, §22, §54.16, §54.17) was implemented on 2026-08-24 and
  those five items are now `[x]`
* `[ ]` **INHERITED:** 4 / 101 — §15, §30, §34, §35
* `[ ]` **N/A:** 1 / 101 — §43

### Critical / High remaining

**None.** No Critical or High severity item is outstanding. Every outstanding item is MEDIUM or LOW.

### Recommended fixes before Phase 9F

1. ~~**Quiz time limit is not enforced server-side.**~~ **RESOLVED 2026-08-24** — the decision
   was "reject as expired", and it is implemented: see the Time-Limit Enforcement note below.
2. ~~**Link-preview error detail leak.**~~ **RESOLVED 2026-08-24** — see the Error-Detail
   Disclosure note below.
3. ~~**F2 rate limiting (MEDIUM, §21 / §2.17 / §54.16 / §54.17).**~~ **RESOLVED 2026-08-24** —
   the existing `check_rate_limit` helper was extended, not replaced, and applied to every
   LearnOrbit mutation endpoint: comments, reports, follows, likes, saves, shares, channel
   content, quiz attempts and parent-link requests. See the Rate Limiting note below.
4. **F3 CSRF middleware (MEDIUM, §11 / §54.9)** — register `CSRFProtectionMiddleware` in
   `apps/api/app.py`. This is exactly what Phase 9F is for; listed for completeness.

Nothing above blocks starting 9F. Item 4 is 9F work by design.

### Non-blocking, inherited (raise separately)

* `images.remotePatterns: hostname: '**'` in `next.config.js` (§15, LOW).
* `Permissions-Policy` header absent (§30, LOW).
* API Docker image runs as root — no `USER` in `apps/api/Dockerfile` (§34, LOW).
* No `permissions:` block in any `.github/workflows/` file (§35, LOW).

### Not verified (insufficient evidence)

* **Browser-level cross-organization isolation (§6, §3.5).** Cannot be exercised locally:
  `hosting_config.tenancy: single` collapses org routing onto the seeded default org, and
  `tenancy: multi` is hard-rejected whenever the domain contains "localhost". Verified via
  service- and router-level tests instead. Pre-existing environment limitation, not a defect.
* **`test_active_users.py::TestRecordActivity::test_ee_records`** fails
  (`assert called["db"] is True`) because `is_ee_available()` is False — `ee/hooks.py` is
  absent API-side in this checkout. Pre-existing, environment-dependent, unrelated to
  anything in this diff.

### Verification run

| Check | Result |
|---|---|
| `pytest src/tests/security/` | 1331 passed, 4 skipped, **1 pre-existing EE failure** (`test_ee_records`), 90.4 s |
| `pytest` — 15 LearnOrbit router/service suites (feed, shorts, notifications, channel videos, parent links, quizzes, quiz attempts, questions, reports, follows, SSRF guard, link preview) | 295 passed, 79.3 s |
| Mutation test — revert `le=100` on `/notifications` | `test_notifications_rejects_out_of_range_pagination_params` **fails** (200 ≠ 422); guard restored and re-passing |
| `uvx ruff@0.15.9 check` on the 4 changed Python files | All checks passed |
| `bunx tsc --noEmit` (`apps/web`) | Clean, no output |
| ESLint | **Not run — no frontend file changed** in this diff |
| `git diff --check` | Clean (CRLF advisories only; pre-existing, repo-wide) |
| Additional checks, second pass | `dangerouslySetInnerHTML` sweep of `apps/web` — exactly 3 sinks, all sanitised (§10) · `detail=str(exc)`/`traceback` sweep of `apps/api/src/services` — surfaced the §19 finding · secret-logging sweep — clean (§20) · migration coverage for every LearnOrbit table — present (§23) |
| Browser verification | Not attempted — no UI change in this diff |
| Commit / push | **None.** Working tree left as-is, per instruction |

---

## Time-Limit Enforcement — resolved 2026-08-24 (§2.19, §45, §54.23)

**Decision taken:** enforce the limit server-side; a submission arriving after
`started_at + time_limit_minutes` is **rejected as expired**, never graded.

**Implementation** — `apps/api/src/services/orgs/quiz_attempts.py`:

* New `_require_within_time_limit(quiz, attempt)`, called from `submit_quiz_attempt`
  immediately after the existing `status != "in_progress"` check and **before** the
  answer-shape validation and the grader. A late submission therefore cannot reach the
  grader, and cannot be used to probe which question ids belong to the quiz either.
* Rejection is `409` (`"This attempt has expired"`), matching the resubmission 409 already
  raised by this same function.
* **No state change on rejection.** The attempt stays `in_progress` with no `QuizAnswer` rows
  and `score_percentage` untouched. Persisting a terminal `"expired"` status was deliberately
  *not* done: the model documents its status vocabulary as `"in_progress" | "submitted" |
  "graded"`, so adding a fourth value is a schema/vocabulary change, not the smallest
  enforcement. It remains available as a follow-up if the product wants expired attempts
  visible in history.
* **Untimed quizzes are untouched** — `time_limit_minutes is None` short-circuits before any
  parsing, so nothing about the existing untimed flow changes.

**Timezone correctness.** `started_at` is written by `_now()` as a *naive* string that already
means UTC. The guard parses it and re-stamps UTC only when `tzinfo is None`, so an
offset-aware value is honoured rather than clobbered. Comparing the stored value against a
local-time "now" would shift every deadline by the server's offset — east of UTC a fresh
attempt would expire immediately, west of UTC a stale one would look valid.

**Boundary.** The deadline is inclusive: a 30-minute quiz means 30 minutes, so only
`now > deadline` expires. There is deliberately no clock-skew grace window — adding one is a
product decision, not a security default.

**Fail-closed.** A *timed* attempt whose `started_at` cannot be parsed (empty or malformed)
is refused rather than graded: it cannot be shown to be inside its window.

**Tests** — `apps/api/src/tests/services/test_quiz_attempts_service.py`, 11 new cases driving
the service directly with no frontend in the loop:

| Case | Asserts |
|---|---|
| `test_expired_attempt_cannot_be_submitted` | 409, and all-correct answers still leave the attempt ungraded with zero answer rows |
| `test_submission_one_second_before_deadline_is_accepted` | inside the window still grades |
| `test_submission_exactly_at_deadline_is_accepted` | clock frozen exactly on the deadline → graded |
| `test_submission_one_microsecond_past_deadline_is_rejected` | same frozen deadline + 1 µs → 409 |
| `test_submission_just_past_deadline_is_rejected` | one second over → 409, ungraded |
| `test_untimed_quiz_is_unaffected_by_the_time_limit_check` | 400-day-old untimed attempt still grades |
| `test_started_at_is_read_as_utc_not_local_time` | naive `started_at` read as UTC |
| `test_offset_aware_started_at_is_honoured_not_clobbered` | a `-05:00` start is respected, not overwritten |
| `test_timed_attempt_with_unusable_started_at_fails_closed` (×2) | `""` and `"not-a-timestamp"` → 409, ungraded |
| `test_expiry_is_checked_before_answer_shape_validation` | a would-be-422 payload gets 409 instead |
| `test_already_graded_attempt_still_reports_resubmission_not_expiry` | ordering guard — the resubmission 409 keeps its own message |

Exact-boundary and microsecond cases freeze the service module's `datetime.now` via a
`_ClockAt` stand-in; wall-clock time can never land on the deadline to the microsecond, so
without it the `>` / `>=` distinction would be untestable.

**Mutation-verified three ways** — each mutation breaks a *different* test, so none of the
three properties is accidentally passing:

| Mutation | Result |
|---|---|
| Delete the `_require_within_time_limit(...)` call | 5 rejection tests fail |
| `now > deadline` → `now >= deadline` | `test_submission_exactly_at_deadline_is_accepted` fails |
| Drop the `if started.tzinfo is None` guard | `test_offset_aware_started_at_is_honoured_not_clobbered` fails |

**Frontend:** unchanged. `QuizTimer.tsx` is now a convenience only. `attempt.tsx`'s existing
`handleSubmit` catch already surfaces a failed submission as `submitError`, so the 409 renders
as a message rather than breaking the page. Its timer-expiry auto-submit fires *at* the
deadline, which the inclusive boundary accepts; only a genuinely late arrival (patched client,
skewed clock, or a slow network pushing the request past the deadline) is refused. If late
arrivals on slow connections prove to be a real problem in practice, a small explicit grace
window is the fix — but that is a product decision and was not assumed here.

**Verification:** `pytest src/tests/services/test_quiz_attempts_service.py` → 38 passed;
quiz/question suites + model tests + the whole `src/tests/routers/` tree → **948 passed**;
`uvx ruff@0.15.9 check` on both changed files → All checks passed; `git diff --check` clean.

---

## Error-Detail Disclosure — resolved 2026-08-24 (§19, §54.15)

**The leak.** `apps/api/src/services/utils/link_preview.py` raised
`HTTPException(400, detail=str(exc))` for both SSRF-guard rejections, so the caller received
the guard's own words — `"URL … resolves to blocked address range (10.1.2.3)"` or
`"DNS rebinding detected: connected to 192.168.7.7, validated addresses were [...]"`. Aim the
preview endpoint at a host and read the internal topology back out of the error message; the
guard blocked the *fetch* but the error narrated what it found.

**Fix.** One module-level constant, `_BLOCKED_URL_DETAIL = "This URL cannot be previewed"`,
returned for **every** guard rejection, with the real cause logged server-side:

```python
except SSRFBlockedError as exc:
    logger.warning("Link preview blocked by SSRF guard: %s", exc)
    raise HTTPException(status_code=400, detail=_BLOCKED_URL_DETAIL)
```

All four block reasons — disallowed scheme, blocked hostname, blocked address range, DNS
rebinding — collapse to the same string. A per-reason message would leak the same topology
more slowly: an attacker could still separate "blocked because private range" from "blocked
because bad scheme" and walk the network that way.

This is not a new pattern. `services/orgs/custom_domains.py:597-603` already handles the
identical case exactly this way — `logger.warning("SSL probe refused for %s: %s", …)` followed
by a fixed, reason-free message. `link_preview.py` was the outlier; it now matches.

**Not changed:** `services/webhooks/dispatch.py` also stores `f"SSRF guard: {e}"`, but into
`WebhookDeliveryLog.error_message` — a server-side delivery log read by the org admin who
supplied that URL in the first place, not a response to an arbitrary caller. Different risk
class, deliberately left alone.

**Tests** — `apps/api/src/tests/services/test_link_preview_service.py`:

* Four existing tests that asserted the leaked strings (`"blocked redirect URL"`,
  `"Blocked hostname"`, `"DNS rebinding detected"`, `"blocked redirect peer"`) now assert the
  generic message **and** the absence of the internal token.
* `test_resolve_block_does_not_leak_internal_address_to_client` — a realistic guard message
  carrying `10.1.2.3`; asserts none of seven internal tokens reach the client, and that the
  full message *is* in the server log.
* `test_peer_block_does_not_leak_validated_address_set_to_client` — same for the rebinding
  message and its validated address set.
* `test_every_block_reason_returns_the_same_indistinguishable_message` — parametrized over all
  four guard reasons, asserting they are byte-identical to each other.
* `test_blocked_url_detail_carries_no_network_vocabulary` — guards the constant itself against
  later being made more "helpful".

**Mutation-verified three ways:**

| Mutation | Result |
|---|---|
| Restore `detail=str(exc)` | 10 tests fail |
| Append the reason to the generic message | 10 tests fail (the indistinguishability test bites) |
| Delete the `logger.warning` calls | 2 tests fail — server-side diagnostics are asserted, not assumed |

**Residual, noted not fixed.** The 400 *status code itself* still separates "SSRF-blocked" from
every other preview failure, since the other failure modes (timeout, 4xx/5xx upstream,
non-HTML, oversized) return 200 with a minimal preview card. That leaves a binary oracle —
"does this hostname resolve into a private range?" — without revealing which address. Closing
it would mean returning `_minimal_preview(url)` on a guard rejection too, blending it into the
existing failure modes. That changes the endpoint's contract from 400 to 200, which is a
product/API decision rather than part of this fix, so it is recorded here rather than assumed.
Much weaker than the original leak, and it does not keep §19 open.

**Verification:** `pytest src/tests/services/test_link_preview_service.py` → 28 passed;
link-preview + SSRF-guard + the whole `src/tests/security/` tree + `test_utils_router.py` →
**1379 passed, 4 skipped, 1 pre-existing EE failure** (`test_ee_records`);
`uvx ruff@0.15.9 check` on both changed files → All checks passed; `git diff --check` clean.

---

## Rate Limiting (F2) — resolved 2026-08-24 (§2 rule 17, §21, §22, §54.16, §54.17)

**The finding.** `services/security/rate_limiting.py::check_rate_limit` already existed and was
wired into the inherited LearnHouse surface — login, signup, refresh, password reset, email
verification, invite acceptance and sending, API tokens, admin provisioning/lookup, search, AI.
**No LearnOrbit endpoint used it.** Every LearnOrbit mutation — comments, follows, likes, saves,
shares, reports, channel content, quiz attempts, parent-link requests — could be repeated without
any ceiling, giving both a spam/abuse vector and an application-layer request-rate DoS.

**Strategy: extend, don't replace.** No new limiter, no new Redis architecture, no middleware. Two
functions were added to the existing module, on top of the existing `check_rate_limit` primitive
and its existing `rate_limit:` key namespace:

* `check_learnorbit_rate_limit(action, *, user_id, request)` → `(is_allowed, retry_after)`
* `enforce_learnorbit_rate_limit(action, current_user, request)` → raises 429

Every ceiling lives in one table, `LEARNORBIT_RATE_LIMITS`. Handlers name an *action*, never a raw
key, so a bucket cannot drift per endpoint. The call is the **first statement** of each handler, so
a rejected request never reaches the service and never writes.

**Keying.**

* Authenticated callers → `rate_limit:lo:{action}:user:{user_id}`. The id comes from
  `security/auth.py::resolve_acting_user_id`, so an API token resolves to its creator and cannot be
  used to mint a fresh quota.
* Anonymous callers → `rate_limit:lo:{action}:ip:{client_ip}` via the existing `get_client_ip`,
  capped at `LEARNORBIT_ANON_MAX_ATTEMPTS = 20` per window and never looser than the per-user
  ceiling. Without this an unauthenticated client would bypass the throttle entirely; these
  endpoints reject anonymous callers anyway, so a tight cap costs no legitimate user anything.
* The key contains **no request parameters** — no `org_id`, no `channelvideo_id`, no comment uuid.
  Re-pointing the same abusive action at a different target does not reset the counter. Asserted
  directly by `test_bucket_key_ignores_request_parameters`.
* Authenticated and anonymous buckets are separate, so two students behind one school NAT do not
  share a quota.

**Response.** HTTP 429 with `Retry-After` and the codebase's existing envelope —
`{"code": "RATE_LIMITED", "message": ..., "retry_after": ...}` — the same shape
`enforce_ai_rate_limit` and `enforce_invite_rate_limit` already return, so the frontend's existing
429 handling applies unchanged and **no frontend change was required**. The message is generic: it
names neither the caller, the bucket, nor the backing store (asserted in two tests).

**Limits and rationale.** Sized so a fast, legitimate human stays well under the line and only
automation crosses it.

| Action | Limit | Endpoints | Why this number |
|---|---|---|---|
| `follow_toggle` | 60 / min | `POST`, `DELETE /{org_id}/follow` | Following while browsing a channel list; one per second sustained is already past human |
| `reaction_toggle` | 120 / min | `POST`, `DELETE /{org_id}/videos/{id}/like` · `POST`, `DELETE …/save` | Shorts scrolling is the fastest legitimate interaction on the platform; two reactions a second is a ceiling a person cannot reach |
| `share_create` | 60 / min | `POST …/share` | Append-only, and each call bumps a **public** counter — the count-inflation vector, unlike the idempotent toggles |
| `comment_write` | 20 / min | `POST …/comments` · `PUT`, `DELETE …/comments/{uuid}` | The top spam vector; 20 comments a minute is far beyond typing speed |
| `report_create` | 10 / hour | `POST …/report` | Reports land in a human moderation queue — flooding that queue *is* the abuse |
| `moderation_write` | 60 / min | `PATCH /{org_id}/reports/{uuid}` · `PATCH /{org_id}/verification` | Admin/superadmin triage; bulk report resolution stays comfortable |
| `content_write` | 60 / min | `POST`/`PUT`/`DELETE` on `/{org_id}/videos`, `/{org_id}/resources`, `/{org_id}/questions`, `/{org_id}/quizzes` (incl. `/publish` and quiz-question attach/reorder/detach) — 19 routes | Owner/admin-gated already; a teacher authoring a question bank stays under one write per second |
| `quiz_attempt_start` | 30 / hour | `POST /{org_id}/quizzes/{quiz_id}/attempts` | Each start writes an attempt row; 30 practice attempts an hour is generous for a student |
| `parent_link_write` | 10 / hour | `POST /parent-links/request` · `POST /parent-links/{uuid}/respond` · `POST /parent-links/{uuid}/revoke` | A link request notifies another real person — a harassment and spam vector, so the ceiling is low |

**36 endpoints protected:** 33 in `routers/orgs/orgs.py`, 3 in `routers/users.py`.

**Intentionally not rate-limited, and why.**

* `POST /{org_id}/quizzes/{quiz_id}/attempts/{attempt_id}/submit` — an attempt can be submitted
  exactly once (`submit_quiz_attempt` returns 409 afterwards), so `quiz_attempt_start` already
  bounds it, and a 429 here would throw away a student's finished quiz. This exemption is not just a
  comment: it is the single entry in `EXPECTED_UNPROTECTED` in
  `test_learnorbit_rate_limits_router.py`, so it stays deliberate rather than becoming a gap.
* `PATCH /notifications/{uuid}/read` and `PATCH /notifications/read-all` — they mutate only the
  caller's own rows, expose nothing, and carry no fan-out; repetition costs one bounded `UPDATE`.
  Left out to keep F2 to the abuse-relevant surface.
* Read-only endpoints — deliberately untouched, per the review's own guidance. The DoS side of §22
  is covered for reads by the §39 page-size caps.

**Failure behaviour: fail open, with backoff.** If Redis is unconfigured or unreachable the
LearnOrbit limiter allows the request and logs a warning, then stops calling Redis for
`LEARNORBIT_REDIS_BACKOFF_SECONDS` (30) so an outage does not add a connect timeout to every
request. This is a deliberate, recorded divergence from the auth-side helpers, which surface the
error instead:

* `core/redis.py::get_redis_client` already defines Redis as **optional** for this codebase,
  returning `None` and degrading rather than failing; this follows that established contract.
* These are engagement endpoints, not credential endpoints. Taking comments, likes and follows down
  platform-wide whenever the cache tier blinks is a worse outcome than the spam the ceiling
  prevents — and unlike login, there is nothing here to brute-force.
* Nothing else relaxes: authentication, RBAC, ownership checks, the length and pagination caps, and
  the DB uniqueness constraints on likes/saves/follows all still apply while the limiter is degraded.

Residual risk, recorded not fixed: during a Redis outage the ceilings are absent. Closing that would
mean fail-closed (an availability trade) or a per-worker in-process fallback counter (not a real
ceiling) — both are architectural decisions beyond F2's scope.

**Tests — 29 new, mutation-checked.**

`src/tests/services/test_learnorbit_rate_limiting_service.py` (20) — ceiling allows/denies; every
configured action has a positive ceiling and window; unknown action raises `ValueError`; per-user
isolation; per-action isolation; key ignores request parameters; anonymous keyed by IP; anonymous
ceiling never looser; per-IP isolation; user bucket not shared with the IP bucket; window expiry
restores quota; the counter always carries a TTL; 429 envelope + `Retry-After`; message leaks
nothing; fail-open on Redis error; backoff stops re-dialling; reset clears the backoff.

`src/tests/routers/test_learnorbit_rate_limits_router.py` (9) — a **route-coverage** test that
enumerates every LearnOrbit mutation route on both routers and fails if one is unprotected and not
in `EXPECTED_UNPROTECTED`; a test that every wired handler names a declared action; a test that the
limiter is the handler's first statement; and six over-HTTP tests (under-limit behaviour unchanged,
over-limit 429 with the service never awaited, no internals in the body, one user cannot spend
another's quota, window expiry restores access, endpoint still works when Redis is down).

**Mutation-verified four ways:**

| Mutation | Result |
|---|---|
| Drop the limiter from one handler (comment create) | `test_every_learnorbit_mutation_route_is_rate_limited` fails |
| Make the limiter always allow | 14 tests fail |
| Key anonymous callers to one shared bucket instead of per-IP | 3 tests fail |
| Move the limiter after the service call | `test_limiter_runs_before_the_service_does` fails |

Each mutation was reverted and the suite re-passed.

**Test-infrastructure note.** `src/tests/conftest.py` gained an autouse `isolated_rate_limit_store`
fixture giving each test its own in-memory store, and the stub itself lives in
`src/tests/fixtures/fake_redis.py`. The limiter now runs *inside* the endpoints under test, and CI
has no Redis while a developer machine usually has the dev Redis up — without this the same test
would fail open in CI, share counters with the live dev instance locally, and accumulate across
reruns inside a 60-second window. Test-only; no production code depends on it.

**Verification.** `pytest src/tests/services/test_learnorbit_rate_limiting_service.py
src/tests/routers/test_learnorbit_rate_limits_router.py` → **29 passed**. Full API suite
(`pytest src/tests/`) → **5757 passed, 29 skipped, 11 failed in 15:12** — all 11 failures are
**pre-existing and unrelated**, and were confirmed as such by re-running them with every file
changed by this increment stashed (same 11 failures): three EE-gate tests
(`test_core_events.py::test_register_ee_helpers_and_startup`,
`test_core_events_runtime.py::test_ee_hook_registration_and_paid_access`,
`test_active_users.py::TestRecordActivity::test_ee_records`), three
`test_custom_domains_service.py`, three `test_org_invites_service.py`, two
`test_podcasts_service.py` — all in inherited LearnHouse code that F2 does not touch.
`uvx ruff@0.15.9 check` on all changed backend files → **All checks passed**. `git diff --check`
→ clean. No frontend file changed, so ESLint/tsc were not re-run; no browser verification was
needed (backend-only, no UI change).
