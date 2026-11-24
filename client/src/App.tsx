import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import dayjs from "dayjs";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import defaultWallpaper from "./assets/model.jpg";
import defaultMobileWallpaper from "./assets/mobile.jpg";
import "./App.css";

const MarkdownText = ({ content }: { content: string }) => {
  // Simple regex-based markdown formatter for natural look
  const formatted = useMemo(() => {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
      .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italics
      .replace(/\n/g, "<br />"); // Line breaks
  }, [content]);

  return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
};

type Role = "user" | "assistant";
type Theme = "midnight" | "sunrise" | "forest";
type TabKey =
  | "dashboard"
  | "events"
  | "habits"
  | "todo"
  | "quotes"
  | "plan"
  | "lessons"
  | "rules"
  | "social"
  | "mental"
  | "gratitude";

type TodoTask = { id: string; title: string; date: string; done: boolean; notDone?: boolean; notes: string };
type WeeklyLesson = { id: string; date: string; lesson: string };
type ChatMessage = { id: string; role: Role; content: string; createdAt: string };
type ChatSession = { id: string; title: string; personalityId: string; createdAt: string; messages: ChatMessage[] };
type WeeklyBlock = {
  weekStart: string;
  rewardTitle: string;
  rewardUnlocked: boolean;
  rewardClaimed: boolean;
  archived?: boolean;
  tasks: TodoTask[];
  lessons: WeeklyLesson[];
  dailyRewards?: Record<string, string>; // date -> reward
  dailyNotes?: Record<string, string>;   // date -> note
  dailyRewardsClaimed?: Record<string, boolean>; // date -> claimed status
};
type WallpaperAsset = { id: string; name: string; dataUrl: string; createdAt: string; device: "pc" | "mobile" };
type PlanNode = {
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
type AppState = {
  dashboardQuote: string;
  dashboardSubQuote: string;
  events: { id: string; title: string; date: string; note: string }[];
  habits: { id: string; name: string; notes: string; relapses: { id: string; occurredAt: string; note: string }[] }[];
  weeklyTodos: WeeklyBlock[];
  motivationalCards: { id: string; quote: string; note: string; tag: string }[];
  planNodes: PlanNode[];
  lessonsLibrary: { id: string; title: string; content: string; tags: string; createdAt: string }[];
  lifeRules: { id: string; rule: string; reason: string }[];
  socialProtocols: { id: string; person: string; protocol: string; reason: string; boundaries: string }[];
  mentalHealth: {
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
  gratitude: { id: string; title: string; detail: string; category: "achievement" | "gratitude"; date: string }[];
  settings: {
    theme: Theme;
    goalLine: string;
    wallpapers: Record<string, string>;
    mobileWallpapers: Record<string, string>;
    wallpaperHistory?: WallpaperAsset[];
    activePersonalityId: string;
    personalities: { id: string; label: string; prompt: string }[];
  };
  chatSessions: ChatSession[];
};

const apiBase = "http://localhost:8787/api";
const tokenKey = "genesis_token";
const gratitudeWallpaper =
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80";
const maxWallpaperHistory = 6;

const defaultMindBodyQuote =
  "A calm mind amplifies physical strength, and a strong body protects emotional resilience.";

const defaultMentalHealth = {
  innerCircle: [] as string[],
  thingsILove: [] as string[],
  groundingTools: [] as string[],
  lowPointPlan: [] as string[],
  physicalHealthHabits: [] as string[],
  movementPlan: [] as string[],
  nutritionAnchors: [] as string[],
  sleepProtocol: [] as string[],
  mindBodyQuote: defaultMindBodyQuote,
};

const uid = () => crypto.randomUUID();

const weekStart = (date: string) => {
  const d = dayjs(date);
  const day = d.day();
  return d.subtract(day === 0 ? 6 : day - 1, "day").format("YYYY-MM-DD");
};
const weekEnd = (weekStartDate: string) => dayjs(weekStartDate).add(6, "day").format("YYYY-MM-DD");
const weekKey = (w: WeeklyBlock) => `${w.weekStart}_${w.rewardTitle}`;

const getIstDayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

const normalizeState = (incoming: AppState): AppState => {
  // Only add defaults for missing fields, don't overwrite existing data
  return {
    dashboardQuote: incoming.dashboardQuote || "",
    dashboardSubQuote: incoming.dashboardSubQuote || "",
    events: incoming.events || [],
    habits: incoming.habits || [],
    weeklyTodos: (incoming.weeklyTodos || []).map((w) => ({
      ...w,
      archived: w.archived ?? false,
      tasks: (w.tasks || []).map((task) => ({ 
        ...task, 
        notDone: task.notDone ?? false,
        notes: task.notes || "",
      })),
      lessons: w.lessons || [],
      dailyRewards: w.dailyRewards || {},
      dailyNotes: w.dailyNotes || {},
      dailyRewardsClaimed: w.dailyRewardsClaimed || {},
    })),
    motivationalCards: incoming.motivationalCards || [],
    planNodes: (incoming.planNodes || []).map((node) => ({
      ...node,
      branchLabel: node.branchLabel || "",
      progressMetric: node.progressMetric || "",
      riskLevel: node.riskLevel || "medium",
    })),
    lessonsLibrary: incoming.lessonsLibrary || [],
    lifeRules: incoming.lifeRules || [],
    socialProtocols: incoming.socialProtocols || [],
    mentalHealth: {
      ...defaultMentalHealth,
      ...incoming.mentalHealth,
    },
    gratitude: incoming.gratitude || [],
    settings: {
      theme: incoming.settings?.theme || "midnight",
      goalLine: incoming.settings?.goalLine || "",
      wallpapers: {
        gratitude: gratitudeWallpaper,
        global: defaultWallpaper,
        ...(incoming.settings?.wallpapers || {}),
      },
      mobileWallpapers: {
        global: defaultMobileWallpaper,
        ...(incoming.settings?.mobileWallpapers || {}),
      },
      wallpaperHistory: (incoming.settings?.wallpaperHistory || []).map(w => ({
        ...w,
        device: w.device || "pc"
      })),
      activePersonalityId: incoming.settings?.activePersonalityId || "mentor",
      personalities: incoming.settings?.personalities || [],
    },
    chatSessions: (incoming.chatSessions || []).map(s => ({
      ...s,
      personalityId: s.personalityId || "mentor"
    })),
  };
};

const formatDateRange = (start: string) =>
  `${dayjs(start).format("DD MMM")} - ${dayjs(weekEnd(start)).format("DD MMM")}`;

const WeeklyTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { week: string; score: number; completed: number; total: number; notDone: number; pending: number; lessons: number; rewardClaimed: boolean; dailyRewardsClaimedCount: number } }[] }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{data.week}</strong>
      <small>Completion: {data.score}%</small>
      <small>Tasks: {data.completed}/{data.total} done</small>
      <small>Not Done: {data.notDone || 0}</small>
      <small>Pending: {data.pending}</small>
      <small>Daily Rewards: {data.dailyRewardsClaimedCount}/7 claimed</small>
      <small>Lessons: {data.lessons}</small>
      <small>Reward: {data.rewardClaimed ? "Claimed" : "Not claimed"}</small>
    </div>
  );
};

