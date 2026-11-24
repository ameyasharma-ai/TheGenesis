export type Role = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  title: string;
  personalityId: string;
  createdAt: string;
  messages: ChatMessage[];
};

export type EventCountdown = {
  id: string;
  title: string;
  date: string;
  note: string;
};

export type HabitRelapse = {
  id: string;
  occurredAt: string;
  note: string;
};

export type Habit = {
  id: string;
  name: string;
  notes: string;
  relapses: HabitRelapse[];
};

export type TodoTask = {
  id: string;
  title: string;
  date: string;
  done: boolean;
  notes: string;
  notDone?: boolean;
};

export type WeeklyLesson = {
  id: string;
  date: string;
  lesson: string;
};

export type WeeklyBlock = {
  weekStart: string;
  rewardTitle: string;
  rewardUnlocked: boolean;
  rewardClaimed: boolean;
  archived?: boolean;
  tasks: TodoTask[];
  lessons: WeeklyLesson[];
};

export type MotivationalCard = {
  id: string;
  quote: string;
  note: string;
  tag: string;
};

export type PlanNode = {
  id: string;
  parentId: string | null;
  title: string;
  period: string;
  ifThis: string;
  thenDo: string;
  branchLabel?: string;
  progressMetric?: string;
  riskLevel?: "low" | "medium" | "high";
};

export type LibraryLesson = {
  id: string;
  title: string;
  content: string;
  tags: string;
  createdAt: string;
};

export type LifeRule = {
  id: string;
  rule: string;
  reason: string;
};

export type SocialProtocol = {
  id: string;
  person: string;
  protocol: string;
  reason: string;
  boundaries: string;
};

export type MentalHealthState = {
  innerCircle: string[];
  thingsILove: string[];
  groundingTools: string[];
  lowPointPlan: string[];
  physicalHealthHabits?: string[];
  movementPlan?: string[];
  nutritionAnchors?: string[];
  sleepProtocol?: string[];
  mindBodyQuote?: string;
};

export type GratitudeItem = {
  id: string;
  title: string;
  detail: string;
  category: "achievement" | "gratitude";
  date: string;
};

export type Personality = {
  id: string;
  label: string;
  prompt: string;
};

export type WallpaperAsset = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
};

export type AppSettings = {
  theme: "midnight" | "sunrise" | "forest";
  goalLine: string;
  wallpapers: Record<string, string>;
  wallpaperHistory?: WallpaperAsset[];
  activePersonalityId: string;
  personalities: Personality[];
};

export type AppState = {
  dashboardQuote: string;
  dashboardSubQuote: string;
  events: EventCountdown[];
  habits: Habit[];
  weeklyTodos: WeeklyBlock[];
  motivationalCards: MotivationalCard[];
  planNodes: PlanNode[];
  lessonsLibrary: LibraryLesson[];
  lifeRules: LifeRule[];
  socialProtocols: SocialProtocol[];
  mentalHealth: MentalHealthState;
  gratitude: GratitudeItem[];
  settings: AppSettings;
  chatSessions: ChatSession[];
};
