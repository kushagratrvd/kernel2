# Architecture Overview

## System Map

```
====================================================================================================
                                      USER INTERFACE LAYER (Next.js)
====================================================================================================

  [ CREATOR ROLE ]                [ REVIEWER ROLE ]               [ ADMIN ROLE ]
  • Question Studio               • Reviewer Desk                 • Admin Operations
    (/dashboard/questions)          (/dashboard/reviews)            (/dashboard)
  • AI Generator Studio           • Thread Inspection Modal       • Contest Management
    (/dashboard/questions/ai)       (<ReviewDiscussionThread />)    (/dashboard/contests/*)
                                                                  • Users & Roles Admin
                                                                    (/dashboard/admin/users)

                                      [ STUDENT ROLE ]
                                      • Student Contest Hub & History (/contest)
                                      • Live Exam Workspace (/contest/[code]/attempt)
                                      • Post-Contest Review Workspace (/contest/[code]/review)

====================================================================================================
                                   API & MIDDLEWARE LAYER (tRPC)
====================================================================================================

      ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
      │   questionBankRouter      │       aiRouter            │      contestRouter        │
      ├───────────────────────────┼───────────────────────────┼───────────────────────────┤
      │ • create / updateDraft    │ • generateQuestions       │ • listAll (Admin)         │
      │ • submitForReview         │ • saveGeneratedQuestions  │ • create / edit (Admin)   │
      │ • startReview             │ • runCode (Codebox test)  │ • add/removeQuestion(Admin│
      │ • completeReview          │ • listKeys / addKey       │ • getByCode / join(Student│
      │ • getReviewThread         │                           │ • submitCode / finish     │
      │ • addComment              │                           │ • getResults / getReview  │
      │ • adminReject / Restore   │                           │ • adminGetSubmissions     │
      │ • archive / unarchive     │                           │ • adminGetStudentSubs     │
      │ • getReviewThread         │                           │ • adminGetParticipants    │
      │ [creatorOrReviewerProc]   │ [creatorProcedure]        │ [adminProcedure / protProc│
      └─────────────┬─────────────┴─────────────┬─────────────┴─────────────┬─────────────┘
                    │                           │                           │
                    │                           │                           │
                    ▼                           ▼                           ▼
====================================================================================================
                                   SERVICES & DATA STORAGE LAYER
====================================================================================================

  ┌──────────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
  │         PostgreSQL Database (Neon DB)        │    │         Remote Services & AI             │
  ├──────────────────────────────────────────────┤    ├──────────────────────────────────────────┤
  │ • users, accounts, sessions (Better Auth)    │    │ • Codebox Sandbox Service                │
  │ • question, questionDraft, questionVersion   │    │   (Isolated compilation & test execution)│
  │ • questionAssignment, questionComment        │    │                                          │
  │ • contest, contestQuestion                   │    │ • Google Gemini 2.5 Pro / Flash          │
  │ • contestParticipation, submission           │    │ • Groq LLaMA 3.3 Models (BYOK)           │
  │ • auditLog                                   │    │                                          │
  └──────────────────────────────────────────────┘    └──────────────────────────────────────────┘

====================================================================================================
                        EXTERNAL INTEGRATION REST API LAYER (/api/v1/...)
====================================================================================================

  [ CareerForge Spring Boot Backend ] 
            │ (Server-to-Server with X-Kernel-Api-Key)
            ▼
  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ Next.js App Router REST Route Handlers (src/app/api/v1/...)                            │
  ├────────────────────────────────────────────────────────────────────────────────────────┤
  │ • authenticateApiKey (Header-based API key validation guard)                           │
  │ • GET /api/v1/contests (Active, upcoming, and concluded contests feed)                 │
  │ • GET /api/v1/contests/:code/leaderboard (Contest leaderboard with DB clock time-lock) │
  │ • GET /api/v1/students/:email/contests (Student scorecards & contest history)          │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Entities & Roles
- **Question & Question Version**: Mutable drafts with immutable version snapshots (`questionVersion`) upon submission.
- **Question Assignment & Comments**: Peer review lifecycle (`PENDING` -> `IN_REVIEW` -> `COMPLETED`), with verdicts (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`) and conversation thread (`questionComment`).
- **Contest & Contest Questions**: Administrative contest scheduling with snapshot versions of approved questions.
- **External Integration Guard**: Authenticates third-party backend platforms via `X-Kernel-Api-Key`, enforcing database-level time-locks (`NOW() >= endTime`) to protect active exam results from premature leakage.
