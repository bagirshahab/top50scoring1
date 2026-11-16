// =====================================================================
//  criteria.js — Demo Day judging criteria (shared by judge + admin + leaderboard)
//  Round 2 · Demo Day · Top 20 -> Top 5.
//  Keep weights in sync with api/scores.js (they must add up to 100).
// =====================================================================
const CRITERIA = [
  {
    key: "prototype", name: "Working prototype", short: "Prototype", weight: 30, color: "#22D3EE",
    desc: "A live, running demo of the core idea built at the Bootcamp, with AI doing the main job. A prototype, not an MVP.",
    high: "The flow runs end to end on real input and the team handles an unplanned request in Q&A.",
    low: "Mostly slides or screenshots, or the flow stops partway.",
  },
  {
    key: "problem", name: "Problem & Impact", short: "Problem", weight: 20, color: "#8B5CF6",
    desc: "A real Thai problem on one of the six themes, sized with reliable data, and who is affected.",
    high: "The problem is specific, backed by checkable data, and the change for users is shown.",
    low: "Broad or generic, figures without a source, or impact only claimed.",
  },
  {
    key: "solution", name: "Solution Fit & Insight", short: "Solution", weight: 20, color: "#8B5CF6",
    desc: "The build follows from the problem, AI is the right tool, and the team knows what already exists.",
    high: "A clear fit, and an insight the team gained from the people it wants to help.",
    low: "AI added for its own sake, or a common idea with no sign of knowing the users.",
  },
  {
    key: "feasibility", name: "Feasibility & Risk", short: "Feasibility", weight: 15, color: "#8B5CF6",
    desc: "How realistic the path is from prototype to a real service: data, cost, skills, partners, adoption.",
    high: "A believable plan, with risks such as AI accuracy, privacy and bias named unprompted.",
    low: "Unrealistic assumptions, or privacy and accuracy ignored.",
  },
  {
    key: "pitch", name: "Pitch & Team", short: "Pitch", weight: 15, color: "#8B5CF6",
    desc: "A clear story in the 6-minute pitch, confident 4-minute Q&A, and the whole team taking part.",
    high: "The story is clear, fits the time, and the team shares the work.",
    low: "Over-runs, hard to follow, or one person does everything.",
  },
];

const TOP_N = 5; // projects that advance from Top 20 to Top 5
