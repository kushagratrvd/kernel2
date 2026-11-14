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
```

---

## Key Entities & Roles
- **Question & Question Version**: Mutable drafts with immutable version snapshots (`questionVersion`) upon submission.
- **Question Assignment & Comments**: Peer review lifecycle (`PENDING` -> `IN_REVIEW` -> `COMPLETED`), with verdicts (`APPROVED`, `CHANGES_REQUESTED`, `REJECTED`) and conversation thread (`questionComment`).
- **Contest & Contest Questions**: Administrative contest scheduling with snapshot versions of approved questions.
