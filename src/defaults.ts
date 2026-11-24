import { AppState } from "./types";

export const createDefaultState = (): AppState => ({
  dashboardQuote:
    "Ten years from now, you will thank yourself for choosing disciplined action today. This moment is your answered prayer and your turning point.",
  dashboardSubQuote: "Belief is half the work; consistent execution completes it.",
  events: [],
  habits: [],
  weeklyTodos: [],
  motivationalCards: [
    {
      id: "seed-quote-1",
      quote: "Small wins repeated daily become a remarkable life.",
      note: "Momentum beats motivation when the day gets hard.",
      tag: "Consistency",
    },
    {
      id: "seed-quote-2",
      quote: "Discomfort is tuition for the future you want.",
      note: "Choose useful pain over regret.",
      tag: "Growth",
    },
  ],
  planNodes: [
    {
      id: "root",
      parentId: null,
      title: "10-Year Winning Path",
      period: "2026-2036",
      ifThis: "Progress slows for two weeks",
      thenDo: "Reduce scope by 30%, protect habits, keep moving daily",
      branchLabel: "",
      progressMetric: "",
      riskLevel: "medium",
    },
  ],
  lessonsLibrary: [],
  lifeRules: [],
  socialProtocols: [],
  mentalHealth: {
    innerCircle: [],
    thingsILove: [],
    groundingTools: [],
    lowPointPlan: [],
    physicalHealthHabits: [],
    movementPlan: [],
    nutritionAnchors: [],
    sleepProtocol: [],
    mindBodyQuote: "A calm mind amplifies physical strength, and a strong body protects emotional resilience.",
  },
  gratitude: [],
  settings: {
    theme: "midnight",
    goalLine:
      "This webapp will be used at least until I have INR 25L in my bank account",
    wallpapers: {
      gratitude:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80",
    },
    activePersonalityId: "mentor",
    personalities: [
      {
        id: "girlfriend",
        label: "Girlfriend",
        prompt:
          "You are affectionate, emotionally warm, encouraging, and optimistic. Keep responses supportive, practical, and grounded in the user's long-term goals. Speak naturally and avoid overusing bold markdown stars.",
      },
      {
        id: "mentor",
        label: "Mentor",
        prompt:
          "You are a high-performance mentor. Be direct, strategic, concise, and action-oriented. Give clear plans with measurable next steps. Speak naturally and avoid overusing bold markdown stars.",
      },
      {
        id: "strategist",
        label: "Strategist",
        prompt:
          "You are a systems thinker. Turn goals into frameworks, decision trees, and robust fallback plans with risk management. Speak naturally and avoid overusing bold markdown stars.",
      },
    ],
  },
  chatSessions: [],
});
