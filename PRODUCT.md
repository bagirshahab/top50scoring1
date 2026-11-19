# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing: static HTML, CSS and vanilla JavaScript on Vercel, serverless API routes (Node), Neon Postgres. No framework. Keep it.

## Users
- **Judges** (7 accounts: 2 CPG-True, 2 AWS, 1 educator, others by the organizers). They sit at the Demo Day venue (22 Nov) with a tablet, mostly landscape, while a team pitches for 6 minutes and answers questions for 4. They score each team on five weighted criteria and may reopen a score to change it. Their attention belongs to the stage; the interface must be fast to read and hard to mis-tap. (Inferred from the brief and the judging rubric image; confirm.)
- **Admin / organizers.** Add the 20 project links, set the presentation order, check that every link works, mark fallbacks, create judge accounts, import submission-form exports, and watch the ranking live.
- **Public viewers** of the leaderboard (read only, no sign-in).

## Product Purpose
Run the AI For All Hackathon Demo Day judging: Top 20 teams to Top 5. Judges score live prototypes (opened from each team's web link) on five weighted criteria; the platform averages the scores, ranks the teams, and shows the cut line for the Top 5. Success is every judge scoring every team without losing or overwriting a score by accident, and organizers trusting the ranking.

## Positioning
Purpose-built for this hackathon's rubric: the weights are fixed (Working prototype 30, Problem & Impact 20, Solution Fit & Insight 20, Feasibility & Risk 15, Pitch & Team 15) and the scoring guide with HIGH and LOW anchors is shown beside each slider. It also copes with the real failure of the day: a team's published link that does not open (link check, fallback to video or screenshot, still scored normally).

## Operating Context
- Tablet at a venue, possibly shared between judges, on venue Wi-Fi that may be slow or drop.
- Teams present in a fixed order set by the admin (1 to 20). Judges move between projects quickly.
- Scores can be edited while judging is open. A saved score opens read-only until the judge chooses to edit.
- Submission form data (team number, Bedrock used, AgentCore, website, repo, video links) is imported as CSV or JSON; the latest submission per team number wins.

## Capabilities and Constraints
- Max 20 projects. Team number 1 to 99, unique.
- Scores are integers 1 to 100 per criterion; weighted average ranks teams.
- Judges' sign-in is limited to the judging window (server and client).
- Light and dark themes (follows the device, user can switch). English UI.
- Keep it static HTML/CSS/JS; no build step.

## Brand Commitments
- Name: **AI For All Hackathon**. Wordmark: all caps, red to cyan gradient (first seen on the login screen).
- Palette anchors from the hackathon identity: strong red (#E60000) and bright cyan (#22D3EE) on a near-black navy ground; the user rejected replacing the success green with blue.
- Icons: Cloudscape iconography (16px grid, 2px strokes). No emoji. The user wants the interface to read as formal and professional.
- Copy is plain and professional; no marketing superlatives.

## Evidence on Hand
No real testimonials, customer logos, or statistics, and none may be invented. All current project rows are test data (test, test 2 ... test 6) and must not be presented as real teams. Judge credentials exist and must never appear in the UI or repo.

## Product Principles
1. A score is precious: nothing the judge did can be lost or overwritten by accident (confirm on leaving, read-only once scored, default of 1).
2. At the venue, glanceable beats decorative: the stage has the judge's eyes, the tablet gets a glance.
3. One honest source for every number: the ranking is the weighted average of submitted scores and says how many judges have scored.
4. Failure is a normal state: dead links, slow networks, and missing videos each have a visible, calm path.
5. Formal by default; the hackathon colors identify, they do not decorate.

## Accessibility & Inclusion
WCAG AA contrast in both themes, 44px minimum touch targets, full keyboard operation with visible focus, `prefers-reduced-motion` respected, status never conveyed by color alone.