const PerformanceChart = ({ data }: { data: { week: string; score: number; completed: number; total: number; notDone: number; pending: number; lessons: number; rewardClaimed: boolean; dailyRewardsClaimedCount: number }[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No weekly data yet. Add tasks to your weekly todos to see your performance trend.</p>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <XAxis 
            dataKey="week" 
            stroke="#8ca3ff" 
            tick={{ fill: "#8ca3ff", fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            height={70}
          />
          <YAxis 
            stroke="#8ca3ff" 
            tick={{ fill: "#8ca3ff", fontSize: 11 }}
            domain={[0, 100]}
            width={40}
          />
          <Tooltip content={<WeeklyTooltip />} />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#8effc1" 
            strokeWidth={4}
            dot={{ fill: "#8effc1", r: 5 }}
            activeDot={{ r: 8, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const sectionLabels: Record<string, string> = {
  innerCircle: "Inner Circle",
  thingsILove: "Things I Love",
  groundingTools: "Grounding Tools",
  lowPointPlan: "Low-Point Plan",
  physicalHealthHabits: "Physical Habits",
  movementPlan: "Movement Plan",
  nutritionAnchors: "Nutrition Anchors",
  sleepProtocol: "Sleep Protocol",
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(data.error || "Request failed");
  }
  return (await res.json()) as T;
}

function App() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<TabKey>(
    (localStorage.getItem("genesis_last_tab") as TabKey) || "dashboard"
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [aiBusy, setAiBusy] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [quoteEdit, setQuoteEdit] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(1500);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [lmModel, setLmModel] = useState("");
  const [models, setModels] = useState<{ id: string; name: string; isLocal: boolean }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [historyWeek, setHistoryWeek] = useState<string>("");
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [wallpaperTarget, setWallpaperTarget] = useState<TabKey>("dashboard");
  const [wallpaperDevice, setWallpaperDevice] = useState<"pc" | "mobile">("pc");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [wallpaperDragActive, setWallpaperDragActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const activeChat = useMemo(
    () => state?.chatSessions.find((c) => c.id === selectedChatId) || null,
    [state?.chatSessions, selectedChatId]
  );

  useEffect(() => {
    const currentCount = activeChat?.messages?.length || 0;
    if (messagesEndRef.current && currentCount > prevMessageCountRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }
    }
    prevMessageCountRef.current = currentCount;
  }, [activeChat?.messages?.length]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const [mentalQuoteEdit, setMentalQuoteEdit] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await api("/auth/me");
        const appState = normalizeState(await api<AppState>("/state"));
        setState(appState);
        setSelectedChatId(appState.chatSessions?.[0]?.id || null);
        setIsInitialLoad(false);
      } catch (err) {
        console.error("Bootstrap error:", err);
        localStorage.removeItem(tokenKey);
        setIsInitialLoad(false);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!state || isInitialLoad) return;
    
    const timeoutId = setTimeout(() => {
      console.log("Saving state...", { weeklyTodosCount: state.weeklyTodos?.length });
      api("/state", { method: "PUT", body: JSON.stringify(state) })
        .then(() => {
          console.log("State saved successfully");
        })
        .catch((err) => {
          console.error("Failed to save state:", err);
          alert("Failed to save changes. Please check console for details.");
        });
    }, 500); // Reduced debounce to 500ms for faster saves
    return () => clearTimeout(timeoutId);
  }, [state, isInitialLoad]);

  useEffect(() => {
    if (!state) return;
    const today = dayjs();
    let changed = false;
    const nextWeeks = state.weeklyTodos.map((week) => {
      const ended = dayjs(weekEnd(week.weekStart)).isBefore(today, "day");
      if (!week.archived && ended) {
        changed = true;
        return { ...week, archived: true };
      }
      return week;
    });
    if (changed) setState({ ...state, weeklyTodos: nextWeeks });
  }, [state]);

  useEffect(() => {
    if (!pomodoroRunning) return;
    const timer = setInterval(() => setPomodoroSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [pomodoroRunning]);

  useEffect(() => {
    if (pomodoroSeconds === 0) setPomodoroRunning(false);
  }, [pomodoroSeconds]);

  useEffect(() => {
    localStorage.setItem("genesis_last_tab", tab);
  }, [tab]);

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setMessageError("");
    try {
      const data = await api<{ models: { id: string; name: string; isLocal: boolean }[] }>("/ai/models");
      setModels(data.models);
      setLmModel((currentModel) => currentModel || data.models[0]?.id || "");
    } catch (err) {
      // Don't show full error on mobile if it's just local model failing
      if (!isMobile) setMessageError(err instanceof Error ? err.message : "Unable to fetch models");
    } finally {
      setModelsLoading(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (state && models.length === 0) fetchModels().catch(() => undefined);
  }, [state, models.length, fetchModels]);

  useEffect(() => {
    if (models.length > 0 && !lmModel) {
      setLmModel(models[0].id);
    }
  }, [models, lmModel]);

  const activeThemeStyle = useMemo(() => {
    if (!state) return {};
    const wallSet = isMobile ? state.settings.mobileWallpapers : state.settings.wallpapers;
    const defaultWall = isMobile ? defaultMobileWallpaper : defaultWallpaper;
    const wall = wallSet[tab] || wallSet["global"] || defaultWall;
    return {
      backgroundImage: `url(${wall})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
    };
  }, [state, tab, isMobile]);

  const weeklyProgress = useMemo(() => {
    if (!state || !state.weeklyTodos || state.weeklyTodos.length === 0) {
      console.log("No weekly todos data");
      return [];
    }
    const progress = state.weeklyTodos
      .map((w) => {
        const tasks = w.tasks || [];
        const completed = tasks.filter((t) => t.done).length;
        const notDone = tasks.filter((t) => t.notDone).length;
        const total = tasks.length;
        const safeTotal = total || 1;
        const score = Math.round((completed / safeTotal) * 100);
        const dailyRewardsClaimedCount = Object.values(w.dailyRewardsClaimed || {}).filter(Boolean).length;
        return {
          weekStart: w.weekStart,
          week: `Week ${formatDateRange(w.weekStart)}`,
          score,
          completed,
          total,
          notDone,
          pending: Math.max(total - completed - notDone, 0),
          lessons: (w.lessons || []).length,
          rewardClaimed: w.rewardClaimed || false,
          dailyRewardsClaimedCount,
        };
      })
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    // Sliding window: only show the last 8 weeks for better dynamic visualization
    const limitedProgress = progress.slice(-8);
    console.log("Weekly progress calculated (limited):", limitedProgress);
    return limitedProgress;
  }, [state]);

  const dayScore = useMemo(() => {
    if (!state) return 0;
    const today = dayjs().format("YYYY-MM-DD");
    const currentWeek = state.weeklyTodos.find((w) => w.weekStart === weekStart(today));
    if (!currentWeek) return 0;
    const tasks = currentWeek.tasks.filter((t) => t.date === today);
    const completed = tasks.filter((t) => t.done).length;
    const total = tasks.length || 1;
    return Math.round((completed / total) * 100);
  }, [state]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "events", label: "Event Countdown" },
    { key: "habits", label: "Habits Tracker" },
    { key: "todo", label: "ToDo + Calendar" },
    { key: "quotes", label: "Motivational Quotes" },
    { key: "plan", label: "Plan Builder" },
    { key: "lessons", label: "Lessons Library" },
    { key: "rules", label: "Rules For Life" },
    { key: "social", label: "Social Protocols" },
    { key: "mental", label: "Mental Health" },
    { key: "gratitude", label: "Gratefulness" },
  ];

  const updateWeek = (targetWeekStart: string, updater: (week: WeeklyBlock) => WeeklyBlock) => {
    if (!state) return;
    setState({
      ...state,
      weeklyTodos: state.weeklyTodos.map((week) =>
        week.weekStart === targetWeekStart ? updater(week) : week
      ),
    });
  };

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Unable to read image file"));
      reader.readAsDataURL(file);
    });

  const saveWallpapers = async (files: FileList | File[]) => {
    if (!state) return;
    const list = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 3);
    if (!list.length) return;
    const mapped = await Promise.all(
      list.map(async (file) => ({
        id: uid(),
        name: file.name,
        dataUrl: await toDataUrl(file),
        createdAt: new Date().toISOString(),
        device: wallpaperDevice,
      }))
    );
    const nextHistory = [...mapped, ...(state.settings.wallpaperHistory || [])].slice(0, maxWallpaperHistory);
    const wallKey = wallpaperDevice === "mobile" ? "mobileWallpapers" : "wallpapers";
    setState({
      ...state,
      settings: {
        ...state.settings,
        [wallKey]: {
          ...state.settings[wallKey],
          [wallpaperTarget]: mapped[0].dataUrl,
        },
        wallpaperHistory: nextHistory,
      },
    });
  };

  const setWallpaper = (url: string, device: "pc" | "mobile") => {
    if (!state) return;
    const wallKey = device === "mobile" ? "mobileWallpapers" : "wallpapers";
    setState({
      ...state,
      settings: {
        ...state.settings,
        [wallKey]: {
          ...state.settings[wallKey],
          [wallpaperTarget]: url,
        },
      },
    });
  };

  const ensureWeekAndAddTask = (date: string) => {
    if (!state) return;
    const start = weekStart(date);
    setState((prev) => {
      if (!prev) return prev;
      const existing = prev.weeklyTodos.find((w) => w.weekStart === start);
      const withWeek = existing
        ? prev.weeklyTodos
        : [
            ...prev.weeklyTodos,
            {
              weekStart: start,
              rewardTitle: "Weekly Reward",
              rewardUnlocked: false,
              rewardClaimed: false,
              archived: false,
              tasks: [],
              lessons: [],
            },
          ];
      return {
        ...prev,
        weeklyTodos: withWeek.map((week) =>
          week.weekStart === start
            ? {
                ...week,
                tasks: [...week.tasks, { id: uid(), title: "New Task", date, done: false, notes: "" }],
              }
            : week
        ),
      };
    });
  };

  const authSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const data = await api<{ token: string }>(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      localStorage.setItem(tokenKey, data.token);
      const appState = normalizeState(await api<AppState>("/state"));
      setState(appState);
      setSelectedChatId(appState.chatSessions[0]?.id || null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const sendMessage = async () => {
    if (!state || !activeChat || !chatInput.trim() || aiBusy) return;
    const prompt = chatInput.trim();
    const personality = state.settings.personalities.find((p) => p.id === activeChat.personalityId);
    const outgoing: ChatMessage = { id: uid(), role: "user", content: prompt, createdAt: new Date().toISOString() };
    const assistantDraft: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };
    const historyPayload = activeChat.messages.map((m) => ({ role: m.role, content: m.content }));

    // Prepare context from AppState (excluding chat sessions to keep context clean)
    const contextData = {
      today: dayjs().format("dddd, DD MMMM YYYY"),
      dashboardQuote: state.dashboardQuote,
      dashboardSubQuote: state.dashboardSubQuote,
      events: state.events.map(e => ({ title: e.title, date: e.date, note: e.note })),
      habits: state.habits.map(h => ({ 
        name: h.name, 
        notes: h.notes,
        relapses: h.relapses.map(r => ({ date: r.occurredAt, note: r.note }))
      })),
      weeklyTodos: state.weeklyTodos.filter(w => !w.archived).map(w => ({ 
        week: w.weekStart, 
        tasks: w.tasks.map(t => ({ title: t.title, done: t.done })),
        dailyRewards: w.dailyRewards,
        dailyNotes: w.dailyNotes,
        dailyRewardsClaimed: w.dailyRewardsClaimed
      })),
      motivationalCards: state.motivationalCards.map(c => ({ quote: c.quote, note: c.note, tag: c.tag })),
      planNodes: state.planNodes.map(n => ({ 
        title: n.title, 
        period: n.period,
        ifThis: n.ifThis,
        thenDo: n.thenDo,
        branchLabel: n.branchLabel,
        progressMetric: n.progressMetric,
        riskLevel: n.riskLevel
      })),
      lessonsLibrary: state.lessonsLibrary.map(l => ({ title: l.title, content: l.content, tags: l.tags })),
      lifeRules: state.lifeRules.map(r => ({ rule: r.rule, reason: r.reason })),
      socialProtocols: state.socialProtocols.map(p => ({ person: p.person, protocol: p.protocol, reason: p.reason, boundaries: p.boundaries })),
      mentalHealth: state.mentalHealth,
      gratitude: state.gratitude.map(g => ({ title: g.title, detail: g.detail, category: g.category, date: g.date })),
      goalLine: state.settings.goalLine,
      activePersonality: personality?.label
    };

    setAiBusy(true);
    setMessageError("");
    setChatInput("");
    setState({
      ...state,
      chatSessions: state.chatSessions.map((chat) =>
        chat.id === activeChat.id ? { ...chat, messages: [...chat.messages, outgoing, assistantDraft] } : chat
      ),
    });

    try {
      if (!lmModel || lmModel.trim() === "") {
        throw new Error("Please select a model first");
      }
      const token = localStorage.getItem(tokenKey);
      const response = await fetch(`${apiBase}/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          model: lmModel,
          personalityPrompt: personality?.prompt || "Motivational assistant",
          history: historyPayload,
          message: `${prompt}\n\n[CONTEXT FROM WORKSPACE]:\n${JSON.stringify(contextData)}`,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Streaming failed" }));
        const errorMsg = data?.error || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }
      if (!response.body) {
        throw new Error("No response body received from server");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (!chunk.value) continue;
        const text = decoder.decode(chunk.value, { stream: true });
        setState((current) => {
          if (!current) return current;
          return {
            ...current,
            chatSessions: current.chatSessions.map((chat) =>
              chat.id === activeChat.id
                ? {
                    ...chat,
                    messages: chat.messages.map((m) =>
                      m.id === assistantDraft.id ? { ...m, content: `${m.content}${text}` } : m
                    ),
                  }
                : chat
            ),
          };
        });
      }
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const renderPlanTree = (parentId: string | null, level = 0): ReactElement[] =>
    (state?.planNodes || [])
      .filter((node) => node.parentId === parentId)
      .map((node) => (
        <div key={`${node.id}-${level}`} className="road-node" style={{ marginLeft: `${level * 22}px` }}>
          <strong>{node.title}</strong>
          <span>{node.period} {node.branchLabel ? `· ${node.branchLabel}` : ""}</span>
          <small>Condition: {node.ifThis || "—"}</small>
          <small>Action: {node.thenDo || "—"}</small>
          <small>Metric: {node.progressMetric || "—"} · Risk: {node.riskLevel || "medium"}</small>
          {renderPlanTree(node.id, level + 1)}
        </div>
      ));

  if (loading) return <div className="loading">Loading Genesis...</div>;

  if (!state) {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={authSubmit}>
          <h1>The Genesis</h1>
          <p className="auth-subtitle">Secure productivity vault for your next decade</p>
          <div className="row">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>
              Register
            </button>
          </div>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password (min 8 chars)"
            required
          />
          {authError && <div className="error">{authError}</div>}
          <button type="submit">{authMode === "login" ? "Enter Workspace" : "Create Account"}</button>
        </form>
      </div>
    );
  }

  const sortedWeeks = [...state.weeklyTodos].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const activeWeeks = sortedWeeks.filter((week) => !week.archived);
  const historyWeeks = [...sortedWeeks].filter((week) => week.archived).reverse();
  const selectedHistory = historyWeeks.find((w) => w.weekStart === historyWeek) || historyWeeks[0] || null;

  return (
    <div className={`app theme-${state.settings.theme}`}>
      <div className="app-backdrop" style={activeThemeStyle}></div>
      <div className="app-content">
      <header className="header">
        <div>
          <h2>The Genesis</h2>
          <small>you either try to outsmart AI or join hands.</small>
        </div>
        <div className="header-actions">
          <button onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
          <button
            onClick={() => {
              localStorage.removeItem(tokenKey);
              setState(null);
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {!settingsOpen && (
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <main className="content">
        {settingsOpen ? (
          <section className="panel settings">
            <div className="panel-head">
              <h3>Settings</h3>
              <button onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
            <div className="settings-grid">
              <div className="settings-top">
                <div className="field">
                  <label>Goal Line</label>
                  <input
                    value={state.settings.goalLine}
                    onChange={(e) =>
                      setState({ ...state, settings: { ...state.settings, goalLine: e.target.value } })
                    }
                  />
                </div>
                <div className="field">
                  <label>Theme</label>
                  <select
                    value={state.settings.theme}
                    onChange={(e) =>
                      setState({
                        ...state,
                        settings: { ...state.settings, theme: e.target.value as Theme },
                      })
                    }
                  >
                    <option value="midnight">Midnight</option>
                    <option value="sunrise">Sunrise</option>
                    <option value="forest">Forest</option>
                  </select>
                </div>
              </div>
              <div className="field settings-personality">
                <label>Personalities</label>
                {state.settings.personalities.map((p) => (
                  <div key={p.id} className="stack personality">
                    <input
                      value={p.label}
                      onChange={(e) =>
                        setState({
                          ...state,
                          settings: {
                            ...state.settings,
                            personalities: state.settings.personalities.map((x) =>
                              x.id === p.id ? { ...x, label: e.target.value } : x
                            ),
                          },
                        })
                      }
                    />
                    <textarea
                      value={p.prompt}
                      onChange={(e) =>
                        setState({
                          ...state,
                          settings: {
                            ...state.settings,
                            personalities: state.settings.personalities.map((x) =>
                              x.id === p.id ? { ...x, prompt: e.target.value } : x
                            ),
                          },
                        })
                      }
                    />
                    <div className="row">
                      <button
                        onClick={() =>
                          setState({
                            ...state,
                            settings: { ...state.settings, activePersonalityId: p.id },
                          })
                        }
                      >
                        Set Active
                      </button>
                      <button
                        onClick={() =>
                          setState({
                            ...state,
                            settings: {
                              ...state.settings,
                              personalities: state.settings.personalities.filter((x) => x.id !== p.id),
                            },
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setState({
                      ...state,
                      settings: {
                        ...state.settings,
                        personalities: [
                          ...state.settings.personalities,
                          { id: uid(), label: "Custom Persona", prompt: "Be practical and encouraging." },
                        ],
                      },
                    })
                  }
                >
                  Add Personality
                </button>
              </div>
              <div className="settings-top">
                <div className="field">
                  <label>Wallpaper Target Panel</label>
                  <select value={wallpaperTarget} onChange={(e) => setWallpaperTarget(e.target.value as TabKey)}>
                    <option value="global">All Panels (Global)</option>
                    {tabs.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Device Type</label>
                  <select value={wallpaperDevice} onChange={(e) => setWallpaperDevice(e.target.value as "pc" | "mobile")}>
                    <option value="pc">PC / Desktop</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Wallpaper Upload</label>
                <label
                  className={`wallpaper-dropzone ${wallpaperDragActive ? "active" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setWallpaperDragActive(true);
                  }}
                  onDragLeave={() => setWallpaperDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setWallpaperDragActive(false);
                    saveWallpapers(e.dataTransfer.files).catch(() => undefined);
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) saveWallpapers(e.target.files).catch(() => undefined);
                    }}
                  />
                  <strong>Drop images here or click to upload</strong>
                  <small>Images will be added to quick menu for {tabs.find((t) => t.key === wallpaperTarget)?.label}</small>
                </label>
                <div className="row">
                  <button
                    onClick={() => {
                      const wallKey = wallpaperDevice === "mobile" ? "mobileWallpapers" : "wallpapers";
                      setState({
                        ...state,
                        settings: {
                          ...state.settings,
                          [wallKey]: { ...state.settings[wallKey], gratitude: gratitudeWallpaper },
                        },
                      })
                    }
                    }
                  >
                    Use Gratitude Wallpaper
                  </button>
                  <button
                    onClick={() => {
                      if (!state) return;
                      const wallKey = wallpaperDevice === "mobile" ? "mobileWallpapers" : "wallpapers";
                      const currentWall = state.settings[wallKey][wallpaperTarget];
                      if (!currentWall) return;
                      const allWalls = { ...state.settings[wallKey] };
                      tabs.forEach((t) => (allWalls[t.key] = currentWall));
                      allWalls["global"] = currentWall;
                      setState({
                        ...state,
                        settings: { ...state.settings, [wallKey]: allWalls },
                      });
                    }}
                  >
                    Apply to All Panels
                  </button>
                  <button
                    onClick={() => {
                      if (!state) return;
                      const wallKey = wallpaperDevice === "mobile" ? "mobileWallpapers" : "wallpapers";
                      const nextWallpapers = { ...state.settings[wallKey] };
                      delete nextWallpapers[wallpaperTarget];
                      setState({
                        ...state,
                        settings: {
                          ...state.settings,
                          [wallKey]: nextWallpapers,
                        },
                      });
                    }}
                  >
                    Clear Current
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Wallpaper Gallery</label>
                <div className="row wallpaper-thumbs">
                  {(state.settings.wallpaperHistory || []).map((w) => (
                    <div key={w.id} className="wallpaper-thumb-container">
                      <img
                        src={w.dataUrl}
                        alt={w.name}
                        className="wallpaper-thumb"
                        onClick={() => setWallpaper(w.dataUrl, w.device)}
                      />
                      <span className="wallpaper-label">{w.device.toUpperCase()}</span>
                      <button 
                        className="wallpaper-delete-overlay"
                        aria-label="Delete wallpaper"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!state) return;
                          setState({
                            ...state,
                            settings: {
                              ...state.settings,
                              wallpaperHistory: (state.settings.wallpaperHistory || []).filter(item => item.id !== w.id)
                            }
                          });
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {tab === "dashboard" && (
              <>
                <section className="panel dashboard-panel-fullscreen">
                  <div className="quote-block">
                    {quoteEdit ? (
                      <div className="stack">
                        <textarea value={state.dashboardQuote} onChange={(e) => setState({ ...state, dashboardQuote: e.target.value })} />
                        <textarea value={state.dashboardSubQuote} onChange={(e) => setState({ ...state, dashboardSubQuote: e.target.value })} />
                        <button onClick={() => setQuoteEdit(false)}>Save Quote</button>
                      </div>
                    ) : (
                      <div>
                        <h3>{state.dashboardQuote}</h3>
                        <p>{state.dashboardSubQuote}</p>
                        <button onClick={() => setQuoteEdit(true)}>Edit Quote</button>
                      </div>
                    )}
                  </div>
                  <div className="dashboard-grid">
                    {/* History Toggle for Mobile */}
                    <button 
                      className="mobile-history-toggle" 
                      onClick={() => setMobileHistoryOpen(!mobileHistoryOpen)}
                    >
                      {mobileHistoryOpen ? "✕ Close History" : "📜 View History"}
                    </button>

                    <aside className={`chat-list ${mobileHistoryOpen ? "mobile-open" : ""}`}>
                      <button
                        onClick={() => {
                          const id = uid();
                          const nextPersonalityId = activeChat?.personalityId || state.settings.activePersonalityId;
                          const chat: ChatSession = {
                            id,
                            title: `Chat ${dayjs().format("HH:mm")}`,
                            personalityId: nextPersonalityId,
                            createdAt: new Date().toISOString(),
                            messages: [],
                          };
                          setState({ ...state, chatSessions: [chat, ...state.chatSessions] });
                          setSelectedChatId(id);
                          setMobileHistoryOpen(false); // Auto-close history on mobile after creating new
                        }}
                      >
                        + New Chat
                      </button>
                      <div className="chat-history-groups">
                        {Object.entries(
                        state.chatSessions.reduce<Record<string, ChatSession[]>>((acc, chat) => {
                          const label = getIstDayLabel(chat.createdAt);
                          acc[label] = acc[label] || [];
                          acc[label].push(chat);
                          return acc;
                        }, {})
                      ).map(([day, chats]) => (
                          <div key={day} className="stack chat-day-group">
                            <h4>{day}</h4>
                            {chats.map((chat) => {
                              const persona = state.settings.personalities.find((p) => p.id === chat.personalityId)?.label || "Persona";
                              return (
                                <div key={chat.id} className={`chat-item ${selectedChatId === chat.id ? "active" : ""}`}>
                                  <button className="chat-open" onClick={() => {
                                    setSelectedChatId(chat.id);
                                    setMobileHistoryOpen(false); // Auto-close on mobile after selection
                                  }}>
                                    {chat.title} · {persona}
                                  </button>
                                  <button
                                    className="chat-delete"
                                    aria-label="Delete chat"
                                    title="Delete chat"
                                    onClick={() =>
                                      setState({
                                        ...state,
                                        chatSessions: state.chatSessions.filter((item) => item.id !== chat.id),
                                      })
                                    }
                                  >
                                    🗑
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </aside>
                    <div className="chat-pane">
                      <div className="chat-toolbar">
                        <div className="field-inline">
                          <label>Model</label>
                          <select value={lmModel} onChange={(e) => setLmModel(e.target.value)}>
                            {!models.length && !lmModel && <option value="">Select a model</option>}
                            {models.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button onClick={fetchModels}>{modelsLoading ? "Refreshing..." : "Refresh Models"}</button>
                        {activeChat && (
                          <div className="field-inline">
                            <label>Personality</label>
                            <select
                              value={activeChat.personalityId}
                              onChange={(e) =>
                                setState({
                                  ...state,
                                  chatSessions: state.chatSessions.map((chat) =>
                                    chat.id === activeChat.id ? { ...chat, personalityId: e.target.value } : chat
                                  ),
                                })
                              }
                            >
                              {state.settings.personalities.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="chat-messages-container">
                        {activeChat?.messages.map((m) => {
                          return (
                            <div 
                              key={m.id} 
                              className={`message ${m.role}`}
                            >
                              <MarkdownText content={m.content} />
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                      <div className="row chat-input-row">
                        <textarea
                          className="chat-input"
                          placeholder="Share your focus, challenge, or plan..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                        />
                        <button onClick={sendMessage} disabled={aiBusy}>
                          {aiBusy ? "Streaming..." : "Send"}
                        </button>
                      </div>
                      {messageError && <div className="error">{messageError}</div>}
                    </div>
                  </div>
                </section>
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <h3>Weekly Performance Trend</h3>
                  </div>
                  <PerformanceChart data={weeklyProgress} />
                </section>

              </>
            )}

            {tab === "events" && (
              <section className="panel">
                <h3>Event Countdown</h3>
                <button onClick={() => setState({ ...state, events: [...state.events, { id: uid(), title: "New Event", date: dayjs().add(1, "month").format("YYYY-MM-DD"), note: "" }] })}>
                  + Add Event
                </button>
                <div className="grid stack-grid">
                  {state.events.map((event) => {
                    const days = dayjs(event.date).diff(dayjs(), "day");
                    return (
                      <article key={event.id} className="card">
                        <input placeholder="Event title (e.g., Project deadline, Vacation)" value={event.title} onChange={(e) => setState({ ...state, events: state.events.map((x) => (x.id === event.id ? { ...x, title: e.target.value } : x)) })} />
                        <input type="date" value={event.date} onChange={(e) => setState({ ...state, events: state.events.map((x) => (x.id === event.id ? { ...x, date: e.target.value } : x)) })} />
                        <textarea className="note-input" placeholder="Notes about this event..." value={event.note} onChange={(e) => setState({ ...state, events: state.events.map((x) => (x.id === event.id ? { ...x, note: e.target.value } : x)) })} />
                        <strong>{days >= 0 ? `${days} days left` : `${Math.abs(days)} days ago`}</strong>
                        <button onClick={() => setState({ ...state, events: state.events.filter((x) => x.id !== event.id) })}>Delete</button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {tab === "habits" && (
              <section className="panel">
                <h3>Habits Tracker</h3>
                <button onClick={() => setState({ ...state, habits: [...state.habits, { id: uid(), name: "New Habit", notes: "", relapses: [] }] })}>+ Add Habit</button>
                <div className="grid stack-grid">
                  {state.habits.map((habit) => (
                    <article key={habit.id} className="card">
                      <input placeholder="Habit name (e.g., No social media before 9am)" value={habit.name} onChange={(e) => setState({ ...state, habits: state.habits.map((x) => (x.id === habit.id ? { ...x, name: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Why this habit matters, triggers, strategies..." value={habit.notes} onChange={(e) => setState({ ...state, habits: state.habits.map((x) => (x.id === habit.id ? { ...x, notes: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, habits: state.habits.map((x) => (x.id === habit.id ? { ...x, relapses: [...x.relapses, { id: uid(), occurredAt: new Date().toISOString(), note: "Trigger + response" }] } : x)) })}>Log Relapse</button>
                      <div className="mini-list">
                        {habit.relapses.map((relapse) => (
                          <div key={relapse.id} className="mini-item">
                            <small>{dayjs(relapse.occurredAt).format("DD MMM HH:mm")}</small>
                            <input placeholder="What triggered it? How did you respond?" value={relapse.note} onChange={(e) => setState({ ...state, habits: state.habits.map((x) => (x.id === habit.id ? { ...x, relapses: x.relapses.map((r) => (r.id === relapse.id ? { ...r, note: e.target.value } : r)) } : x)) })} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setState({ ...state, habits: state.habits.filter((x) => x.id !== habit.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "todo" && (
              <section className="panel">
                <h3>ToDo Planner + Pomodoro</h3>
                <div className="row">
                  <button onClick={() => ensureWeekAndAddTask(dayjs().format("YYYY-MM-DD"))}>+ Add Task Today</button>
                  {activeWeeks.length === 0 ? (
                    <button onClick={() => {
                      const start = weekStart(dayjs().format("YYYY-MM-DD"));
                      setState((prev) => ({
                        ...prev!,
                        weeklyTodos: [
                          ...prev!.weeklyTodos,
                          {
                            weekStart: start,
                            rewardTitle: "Weekly Reward",
                            rewardUnlocked: false,
                            rewardClaimed: false,
                            archived: false,
                            tasks: [],
                            lessons: [],
                            dailyRewards: {},
                            dailyNotes: {},
                            dailyRewardsClaimed: {}
                          }
                        ]
                      }));
                    }}>
                      Start Current Week
                    </button>
                  ) : (
                    <button onClick={() => {
                      const lastWeek = activeWeeks[activeWeeks.length - 1];
                      const nextStart = dayjs(lastWeek.weekStart).add(7, "day").format("YYYY-MM-DD");
                      setState((prev) => ({
                        ...prev!,
                        weeklyTodos: [
                          ...prev!.weeklyTodos,
                          {
                            weekStart: nextStart,
                            rewardTitle: "Weekly Reward",
                            rewardUnlocked: false,
                            rewardClaimed: false,
                            archived: false,
                            tasks: [],
                            lessons: [],
                            dailyRewards: {},
                            dailyNotes: {},
                            dailyRewardsClaimed: {}
                          }
                        ]
                      }));
                    }}>
                      + Add Next Week
                    </button>
                  )}
                  <strong>Daily Motivation Score: {dayScore}%</strong>
                </div>
                <div className="pomodoro">
                  <p>{`${Math.floor(pomodoroSeconds / 60)}:${String(pomodoroSeconds % 60).padStart(2, "0")}`}</p>
                  <div className="row">
                    <button onClick={() => setPomodoroRunning((v) => !v)}>{pomodoroRunning ? "Pause" : "Start"}</button>
                    <button onClick={() => setPomodoroSeconds(1500)}>Reset</button>
                  </div>
                </div>

                {activeWeeks.map((week, weekIndex) => {
                  const done = week.tasks.filter((task) => task.done).length;
                  const notDone = week.tasks.filter((task) => task.notDone).length;
                  const total = week.tasks.length || 1;
                  const completion = Math.round((done / total) * 100);
                  const unlocked = completion >= 80;
                  
                  // Generate all 7 days for this week to ensure rewards/notes show even without tasks
                  const weekDays = Array.from({ length: 7 }, (_, i) => 
                    dayjs(week.weekStart).add(i, "day").format("YYYY-MM-DD")
                  );

                  const tasksByDate = week.tasks.reduce<Record<string, TodoTask[]>>((acc, task) => {
                    acc[task.date] = acc[task.date] || [];
                    acc[task.date].push(task);
                    return acc;
                  }, {});

                  return (
                    <article key={week.weekStart} className="card week-card">
                      <h4>
                        WEEK {String(weekIndex + 1).padStart(2, "0")} ({dayjs(week.weekStart).format("DD MMM")} - {dayjs(weekEnd(week.weekStart)).format("DD MMM")})
                      </h4>
                      <p>Completion: {completion}% · Done: {done} · Not Done: {notDone} · Reward: {week.rewardClaimed ? "Claimed" : (unlocked ? "Unlocked" : "Locked")}</p>
                      <input value={week.rewardTitle} onChange={(e) => updateWeek(week.weekStart, (current) => ({ ...current, rewardTitle: e.target.value }))} />
                      <div className="row">
                        <button disabled={!unlocked || week.rewardClaimed} onClick={() => updateWeek(week.weekStart, (current) => ({ ...current, rewardUnlocked: true, rewardClaimed: true }))}>
                          {week.rewardClaimed ? "✓ Reward Claimed" : "Claim Reward"}
                        </button>
                        {week.rewardClaimed && (
                          <button 
                            className="delete-btn" 
                            onClick={() => updateWeek(week.weekStart, (current) => ({ ...current, rewardClaimed: false }))}
                          >
                            ✕ Delete Reward
                          </button>
                        )}
                        <button onClick={() => updateWeek(week.weekStart, (current) => ({ ...current, archived: true }))}>Move to History</button>
                      </div>
                      {weekDays.map((date, dayIndex) => {
                        const tasks = tasksByDate[date] || [];

                        return (
                        <div key={date} className="day-block">
                          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <strong>
                              Day {String(dayIndex + 1).padStart(2, "0")} · {dayjs(date).format("ddd, DD MMM")}
                            </strong>
                            <button 
                              className="task-add-btn" 
                              onClick={() => {
                                updateWeek(week.weekStart, (current) => ({
                                  ...current,
                                  tasks: [
                                    ...current.tasks,
                                    {
                                      id: uid(),
                                      title: "",
                                      done: false,
                                      date: date,
                                      notes: "",
                                      notDone: false
                                    }
                                  ]
                                }));
                              }}
                              style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                            >
                              + Task
                            </button>
                          </div>

                          {/* Daily Reward Section */}
                          <div className="daily-addon">
                            <label>Daily Reward:</label>
                            <div className="row">
                              <button
                                className={`tick-btn ${week.dailyRewardsClaimed?.[date] ? "done" : ""}`}
                                aria-label="Toggle reward claimed"
                                onClick={() =>
                                  updateWeek(week.weekStart, (current) => ({
                                    ...current,
                                    dailyRewardsClaimed: { 
                                      ...(current.dailyRewardsClaimed || {}), 
                                      [date]: !current.dailyRewardsClaimed?.[date] 
                                    },
                                  }))
                                }
                              >
                                ✓
                              </button>
                              <input 
                                placeholder="Reward for today's effort..." 
                                value={week.dailyRewards?.[date] || ""} 
                                onChange={(e) => updateWeek(week.weekStart, (current) => ({
                                  ...current,
                                  dailyRewards: { ...(current.dailyRewards || {}), [date]: e.target.value }
                                }))} 
                              />
                              <button 
                                className="delete-btn" 
                                aria-label="Clear reward"
                                onClick={() => updateWeek(week.weekStart, (current) => {
                                  const nextRewards = { ...(current.dailyRewards || {}) };
                                  const nextClaimed = { ...(current.dailyRewardsClaimed || {}) };
                                  delete nextRewards[date];
                                  delete nextClaimed[date];
                                  return { ...current, dailyRewards: nextRewards, dailyRewardsClaimed: nextClaimed };
                                })}
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Daily Journal Note Section */}
                          <div className="daily-addon">
                            <label>Daily Journal / Reflection:</label>
                            <div className="row">
                              <textarea 
                                className="note-input"
                                placeholder="Write about your day, thoughts, or reflections..." 
                                value={week.dailyNotes?.[date] || ""} 
                                onChange={(e) => updateWeek(week.weekStart, (current) => ({
                                  ...current,
                                  dailyNotes: { ...(current.dailyNotes || {}), [date]: e.target.value }
                                }))} 
                                style={{ minHeight: "80px" }}
                              />
                              <button 
                                className="delete-btn" 
                                aria-label="Clear journal entry"
                                onClick={() => updateWeek(week.weekStart, (current) => {
                                  const next = { ...(current.dailyNotes || {}) };
                                  delete next[date];
                                  return { ...current, dailyNotes: next };
                                })}
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {tasks.map((task) => (
                            <div key={task.id} className="task-row">
                              <div className="row task-controls">
                                <button
                                  className={`tick-btn ${task.done ? "done" : ""}`}
                                  aria-label="Toggle task complete"
                                  onClick={() =>
                                    updateWeek(week.weekStart, (current) => ({
                                      ...current,
                                      tasks: current.tasks.map((t) =>
                                        t.id === task.id ? { ...t, done: !t.done, notDone: false } : t
                                      ),
                                    }))
                                  }
                                >
                                  ✓
                                </button>
                                <button
                                  className="delete-btn"
                                  aria-label="Mark task not done"
                                  onClick={() =>
                                    updateWeek(week.weekStart, (current) => ({
                                      ...current,
                                      tasks: current.tasks.map((t) =>
                                        t.id === task.id ? { ...t, done: false, notDone: true } : t
                                      ),
                                    }))
                                  }
                                >
                                  ✕
                                </button>
                                <input placeholder="Task title (e.g., Complete project report)" value={task.title} onChange={(e) => updateWeek(week.weekStart, (current) => ({ ...current, tasks: current.tasks.map((t) => (t.id === task.id ? { ...t, title: e.target.value } : t)) }))} />
                                <button
                                  className="task-delete-btn"
                                  aria-label="Delete task"
                                  onClick={() =>
                                    updateWeek(week.weekStart, (current) => ({
                                      ...current,
                                      tasks: current.tasks.filter((t) => t.id !== task.id),
                                    }))
                                  }
                                >
                                  🗑
                                </button>
                              </div>
                              {task.notDone && <small className="status-pill">Not done</small>}
                              <input type="date" value={task.date} onChange={(e) => updateWeek(week.weekStart, (current) => ({ ...current, tasks: current.tasks.map((t) => (t.id === task.id ? { ...t, date: e.target.value } : t)) }))} />
                              <textarea className="note-input" placeholder="Task notes, context, or details..." value={task.notes} onChange={(e) => updateWeek(week.weekStart, (current) => ({ ...current, tasks: current.tasks.map((t) => (t.id === task.id ? { ...t, notes: e.target.value } : t)) }))} />
                            </div>
                          ))}
                        </div>
                      )})}
                      <button onClick={() => updateWeek(week.weekStart, (current) => ({ ...current, lessons: [...(current.lessons || []), { id: uid(), date: dayjs().format("YYYY-MM-DD"), lesson: "Lesson learned today" }] }))}>
                        + Add Daily Lesson
                      </button>
                      {(week.lessons || []).map((lesson) => (
                        <div key={lesson.id} className="row" style={{ marginBottom: "0.5rem", alignItems: "center" }}>
                          <input 
                            placeholder="Lesson learned today..." 
                            value={lesson.lesson} 
                            onChange={(e) => updateWeek(week.weekStart, (current) => ({ ...current, lessons: (current.lessons || []).map((l) => (l.id === lesson.id ? { ...l, lesson: e.target.value } : l)) }))} 
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <button 
                            className="delete-btn" 
                            onClick={() => updateWeek(week.weekStart, (current) => ({ ...current, lessons: (current.lessons || []).filter((l) => l.id !== lesson.id) }))}
                            style={{ flexShrink: 0, marginLeft: "0.5rem" }}
                            type="button"
                          >
                            ✕ Delete
                          </button>
                        </div>
                      ))}
                    </article>
                  );
                })}

                <section className="panel chart-panel">
                  <div className="panel-head">
                    <h3>Weekly Performance Trend</h3>
                  </div>
                  <PerformanceChart data={weeklyProgress} />
                </section>

                <section className="panel-lite">
                  <h4>Calendar Log History</h4>
                  <div className="history-wrap">
                    <div className="history-list">
                      {historyWeeks.map((week) => (
                        <button
                          key={weekKey(week)}
                          className={historyWeek === week.weekStart ? "active" : ""}
                          onClick={() => {
                            setHistoryWeek(week.weekStart);
                            setHistoryDetailOpen(false);
                          }}
                        >
                          {dayjs(week.weekStart).format("DD MMM")} - {dayjs(weekEnd(week.weekStart)).format("DD MMM")}
                        </button>
                      ))}
                    </div>
                    {selectedHistory && (
                      <div className="card">
                        <strong>Reward: {selectedHistory.rewardClaimed ? "Earned" : "Missed"}</strong>
                        <p>{selectedHistory.rewardTitle}</p>
                        <button onClick={() => setHistoryDetailOpen((value) => !value)}>
                          {historyDetailOpen ? "Hide Detailed Log" : "Show Detailed Log"}
                        </button>
                        {!historyDetailOpen && (
                          <>
                            <strong>Week Tasks</strong>
                            {Array.from({ length: 7 }, (_, i) => 
                              dayjs(selectedHistory.weekStart).add(i, "day").format("YYYY-MM-DD")
                            ).map((date) => {
                              const tasks = selectedHistory.tasks.filter(t => t.date === date);
                              const hasAddons = selectedHistory.dailyRewards?.[date] || selectedHistory.dailyNotes?.[date];
                              if (tasks.length === 0 && !hasAddons) return null;

                              return (
                                <div key={date} className="day-block">
                                  <small>{dayjs(date).format("ddd, DD MMM YYYY")}</small>
                                  {selectedHistory.dailyRewards?.[date] && (
                                    <div className="daily-addon">
                                      <label>Daily Reward:</label>
                                      <p style={{ margin: 0, fontSize: "0.9rem" }}>{selectedHistory.dailyRewards[date]}</p>
                                    </div>
                                  )}
                                  {selectedHistory.dailyNotes?.[date] && (
                                    <div className="daily-addon">
                                      <label>Journal Entry:</label>
                                      <p style={{ margin: 0, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{selectedHistory.dailyNotes[date]}</p>
                                    </div>
                                  )}
                                  {tasks.map((task) => (
                                    <div key={task.id} className="task-row">
                                      <strong>{task.done ? "✓" : task.notDone ? "✕" : "•"} {task.title}</strong>
                                      {task.notDone && <small className="status-pill">Not done</small>}
                                      {task.notes && <small>{task.notes}</small>}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {selectedHistory.tasks.length === 0 && !selectedHistory.dailyRewards && !selectedHistory.dailyNotes && <small>No activity logged for this week.</small>}
                            <strong>Lessons</strong>
                            {selectedHistory.lessons.map((lesson) => (
                              <small key={lesson.id}>
                                {lesson.date}: {lesson.lesson}
                              </small>
                            ))}
                          </>
                        )}
                        {historyDetailOpen && (
                          <>
                            <input
                              value={selectedHistory.rewardTitle}
                              onChange={(e) =>
                                updateWeek(selectedHistory.weekStart, (current) => ({
                                  ...current,
                                  rewardTitle: e.target.value,
                                }))
                              }
                            />
                            <div className="row">
                              <button
                                onClick={() =>
                                  updateWeek(selectedHistory.weekStart, (current) => ({
                                    ...current,
                                    rewardClaimed: !current.rewardClaimed,
                                    rewardUnlocked: current.rewardUnlocked || !current.rewardClaimed,
                                  }))
                                }
                              >
                                Toggle Reward Status
                              </button>
                              <button
                                onClick={() =>
                                  updateWeek(selectedHistory.weekStart, (current) => ({
                                    ...current,
                                    archived: false,
                                  }))
                                }
                              >
                                Move Back to Active
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to permanently delete this week's history?")) {
                                    setState((prev) => ({
                                      ...prev!,
                                      weeklyTodos: prev!.weeklyTodos.filter((w) => w.weekStart !== selectedHistory.weekStart),
                                    }));
                                    setHistoryWeek("");
                                  }
                                }}
                              >
                                🗑 Delete History
                              </button>
                            </div>
                            <button
                              onClick={() =>
                                updateWeek(selectedHistory.weekStart, (current) => ({
                                  ...current,
                                  tasks: [
                                    ...current.tasks,
                                    {
                                      id: uid(),
                                      title: "History Task",
                                      date: dayjs(current.weekStart).format("YYYY-MM-DD"),
                                      done: false,
                                      notDone: false,
                                      notes: "",
                                    },
                                  ],
                                }))
                              }
                            >
                              + Add Task
                            </button>
                            {Object.entries(
                              selectedHistory.tasks.reduce<Record<string, TodoTask[]>>((acc, task) => {
                                acc[task.date] = acc[task.date] || [];
                                acc[task.date].push(task);
                                return acc;
                              }, {})
                            )
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([date, tasks], dayIndex) => (
                                <div key={date} className="day-block">
                                  <strong>
                                    Day {String(dayIndex + 1).padStart(2, "0")} · {dayjs(date).format("ddd, DD MMM")}
                                  </strong>
                                  {tasks.map((task) => (
                                    <div key={task.id} className="task-row">
                                      <div className="row task-controls">
                                        <button
                                          className={`tick-btn ${task.done ? "done" : ""}`}
                                          aria-label="Toggle task complete"
                                          onClick={() =>
                                            updateWeek(selectedHistory.weekStart, (current) => ({
                                              ...current,
                                              tasks: current.tasks.map((t) =>
                                                t.id === task.id ? { ...t, done: !t.done, notDone: false } : t
                                              ),
                                            }))
                                          }
                                        >
                                          ✓
                                        </button>
                                        <button
                                          className="delete-btn"
                                          aria-label="Mark task not done"
                                          onClick={() =>
                                            updateWeek(selectedHistory.weekStart, (current) => ({
                                              ...current,
                                              tasks: current.tasks.map((t) =>
                                                t.id === task.id ? { ...t, done: false, notDone: true } : t
                                              ),
                                            }))
                                          }
                                        >
                                          ✕
                                        </button>
                                        <input
                                          value={task.title}
                                          onChange={(e) =>
                                            updateWeek(selectedHistory.weekStart, (current) => ({
                                              ...current,
                                              tasks: current.tasks.map((t) =>
                                                t.id === task.id ? { ...t, title: e.target.value } : t
                                              ),
                                            }))
                                          }
                                        />
                                      </div>
                                      {task.notDone && <small className="status-pill">Not done</small>}
                                      <input
                                        type="date"
                                        value={task.date}
                                        onChange={(e) =>
                                          updateWeek(selectedHistory.weekStart, (current) => ({
                                            ...current,
                                            tasks: current.tasks.map((t) =>
                                              t.id === task.id ? { ...t, date: e.target.value } : t
                                            ),
                                          }))
                                        }
                                      />
                                      <textarea
                                        className="note-input"
                                        value={task.notes}
                                        onChange={(e) =>
                                          updateWeek(selectedHistory.weekStart, (current) => ({
                                            ...current,
                                            tasks: current.tasks.map((t) =>
                                              t.id === task.id ? { ...t, notes: e.target.value } : t
                                            ),
                                          }))
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              ))}
                            <button
                              onClick={() =>
                                updateWeek(selectedHistory.weekStart, (current) => ({
                                  ...current,
                                  lessons: [
                                    ...current.lessons,
                                    { id: uid(), date: dayjs().format("YYYY-MM-DD"), lesson: "Lesson learned today" },
                                  ],
                                }))
                              }
                            >
                              + Add Lesson
                            </button>
                            {selectedHistory.lessons.map((lesson) => (
                              <input
                                key={lesson.id}
                                placeholder="Lesson learned..."
                                value={lesson.lesson}
                                onChange={(e) =>
                                  updateWeek(selectedHistory.weekStart, (current) => ({
                                    ...current,
                                    lessons: current.lessons.map((l) =>
                                      l.id === lesson.id ? { ...l, lesson: e.target.value } : l
                                    ),
                                  }))
                                }
                              />
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </section>
            )}

            {tab === "quotes" && (
              <section className="panel">
                <h3>Motivational Quotes</h3>
                <button onClick={() => setState({ ...state, motivationalCards: [...state.motivationalCards, { id: uid(), quote: "New quote", note: "", tag: "Focus" }] })}>+ Add Card</button>
                <div className="grid">
                  {state.motivationalCards.map((quote) => (
                    <article key={quote.id} className="card">
                      <textarea className="note-input" placeholder="Motivational quote or affirmation..." value={quote.quote} onChange={(e) => setState({ ...state, motivationalCards: state.motivationalCards.map((x) => (x.id === quote.id ? { ...x, quote: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Personal note or reflection on this quote..." value={quote.note} onChange={(e) => setState({ ...state, motivationalCards: state.motivationalCards.map((x) => (x.id === quote.id ? { ...x, note: e.target.value } : x)) })} />
                      <input placeholder="Tag (e.g., Focus, Growth, Consistency)" value={quote.tag} onChange={(e) => setState({ ...state, motivationalCards: state.motivationalCards.map((x) => (x.id === quote.id ? { ...x, tag: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, motivationalCards: state.motivationalCards.filter((x) => x.id !== quote.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "plan" && (
              <section className="panel">
                <h3>Plan Builder</h3>
                <button onClick={() => setState({ ...state, planNodes: [...state.planNodes, { id: uid(), parentId: "root", title: "Subplan", period: "90 days", ifThis: "A defined condition appears", thenDo: "Execute planned response", branchLabel: "Alternative Path", progressMetric: "Progress %", riskLevel: "medium" }] })}>+ Add Branch</button>
                <button onClick={() => setState({ ...state, planNodes: [...state.planNodes, { id: uid(), parentId: "root", title: "Fallback Plan", period: "30 days", ifThis: "Primary path is blocked", thenDo: "Switch to contingency execution", branchLabel: "Fallback Path", progressMetric: "Recovery speed", riskLevel: "high" }] })}>+ Add Contingency Path</button>
                <div className="roadmap">{renderPlanTree(null)}</div>
                <div className="grid">
                  {state.planNodes.map((node) => (
                    <article key={node.id} className="card">
                      <input placeholder="Plan node title (Outcome for this branch)" value={node.title} onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, title: e.target.value } : x)) })} />
                      <input placeholder="Timeline (e.g., 30 days / Q2 2026)" value={node.period} onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, period: e.target.value } : x)) })} />
                      <input value={node.ifThis} placeholder="Condition" onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, ifThis: e.target.value } : x)) })} />
                      <input value={node.thenDo} placeholder="Action" onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, thenDo: e.target.value } : x)) })} />
                      <input value={node.branchLabel || ""} placeholder="Path Label (e.g., Path A)" onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, branchLabel: e.target.value } : x)) })} />
                      <input value={node.progressMetric || ""} placeholder="Metric (e.g., weekly tasks completed)" onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, progressMetric: e.target.value } : x)) })} />
                      <select value={node.riskLevel || "medium"} onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, riskLevel: e.target.value as "low" | "medium" | "high" } : x)) })}>
                        <option value="low">Low Risk</option>
                        <option value="medium">Medium Risk</option>
                        <option value="high">High Risk</option>
                      </select>
                      <select value={node.parentId || ""} onChange={(e) => setState({ ...state, planNodes: state.planNodes.map((x) => (x.id === node.id ? { ...x, parentId: e.target.value || null } : x)) })}>
                        <option value="">Top-Level Plan Node</option>
                        {state.planNodes.filter((x) => x.id !== node.id).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                      {node.id !== "root" && <button onClick={() => setState({ ...state, planNodes: state.planNodes.filter((x) => x.id !== node.id) })}>Delete</button>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "lessons" && (
              <section className="panel">
                <h3>Lessons Library</h3>
                <button onClick={() => setState({ ...state, lessonsLibrary: [...state.lessonsLibrary, { id: uid(), title: "New Lesson", content: "", tags: "", createdAt: new Date().toISOString() }] })}>+ Add Lesson</button>
                <div className="grid">
                  {state.lessonsLibrary.map((lesson) => (
                    <article key={lesson.id} className="card">
                      <input placeholder="Lesson title (e.g., How to handle setbacks)" value={lesson.title} onChange={(e) => setState({ ...state, lessonsLibrary: state.lessonsLibrary.map((x) => (x.id === lesson.id ? { ...x, title: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Lesson content, insights, or takeaways..." value={lesson.content} onChange={(e) => setState({ ...state, lessonsLibrary: state.lessonsLibrary.map((x) => (x.id === lesson.id ? { ...x, content: e.target.value } : x)) })} />
                      <input placeholder="Tags (comma-separated, e.g., productivity, mindset)" value={lesson.tags} onChange={(e) => setState({ ...state, lessonsLibrary: state.lessonsLibrary.map((x) => (x.id === lesson.id ? { ...x, tags: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, lessonsLibrary: state.lessonsLibrary.filter((x) => x.id !== lesson.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "rules" && (
              <section className="panel">
                <h3>Rules For Life</h3>
                <button onClick={() => setState({ ...state, lifeRules: [...state.lifeRules, { id: uid(), rule: "", reason: "" }] })}>+ Add Rule</button>
                <div className="grid">
                  {state.lifeRules.map((rule) => (
                    <article key={rule.id} className="card">
                      <input placeholder="Rule (e.g., Never check phone before 9am)" value={rule.rule} onChange={(e) => setState({ ...state, lifeRules: state.lifeRules.map((x) => (x.id === rule.id ? { ...x, rule: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Reason why this rule matters..." value={rule.reason} onChange={(e) => setState({ ...state, lifeRules: state.lifeRules.map((x) => (x.id === rule.id ? { ...x, reason: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, lifeRules: state.lifeRules.filter((x) => x.id !== rule.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "social" && (
              <section className="panel">
                <h3>Social Interaction Protocols</h3>
                <button onClick={() => setState({ ...state, socialProtocols: [...state.socialProtocols, { id: uid(), person: "", protocol: "", reason: "", boundaries: "" }] })}>+ Add Protocol</button>
                <div className="grid">
                  {state.socialProtocols.map((protocol) => (
                    <article key={protocol.id} className="card">
                      <input placeholder="Person name or relationship" value={protocol.person} onChange={(e) => setState({ ...state, socialProtocols: state.socialProtocols.map((x) => (x.id === protocol.id ? { ...x, person: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Protocol - how to interact with this person..." value={protocol.protocol} onChange={(e) => setState({ ...state, socialProtocols: state.socialProtocols.map((x) => (x.id === protocol.id ? { ...x, protocol: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Reason - why this protocol exists..." value={protocol.reason} onChange={(e) => setState({ ...state, socialProtocols: state.socialProtocols.map((x) => (x.id === protocol.id ? { ...x, reason: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Boundaries - limits and expectations..." value={protocol.boundaries} onChange={(e) => setState({ ...state, socialProtocols: state.socialProtocols.map((x) => (x.id === protocol.id ? { ...x, boundaries: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, socialProtocols: state.socialProtocols.filter((x) => x.id !== protocol.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === "mental" && (
              <section className="panel">
                <h3>Mental + Physical Health System</h3>
                <div className="mental-quote-head">
                  <p className="mind-body-quote">{state.mentalHealth.mindBodyQuote || defaultMindBodyQuote}</p>
                  <button onClick={() => setMentalQuoteEdit((value) => !value)}>{mentalQuoteEdit ? "Save Quote" : "Edit Quote"}</button>
                </div>
                {mentalQuoteEdit && (
                  <textarea
                    className="note-input"
                    value={state.mentalHealth.mindBodyQuote || defaultMindBodyQuote}
                    onChange={(e) =>
                      setState({
                        ...state,
                        mentalHealth: {
                          ...state.mentalHealth,
                          mindBodyQuote: e.target.value,
                        },
                      })
                    }
                  />
                )}
                <div className="mental-groups">
                  {[
                    { title: "Mind", keys: ["innerCircle", "thingsILove", "groundingTools", "lowPointPlan"] },
                    { title: "Body", keys: ["physicalHealthHabits", "movementPlan", "nutritionAnchors", "sleepProtocol"] },
                  ].map((group) => (
                    <section key={group.title} className="mental-group-card">
                      <h4>{group.title}</h4>
                      <div className="mental-grid">
                        {group.keys.map((key) => (
                          <article key={key} className="card">
                            <h4>{sectionLabels[key] || key}</h4>
                            {((state.mentalHealth[key as keyof typeof state.mentalHealth] as string[]) || []).map((item, index) => (
                              <div key={`${key}-${index}`} className="row">
                                <input
                                  value={item}
                                  onChange={(e) =>
                                    setState({
                                      ...state,
                                      mentalHealth: {
                                        ...state.mentalHealth,
                                        [key]: ((state.mentalHealth[key as keyof typeof state.mentalHealth] as string[]) || []).map((x, i) =>
                                          i === index ? e.target.value : x
                                        ),
                                      },
                                    })
                                  }
                                />
                                <button
                                  onClick={() =>
                                    setState({
                                      ...state,
                                      mentalHealth: {
                                        ...state.mentalHealth,
                                        [key]: ((state.mentalHealth[key as keyof typeof state.mentalHealth] as string[]) || []).filter((_, i) => i !== index),
                                      },
                                    })
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() =>
                                setState({
                                  ...state,
                                  mentalHealth: {
                                    ...state.mentalHealth,
                                    [key]: [...((state.mentalHealth[key as keyof typeof state.mentalHealth] as string[]) || []), "New item"],
                                  },
                                })
                              }
                            >
                              + Add
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            )}

            {tab === "gratitude" && (
              <section className="panel">
                <h3>Gratefulness + Achievements</h3>
                <button onClick={() => setState({ ...state, gratitude: [...state.gratitude, { id: uid(), title: "New Entry", detail: "", category: "gratitude", date: dayjs().format("YYYY-MM-DD") }] })}>+ Add Entry</button>
                <div className="grid">
                  {state.gratitude.map((item) => (
                    <article key={item.id} className="card">
                      <input placeholder="Title (e.g., Completed project milestone)" value={item.title} onChange={(e) => setState({ ...state, gratitude: state.gratitude.map((x) => (x.id === item.id ? { ...x, title: e.target.value } : x)) })} />
                      <textarea className="note-input" placeholder="Details - what happened, why it matters..." value={item.detail} onChange={(e) => setState({ ...state, gratitude: state.gratitude.map((x) => (x.id === item.id ? { ...x, detail: e.target.value } : x)) })} />
                      <select value={item.category} onChange={(e) => setState({ ...state, gratitude: state.gratitude.map((x) => (x.id === item.id ? { ...x, category: e.target.value as "achievement" | "gratitude" } : x)) })}>
                        <option value="gratitude">Gratitude</option>
                        <option value="achievement">Achievement</option>
                      </select>
                      <input type="date" value={item.date} onChange={(e) => setState({ ...state, gratitude: state.gratitude.map((x) => (x.id === item.id ? { ...x, date: e.target.value } : x)) })} />
                      <button onClick={() => setState({ ...state, gratitude: state.gratitude.filter((x) => x.id !== item.id) })}>Delete</button>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  );
}

export default App;
