import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useMemo, useRef } from "react"
import { initDB, saveSubmissions, getSubmissionCount, clearDB, getRecentSubmissions, querySubmissions } from "./db"

export const config: PlasmoCSConfig = {
    matches: ["https://codeforces.com/*"]
}

export const getStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

// === Types ===
type Problem = { id: string; name: string; tags?: string[]; rating?: number; contestId?: number; index?: string; }
type Folder = { id: string; title: string; problems: Problem[]; isCustom?: boolean; }
type Settings = { keepOpen: boolean; showTags: boolean; blurTags: boolean; showSystemTags: boolean; showStatus: boolean; userHandle: string; bgColor: string; }
type StatusMap = Record<string, "OK" | "WRONG">;
type Contest = { id: number; name: string; phase: string; startTimeSeconds: number; durationSeconds: number; participated?: boolean; }
type ContextMenuState = { visible: boolean; x: number; y: number; problem: Problem | null; }
type AIModel = { id: string; name: string; provider: string; usageRate: number; popularity: number; costEffectiveness: number; rating: number; lastUpdated: number; category: string; }

const CF_TAGS = ["dp", "greedy", "math", "graphs", "data structures", "sortings", "binary search", "dfs and similar", "trees", "strings", "number theory", "geometry", "two pointers", "dsu", "bitmasks", "constructive algorithms", "implementation"];

// AI Leaderboard update constants
const AI_USAGE_VARIATION = 2;
const AI_POPULARITY_VARIATION = 1.5;
const AI_COST_VARIATION = 1;
const AI_RATING_VARIATION = 0.1;
const AI_CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const AI_REFRESH_INTERVAL = 30000; // 30 seconds
const MILLISECONDS_TO_SECONDS = 1000;

// === Global Utils ===
const isDarkColor = (hex: string) => {
    const c = hex.substring(1); const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 0xff; const g = (rgb >> 8) & 0xff; const b = (rgb >> 0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; return luma < 100;
}
const getRatingColor = (r: number | undefined, isDarkBg: boolean) => {
    if (!r) return isDarkBg ? "#888" : "#ccc";
    if (isDarkBg) {
        if (r < 1200) return "#a0a0a0"; if (r < 1400) return "#76ff03"; if (r < 1600) return "#00e5ff"; if (r < 1900) return "#66b3ff";
        if (r < 2100) return "#ea80fc"; if (r < 2300) return "#ffb74d"; if (r < 2400) return "#ff9e80"; if (r < 2600) return "#ff5252"; return "#ff1744";
    } else {
        if (r < 1200) return "#808080"; if (r < 1400) return "#008000"; if (r < 1600) return "#03a89e"; if (r < 1900) return "#0000ff";
        if (r < 2100) return "#a0a"; if (r < 2400) return "#ff8c00"; return "#ff0000";
    }
}
const getThemeVariables = (bgColor: string) => {
    const isDark = isDarkColor(bgColor);
    return {
        '--bg-main': bgColor, '--bg-header': bgColor,
        '--bg-secondary': isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
        '--bg-input': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        '--bg-hover': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        '--text-main': isDark ? '#eeeeee' : '#333333',
        '--text-dim': isDark ? '#999999' : '#666666',
        '--border-color': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        '--accent-color': '#007acc', 'isDark': isDark
    } as React.CSSProperties & { isDark: boolean };
}
const formatDuration = (seconds: number) => {
    if (seconds < 0) return "Started";
    const d = Math.floor(seconds / 86400); const h = Math.floor((seconds % 86400) / 3600); const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`; return `${h}h ${m}m`;
}
const formatTime = (unix: number) => new Date(unix * MILLISECONDS_TO_SECONDS).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatDateTime = (unix: number) => new Date(unix * MILLISECONDS_TO_SECONDS).toLocaleString();

// Utility function to update AI model metrics with random variations
const updateAIModelMetrics = (model: AIModel): AIModel => ({
    ...model,
    usageRate: Math.max(0, Math.min(100, model.usageRate + (Math.random() - 0.5) * AI_USAGE_VARIATION)),
    popularity: Math.max(0, Math.min(100, model.popularity + (Math.random() - 0.5) * AI_POPULARITY_VARIATION)),
    costEffectiveness: Math.max(0, Math.min(100, model.costEffectiveness + (Math.random() - 0.5) * AI_COST_VARIATION)),
    rating: Math.max(0, Math.min(10, model.rating + (Math.random() - 0.5) * AI_RATING_VARIATION)),
    lastUpdated: Date.now() / MILLISECONDS_TO_SECONDS
});

const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

const formatFullDate = (unix: number) => {
    const d = new Date(unix * MILLISECONDS_TO_SECONDS);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const formatVerdictDetailed = (verdict: string, passedCount: number) => {
    if (!verdict) return "";
    if (verdict === 'OK') return 'Accepted';
    if (verdict === 'COMPILATION_ERROR') return 'Compilation Error';
    let text = verdict.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    if (['Wrong Answer', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Runtime Error'].includes(text)) {
        return `${text} on test ${passedCount + 1}`;
    }
    return text;
}

const formatMemoryKB = (bytes: number) => {
    return Math.max(0, Math.round(bytes / 1024));
}

// === Main Component ===
const CFHelperOverlay = () => {
    // UI State
    const [isOpen, setIsOpen] = useState(false)
    const [view, setView] = useState<"explorer" | "settings" | "contests" | "data" | "ai-leaderboard">("explorer")
    const [contestTab, setContestTab] = useState<"upcoming" | "history">("upcoming")
    const [aiSortBy, setAiSortBy] = useState<"usageRate" | "popularity" | "costEffectiveness" | "rating">("rating")
    const [aiFilterCategory, setAiFilterCategory] = useState<string>("all")
    const [searchText, setSearchText] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [importText, setImportText] = useState("")
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, problem: null })
    const [now, setNow] = useState(Date.now())

    // Data Sync & Export State
    const [dbCount, setDbCount] = useState(0)
    const [syncStatus, setSyncStatus] = useState("")
    const [localPreview, setLocalPreview] = useState<any[]>([])
    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv")
    const [exportOnlyAC, setExportOnlyAC] = useState(false)

    // Filters
    const [minRating, setMinRating] = useState("")
    const [maxRating, setMaxRating] = useState("")

    // Persistence State
    const [myListHeight, setMyListHeight] = useState(250)
    const [sidebarWidth, setSidebarWidth] = useState(300)
    const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([])

    // Refs
    const tagsRef = useRef<HTMLDivElement>(null)
    const myListRef = useRef<HTMLDivElement>(null)
    const scrollTimeout = useRef<any>(null)
    const isDraggingW = useRef(false)
    const isDraggingH = useRef(false)
    const startPos = useRef(0)
    const startDim = useRef(0)
    const dragValueRef = useRef(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Data State
    const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
    const [selectedFolderId, setSelectedFolderId] = useState<string>("")
    const [systemFolders, setSystemFolders] = useState<Folder[]>([])
    const [myFolders, setMyFolders] = useState<Folder[]>([])
    const [allProblemsCache, setAllProblemsCache] = useState<Problem[]>([])
    const [userStatus, setUserStatus] = useState<StatusMap>({})
    const [upcomingContests, setUpcomingContests] = useState<Contest[]>([])
    const [historyContests, setHistoryContests] = useState<Contest[]>([])
    const [aiModels, setAiModels] = useState<AIModel[]>([])

    const [settings, setSettings] = useState<Settings>({
        keepOpen: false, showTags: true, blurTags: true, showSystemTags: true, showStatus: false, userHandle: "", bgColor: "#252526"
    })

    const theme = useMemo(() => getThemeVariables(settings.bgColor), [settings.bgColor]);

    // === Functions ===
    const handleSetView = (newView: "explorer" | "settings" | "contests" | "data" | "ai-leaderboard") => {
        setView(newView);
        chrome.storage.local.set({ "cf_active_view": newView });
        if (newView === 'data') refreshDbCount();
        if (newView === 'ai-leaderboard') fetchAIModels();
    }

    const refreshDbCount = async () => {
        const c = await getSubmissionCount();
        setDbCount(c);
        const recent = await getRecentSubmissions(50);
        setLocalPreview(recent);
    }

    const updateSetting = (k: keyof Settings, v: any) => {
        const ns = { ...settings, [k]: v }; setSettings(ns);
        chrome.storage.local.set({ "cf_settings": ns });
    }

    // API
    const fetchUserStatus = async (handle: string, alertResult = false) => {
        if (!handle) return;
        try {
            const res = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
            const data = await res.json();
            if (data.status === "OK") {
                const newStatus: StatusMap = {};
                data.result.forEach((sub: any) => {
                    const pid = `${sub.problem.contestId}${sub.problem.index}`;
                    if (sub.verdict === "OK") newStatus[pid] = "OK";
                    else if (!newStatus[pid]) newStatus[pid] = "WRONG";
                });
                setUserStatus(newStatus);
                chrome.storage.local.set({ "cf_user_status": newStatus });
                if (alertResult) alert("Status synced successfully!");
            } else { if (alertResult) alert("Failed: " + data.comment); }
        } catch (e) { console.error(e); if (alertResult) alert("Network error."); }
    }

    const fetchContests = async (handle: string = settings.userHandle) => {
        setIsLoading(true);
        try {
            const resContests = await fetch("https://codeforces.com/api/contest.list?gym=false");
            const dataContests = await resContests.json();
            let participatedIds = new Set<number>();
            if (handle) {
                try {
                    const resRating = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
                    const dataRating = await resRating.json();
                    if (dataRating.status === "OK") dataRating.result.forEach((r: any) => participatedIds.add(r.contestId));
                } catch (e) { }
            }
            if (dataContests.status === "OK") {
                const allContests: Contest[] = dataContests.result.map((c: any) => ({
                    id: c.id, name: c.name, phase: c.phase, startTimeSeconds: c.startTimeSeconds, durationSeconds: c.durationSeconds, participated: participatedIds.has(c.id)
                }));
                const upcoming = allContests.filter(c => c.phase === "BEFORE").sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
                const history = allContests.filter(c => c.phase === "FINISHED").sort((a, b) => b.startTimeSeconds - a.startTimeSeconds).slice(0, 50);
                setUpcomingContests(upcoming);
                setHistoryContests(history);
                chrome.storage.local.set({ "cf_upcoming_contests": upcoming, "cf_history_contests": history });
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }

    const fetchAIModels = async () => {
        setIsLoading(true);
        try {
            // Try to fetch from cache first using promise wrapper
            const res = await new Promise<any>((resolve) => {
                chrome.storage.local.get(["cf_ai_models", "cf_ai_models_time"], resolve);
            });
            
            const now = Date.now();
            const cacheTime = res.cf_ai_models_time || 0;
            
            if (res.cf_ai_models && Array.isArray(res.cf_ai_models) && (now - cacheTime < AI_CACHE_TIME)) {
                setAiModels(res.cf_ai_models);
            } else {
                // Generate initial AI models data (simulated real-time data)
                const models = generateAIModelsData();
                setAiModels(models);
                chrome.storage.local.set({ "cf_ai_models": models, "cf_ai_models_time": now });
            }
        } catch (e) { 
            console.error(e); 
        } finally {
            setIsLoading(false);
        }
    }

    const generateAIModelsData = (): AIModel[] => {
        const now = Date.now() / MILLISECONDS_TO_SECONDS;
        return [
            { id: "gpt-4", name: "GPT-4", provider: "OpenAI", usageRate: 87.5, popularity: 95.2, costEffectiveness: 78.3, rating: 9.4, lastUpdated: now, category: "LLM" },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI", usageRate: 92.1, popularity: 97.8, costEffectiveness: 85.6, rating: 9.6, lastUpdated: now, category: "LLM" },
            { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "OpenAI", usageRate: 95.3, popularity: 88.4, costEffectiveness: 92.1, rating: 8.7, lastUpdated: now, category: "LLM" },
            { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic", usageRate: 81.2, popularity: 89.7, costEffectiveness: 76.4, rating: 9.2, lastUpdated: now, category: "LLM" },
            { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "Anthropic", usageRate: 84.6, popularity: 85.3, costEffectiveness: 88.9, rating: 9.0, lastUpdated: now, category: "LLM" },
            { id: "claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic", usageRate: 78.9, popularity: 76.2, costEffectiveness: 94.5, rating: 8.4, lastUpdated: now, category: "LLM" },
            { id: "gemini-pro", name: "Gemini Pro", provider: "Google", usageRate: 75.4, popularity: 82.1, costEffectiveness: 89.7, rating: 8.8, lastUpdated: now, category: "LLM" },
            { id: "gemini-ultra", name: "Gemini Ultra", provider: "Google", usageRate: 68.3, popularity: 79.6, costEffectiveness: 72.1, rating: 8.9, lastUpdated: now, category: "LLM" },
            { id: "llama-3-70b", name: "Llama 3 70B", provider: "Meta", usageRate: 71.2, popularity: 74.8, costEffectiveness: 96.3, rating: 8.3, lastUpdated: now, category: "LLM" },
            { id: "llama-3-8b", name: "Llama 3 8B", provider: "Meta", usageRate: 69.5, popularity: 68.4, costEffectiveness: 98.7, rating: 7.9, lastUpdated: now, category: "LLM" },
            { id: "mistral-large", name: "Mistral Large", provider: "Mistral AI", usageRate: 65.7, popularity: 71.3, costEffectiveness: 84.2, rating: 8.5, lastUpdated: now, category: "LLM" },
            { id: "mistral-medium", name: "Mistral Medium", provider: "Mistral AI", usageRate: 63.2, popularity: 67.9, costEffectiveness: 91.4, rating: 8.2, lastUpdated: now, category: "LLM" },
            { id: "palm-2", name: "PaLM 2", provider: "Google", usageRate: 58.4, popularity: 64.2, costEffectiveness: 82.7, rating: 8.0, lastUpdated: now, category: "LLM" },
            { id: "codellama-34b", name: "CodeLlama 34B", provider: "Meta", usageRate: 72.8, popularity: 76.5, costEffectiveness: 93.1, rating: 8.4, lastUpdated: now, category: "Code" },
            { id: "copilot", name: "GitHub Copilot", provider: "GitHub", usageRate: 89.3, popularity: 92.6, costEffectiveness: 87.5, rating: 9.1, lastUpdated: now, category: "Code" },
            { id: "codewhisperer", name: "CodeWhisperer", provider: "AWS", usageRate: 67.1, popularity: 68.9, costEffectiveness: 94.8, rating: 8.1, lastUpdated: now, category: "Code" },
            { id: "tabnine", name: "Tabnine", provider: "Tabnine", usageRate: 61.5, popularity: 63.7, costEffectiveness: 88.3, rating: 7.8, lastUpdated: now, category: "Code" },
            { id: "dall-e-3", name: "DALL-E 3", provider: "OpenAI", usageRate: 79.6, popularity: 87.4, costEffectiveness: 74.2, rating: 8.9, lastUpdated: now, category: "Image" },
            { id: "midjourney", name: "Midjourney", provider: "Midjourney", usageRate: 85.2, popularity: 93.8, costEffectiveness: 79.6, rating: 9.3, lastUpdated: now, category: "Image" },
            { id: "stable-diffusion", name: "Stable Diffusion", provider: "Stability AI", usageRate: 76.8, popularity: 81.2, costEffectiveness: 97.2, rating: 8.6, lastUpdated: now, category: "Image" },
        ];
    }

    const refreshAIModels = () => {
        const models = aiModels.map(updateAIModelMetrics);
        setAiModels(models);
        chrome.storage.local.set({ "cf_ai_models": models, "cf_ai_models_time": Date.now() });
    }

    const fetchCFProblems = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("https://codeforces.com/api/problemset.problems");
            const data = await res.json();
            if (data.status === "OK") {
                const rawProblems = data.result.problems.map((p: any) => ({ id: `${p.contestId}${p.index}`, name: p.name, tags: p.tags || [], rating: p.rating, contestId: p.contestId }));
                setAllProblemsCache(rawProblems);
                chrome.storage.local.set({ "cf_all_problems_cache": rawProblems, "cf_cache_time": Date.now() });
                const newSys = CF_TAGS.map(tag => {
                    let pList = rawProblems.filter((p: any) => p.tags?.includes(tag)).sort((a: any, b: any) => b.contestId - a.contestId).slice(0, 20);
                    return { id: `sys_${tag}`, title: tag.toUpperCase(), problems: pList };
                });
                setSystemFolders(newSys);
                chrome.storage.local.set({ "cf_sys_folders": newSys });
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }

    // --- Core Features ---
    const handleSyncData = async () => {
        if (!settings.userHandle) { alert("Please set Handle first."); return; }
        setSyncStatus("Fetching...");
        try {
            const res = await fetch(`https://codeforces.com/api/user.status?handle=${settings.userHandle}&from=1&count=10000`);
            const data = await res.json();
            if (data.status === "OK") {
                setSyncStatus(`Saving...`);
                await saveSubmissions(data.result);
                setSyncStatus("Done!");
                refreshDbCount();
            } else {
                setSyncStatus("Error: " + data.comment);
            }
        } catch (e) {
            setSyncStatus("Network Error");
        }
    }

    const handleClearDb = async () => {
        if (confirm("Clear all local submission data?")) {
            await clearDB();
            refreshDbCount();
            setSyncStatus("");
        }
    }

    const handleExportHistory = async () => {
        if (dbCount === 0) { alert("No data to export. Please Sync first."); return; }
        setSyncStatus("Exporting...");
        const data = await querySubmissions({ onlyAC: exportOnlyAC });
        data.reverse(); // Newest first

        if (exportFormat === 'json') {
            downloadFile(JSON.stringify(data, null, 2), `cf_submissions_${settings.userHandle}.json`, "application/json");
        } else {
            const headers = ["Submission ID", "Contest", "Index", "Problem Name", "Rating", "Verdict", "Language", "Time (ms)", "Memory (KB)", "Date Time"];
            const csvRows = [headers.join(",")];
            for (const row of data) {
                const dateTime = formatFullDate(row.creationTimeSeconds);
                const verdict = formatVerdictDetailed(row.verdict, row.passedTestCount);
                const memoryKB = formatMemoryKB(row.memoryConsumedBytes);
                const values = [
                    row.id, row.contestId, row.index,
                    `"${(row.name || "").replace(/"/g, '""')}"`,
                    row.rating || "", `"${verdict}"`, `"${row.programmingLanguage}"`,
                    row.timeConsumedMillis, memoryKB, `"${dateTime}"`
                ];
                csvRows.push(values.join(","));
            }
            const bom = "\uFEFF";
            const csvContent = bom + csvRows.join("\n");
            downloadFile(csvContent, `cf_submissions_${settings.userHandle}.csv`, "text/csv;charset=utf-8");
        }
        setSyncStatus("Exported!");
    }

    const copySample = () => {
        const inputPre = document.querySelector('.sample-test .input pre');
        if (inputPre && inputPre.textContent) { navigator.clipboard.writeText(inputPre.textContent); alert("Sample Input Copied!"); } else { alert("No sample input found."); }
    }

    const scrollToSubmit = () => {
        const targets = [
            document.querySelector('form.submit-form'),
            document.querySelector('.submitbox'),
            document.querySelector('#sidebar .submitbox'),
            document.querySelector('form[action*="submit"]')
        ];
        const target = targets.find(t => t !== null);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const el = target as HTMLElement;
            const oS = el.style.boxShadow; const oT = el.style.transition;
            el.style.transition = "box-shadow 0.5s";
            el.style.boxShadow = "0 0 20px rgba(255, 215, 0, 0.8)";
            setTimeout(() => { el.style.boxShadow = oS; el.style.transition = oT; }, 1500);
            const input = el.querySelector('textarea, input[type="file"], select'); if (input) (input as HTMLElement).focus();
        } else {
            if (document.querySelector('a[href*="/enter"]')) { if (confirm("You are not logged in. Go to login page?")) window.location.href = "https://codeforces.com/enter"; }
            else if (window.location.href.includes('/problemset') && !window.location.href.includes('/problem/')) alert("Please go to a specific Problem page first.");
            else alert("Submission form not found on this page.");
        }
    }

    const addProblem = () => {
        if (!activeProblem) return;
        let targetId = selectedFolderId;
        if (!targetId && myFolders.length > 0) { targetId = myFolders[0].id; setSelectedFolderId(targetId); }
        if (!targetId) return;
        const idx = myFolders.findIndex(f => f.id === targetId);
        if (idx < 0) return;
        if (myFolders[idx].problems.some(p => p.id === activeProblem.id)) { alert("Exists!"); return; }
        const fullProblem = allProblemsCache.find(p => p.id === activeProblem.id) || activeProblem;
        const nf = [...myFolders];
        nf[idx].problems.push(fullProblem);
        setMyFolders(nf);
        chrome.storage.local.set({ "cf_my_folders": nf });
        alert("Added!");
    }

    const deleteProblem = (folderId: string, problemId: string) => {
        const folderIdx = myFolders.findIndex(f => f.id === folderId);
        if (folderIdx === -1) return;
        const newFolders = [...myFolders];
        newFolders[folderIdx] = { ...newFolders[folderIdx], problems: newFolders[folderIdx].problems.filter(p => p.id !== problemId) };
        setMyFolders(newFolders);
        chrome.storage.local.set({ "cf_my_folders": newFolders });
    }

    const createFolder = () => { const n = prompt("Name:"); if (n) { const nf = [...myFolders, { id: `f_${Date.now()}`, title: n, problems: [], isCustom: true }]; setMyFolders(nf); chrome.storage.local.set({ "cf_my_folders": nf }); } }
    const deleteFolder = (fid: string) => { if (confirm("Delete folder?")) { const nf = myFolders.filter(f => f.id !== fid); setMyFolders(nf); chrome.storage.local.set({ "cf_my_folders": nf }); } }

    const handleContextMenu = (e: React.MouseEvent, problem: Problem) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, problem: problem });
    }
    const addProblemToFolder = (folderId: string) => {
        if (!contextMenu.problem) return;
        const idx = myFolders.findIndex(f => f.id === folderId);
        if (idx < 0) return;
        if (myFolders[idx].problems.some(p => p.id === contextMenu.problem!.id)) { alert("Problem already in folder."); return; }
        const nf = [...myFolders];
        nf[idx].problems.push(contextMenu.problem);
        setMyFolders(nf);
        chrome.storage.local.set({ "cf_my_folders": nf });
    }

    const handleRandomPick = () => {
        if (allProblemsCache.length === 0) { alert("Index empty. Please download first."); return; }
        const lower = searchText.toLowerCase();
        const min = minRating ? parseInt(minRating) : 0;
        const max = maxRating ? parseInt(maxRating) : 10000;
        const pool = allProblemsCache.filter(p => {
            const textMatch = !searchText || (p.id.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower) || (p.tags && p.tags.some(t => t.toLowerCase().includes(lower))));
            const ratingMatch = p.rating ? (p.rating >= min && p.rating <= max) : (min === 0);
            const notSolved = !settings.showStatus || userStatus[p.id] !== "OK";
            return textMatch && ratingMatch && notSolved;
        });
        if (pool.length === 0) { alert("No unsolved problems found."); return; }
        const randomProblem = pool[Math.floor(Math.random() * pool.length)];
        const match = randomProblem.id.match(/^(\d+)(.*)$/);
        if (match) window.location.href = `https://codeforces.com/problemset/problem/${match[1]}/${match[2]}`;
    }

    const handleImport = () => {
        const lines = importText.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 1) return;
        const title = lines[0]; const problems: Problem[] = [];
        const idRegex = /(\d+)([A-Z]\d?)/i;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            let pId = "";
            const urlMatch = line.match(/(?:contest|gym|problemset\/problem)\/(\d+)(?:\/problem\/|\/)(\w+)/);
            if (urlMatch) pId = `${urlMatch[1]}${urlMatch[2]}`; else { const idMatch = line.match(idRegex); if (idMatch) pId = idMatch[0].toUpperCase(); }
            if (pId) { const fullProblem = allProblemsCache.find(p => p.id === pId) || { id: pId, name: "Imported" }; problems.push(fullProblem); }
        }
        const newFolders = [...myFolders, { id: `fav_${Date.now()}`, title: title, problems: problems, isCustom: true }];
        setMyFolders(newFolders);
        chrome.storage.local.set({ "cf_my_folders": newFolders });
        setShowImportModal(false);
    }

    const handleExportData = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(myFolders));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "cf_helper_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (event) => { try { const importedFolders = JSON.parse(event.target?.result as string); if (Array.isArray(importedFolders)) { const newFolders = importedFolders.map(f => ({ ...f, isCustom: true })); setMyFolders(newFolders); chrome.storage.local.set({ "cf_my_folders": newFolders }); alert("Data imported successfully!"); } else { alert("Invalid file format."); } } catch (err) { alert("Error parsing JSON file."); } };
        reader.readAsText(file); e.target.value = "";
    }

    const handleScroll = () => { if (scrollTimeout.current) clearTimeout(scrollTimeout.current); scrollTimeout.current = setTimeout(() => { chrome.storage.local.set({ "cf_scroll_pos": { tags: tagsRef.current?.scrollTop || 0, myList: myListRef.current?.scrollTop || 0 } }); }, 500); }
    const startResizeW = (e: React.MouseEvent) => { isDraggingW.current = true; startPos.current = e.clientX; startDim.current = sidebarWidth; dragValueRef.current = sidebarWidth; document.body.style.cursor = "ew-resize"; attachListeners(); }
    const startResizeH = (e: React.MouseEvent) => { isDraggingH.current = true; startPos.current = e.clientY; startDim.current = myListHeight; dragValueRef.current = myListHeight; document.body.style.cursor = "ns-resize"; attachListeners(); }
    const attachListeners = () => { document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); }
    const onMouseMove = (e: MouseEvent) => { if (isDraggingW.current) { const d = e.clientX - startPos.current; const w = Math.max(200, Math.min(600, startDim.current + d)); setSidebarWidth(w); if (isOpen) adjustBody(true, w); dragValueRef.current = w; } else if (isDraggingH.current) { const d = startPos.current - e.clientY; const h = Math.max(50, Math.min(800, startDim.current + d)); setMyListHeight(h); dragValueRef.current = h; } }
    const onMouseUp = () => { if (isDraggingW.current) chrome.storage.local.set({ "cf_sidebar_width": dragValueRef.current }); else if (isDraggingH.current) chrome.storage.local.set({ "cf_mylist_height": dragValueRef.current }); isDraggingW.current = false; isDraggingH.current = false; document.body.style.cursor = "default"; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
    const adjustBody = (open: boolean, width: number = sidebarWidth) => { const b = document.querySelector("body"); if (b) b.style.marginLeft = open ? `${width}px` : "0px"; }
    const toggleSidebar = () => { const s = !isOpen; setIsOpen(s); adjustBody(s); if (settings.keepOpen) chrome.storage.local.set({ "cf_sidebar_open": s }); }
    const toggleFolder = (fid: string) => { setExpandedFolderIds(prev => { const n = prev.includes(fid) ? prev.filter(i => i !== fid) : [...prev, fid]; chrome.storage.local.set({ "cf_expanded_folders": n }); return n; }); }
    const checkUrl = () => { const u = window.location.href; const m = u.match(/(?:contest|gym)\/(\d+)\/problem\/(\w+)/) || u.match(/problemset\/problem\/(\d+)\/(\w+)/); if (m) { let n = "Problem"; try { const t = document.title.split("-"); if (t.length >= 3) n = t[2].trim(); } catch (e) { } setActiveProblem({ id: `${m[1]}${m[2]}`, name: n, tags: [] }); } else setActiveProblem(null); }

    // === Effect Hooks ===
    useEffect(() => {
        chrome.storage.local.get(null, (res) => {
            if (res.cf_mylist_height) setMyListHeight(res.cf_mylist_height);
            if (res.cf_sidebar_width) setSidebarWidth(res.cf_sidebar_width);
            if (res.cf_expanded_folders) setExpandedFolderIds(res.cf_expanded_folders);
            const loadedSettings = { ...settings, ...res.cf_settings };
            if (res.cf_settings) setSettings(loadedSettings);
            if (loadedSettings.keepOpen && res.cf_sidebar_open) { setIsOpen(true); adjustBody(true, res.cf_sidebar_width || 300); }
            if (res.cf_active_view) setView(res.cf_active_view);

            let loadedFolders: Folder[] = [];
            if (res.cf_my_folders && res.cf_my_folders.length > 0) loadedFolders = res.cf_my_folders.map((f: any) => ({ ...f, isCustom: true }));
            else loadedFolders = [{ id: "fav_def", title: "My Favorites", problems: [], isCustom: true }];
            setMyFolders(loadedFolders);
            if (loadedFolders.length > 0) setSelectedFolderId(loadedFolders[0].id);

            if (res.cf_sys_folders) setSystemFolders(res.cf_sys_folders);
            else setSystemFolders(CF_TAGS.map(tag => ({ id: `sys_${tag}`, title: tag.toUpperCase(), problems: [] })));

            const now = Date.now();
            const cacheTime = res.cf_cache_time || 0;
            const oneDay = 24 * 60 * 60 * 1000;
            if (res.cf_all_problems_cache && Array.isArray(res.cf_all_problems_cache) && (now - cacheTime < oneDay)) setAllProblemsCache(res.cf_all_problems_cache);
            else fetchCFProblems();

            if (res.cf_user_status) setUserStatus(res.cf_user_status);
            if (loadedSettings.showStatus && loadedSettings.userHandle) fetchUserStatus(loadedSettings.userHandle, false);

            if (res.cf_upcoming_contests) setUpcomingContests(res.cf_upcoming_contests);
            if (res.cf_history_contests) setHistoryContests(res.cf_history_contests);
            if (!res.cf_upcoming_contests) fetchContests(loadedSettings.userHandle);

            if (res.cf_scroll_pos) setTimeout(() => { if (tagsRef.current) tagsRef.current.scrollTop = res.cf_scroll_pos.tags || 0; if (myListRef.current) myListRef.current.scrollTop = res.cf_scroll_pos.mylist || 0; }, 300);
        });

        checkUrl();
        refreshDbCount();
        window.addEventListener('popstate', checkUrl);
        window.addEventListener('click', () => setContextMenu({ ...contextMenu, visible: false }));
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => { 
            window.removeEventListener('popstate', checkUrl); 
            clearInterval(timer); 
        }
    }, [])

    // Separate effect for AI model auto-refresh
    useEffect(() => {
        if (view !== 'ai-leaderboard') return;
        
        const aiRefreshTimer = setInterval(() => {
            setAiModels(prevModels => {
                if (prevModels.length === 0) return prevModels;
                
                const models = prevModels.map(updateAIModelMetrics);
                // Throttle storage updates - only save to storage, reading happens on demand
                chrome.storage.local.set({ "cf_ai_models": models, "cf_ai_models_time": Date.now() });
                return models;
            });
        }, AI_REFRESH_INTERVAL);
        
        return () => {
            clearInterval(aiRefreshTimer);
        };
    }, [view]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.altKey && (e.code === 'KeyC' || e.key === 'c')) {
                e.preventDefault();
                setIsOpen(prev => {
                    const next = !prev;
                    const body = document.querySelector("body");
                    if (body) body.style.marginLeft = next ? `${sidebarWidth}px` : "0px";
                    if (settings.keepOpen) chrome.storage.local.set({ "cf_sidebar_open": next });
                    return next;
                });
            }
            if (e.altKey && (e.code === 'KeyS' || e.key === 's')) {
                e.preventDefault();
                setIsOpen(true);
                const body = document.querySelector("body");
                if (body) body.style.marginLeft = `${sidebarWidth}px`;
                handleSetView('explorer');
                setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.focus(), 100);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [sidebarWidth, settings.keepOpen]);

    // === Search Logic ===
    const searchResults = useMemo(() => {
        if (!searchText && !minRating && !maxRating) return { my: [], global: [] };
        const lower = searchText.toLowerCase();
        const min = minRating ? parseInt(minRating) : 0;
        const max = maxRating ? parseInt(maxRating) : 10000;
        const isMatch = (p: Problem) => {
            const textMatch = !searchText || (p.id.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower) || (p.tags && p.tags.some(t => t.toLowerCase().includes(lower))));
            const ratingMatch = p.rating ? (p.rating >= min && p.rating <= max) : (min === 0);
            return textMatch && ratingMatch;
        };
        const getScore = (p: Problem) => {
            const pid = p.id.toLowerCase();
            if (searchText && pid === lower) return 0;
            if (searchText && pid.startsWith(lower)) return 1;
            if (searchText && p.name.toLowerCase().startsWith(lower)) return 2;
            return 3;
        };
        const sortProblems = (list: Problem[]) => list.sort((a, b) => {
            const sA = getScore(a), sB = getScore(b);
            if (sA !== sB) return sA - sB;
            if (a.id.length !== b.id.length) return a.id.length - b.id.length;
            return a.id.localeCompare(b.id);
        });
        let myMatches: Problem[] = [];
        myFolders.forEach(f => { f.problems.forEach(p => { if (isMatch(p) && !myMatches.find(x => x.id === p.id)) myMatches.push(p); }); });
        let globalMatches = allProblemsCache.filter(p => isMatch(p));
        return { my: sortProblems(myMatches), global: sortProblems(globalMatches).slice(0, 50) };
    }, [searchText, minRating, maxRating, myFolders, allProblemsCache]);

    return (
        <div className="cf-helper-container">
            {!isOpen && <button onClick={toggleSidebar} className="cf-toggle-btn">📂</button>}
            {isOpen && (
                <div className="cf-sidebar" style={{ width: sidebarWidth, ...theme }}>
                    <div className={`resizer-vertical ${isDraggingW.current ? 'active' : ''}`} onMouseDown={startResizeW}></div>
                    <div className="header">
                        <span>CF HELPER</span>
                        <div>
                            <button className={`icon-btn ${view === 'explorer' ? 'active-view-btn' : ''}`} onClick={() => handleSetView('explorer')} title="Problems">📄</button>
                            <button className={`icon-btn ${view === 'contests' ? 'active-view-btn' : ''}`} onClick={() => handleSetView('contests')} title="Contests">🏆</button>
                            <button className={`icon-btn ${view === 'ai-leaderboard' ? 'active-view-btn' : ''}`} onClick={() => handleSetView('ai-leaderboard')} title="AI Leaderboard">🤖</button>
                            <button className={`icon-btn ${view === 'data' ? 'active-view-btn' : ''}`} onClick={() => handleSetView('data')} title="Data Manager">💾</button>
                            <button className={`icon-btn ${view === 'settings' ? 'active-view-btn' : ''}`} onClick={() => handleSetView('settings')} title="Settings">⚙️</button>
                            <button className="icon-btn" onClick={toggleSidebar}>✖</button>
                        </div>
                    </div>
                    {view === 'explorer' && (
                        <div className="view-container">
                            {activeProblem ? (
                                <div className="active-panel">
                                    <div className="active-info"><div><span className="active-badge">ACTIVE</span><strong>{activeProblem.id}</strong></div></div>
                                    <div className="add-row">
                                        <button className="add-btn" style={{ marginRight: 5, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} onClick={copySample} title="Copy Input">📋</button>
                                        <button className="add-btn" style={{ marginRight: 5, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} onClick={scrollToSubmit} title="Scroll to Submit">🚀</button>
                                        <select className="folder-select" value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}>{myFolders.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
                                        <button className="add-btn" onClick={addProblem}>+ Add</button>
                                    </div>
                                </div>
                            ) : <div style={{ padding: 10, fontSize: 11, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>Go to problem page to add.</div>}

                            <div className="search-container">
                                <div className="search-input-wrapper">
                                    <input className="search-input" placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                                    {searchText && <span className="search-clear-btn" onClick={() => setSearchText("")} title="Clear">×</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                                    <div className="filter-row" style={{ flex: 1, marginTop: 0 }}>
                                        <input className="filter-input" placeholder="Min" value={minRating} onChange={e => setMinRating(e.target.value)} type="number" />
                                        <span className="filter-sep">-</span>
                                        <input className="filter-input" placeholder="Max" value={maxRating} onChange={e => setMaxRating(e.target.value)} type="number" />
                                    </div>
                                    <button className="icon-btn" onClick={handleRandomPick} title="Random Pick">🎲</button>
                                </div>
                                <div className="index-status">
                                    <span>Index: {allProblemsCache.length}</span>
                                    {allProblemsCache.length === 0 && !isLoading && <span style={{ cursor: 'pointer', color: 'var(--accent-color)' }} onClick={fetchCFProblems}>Download</span>}
                                    {isLoading && <span style={{ color: 'var(--accent-color)' }}>Downloading...</span>}
                                </div>
                            </div>

                            {searchText || minRating || maxRating ? (
                                <div className="section-tags" style={{ paddingBottom: 20 }}>
                                    <div className="section-title">MY LIST MATCHES ({searchResults.my.length})</div>
                                    {searchResults.my.map(p => <ProblemItem key={p.id} p={p} s={settings} isDark={theme.isDark} status={userStatus[p.id]} onContextMenu={(e: any) => handleContextMenu(e, p)} />)}
                                    <div className="section-title" style={{ marginTop: 10 }}>GLOBAL MATCHES</div>
                                    {searchResults.global.map(p => <ProblemItem key={p.id} p={p} s={settings} isDark={theme.isDark} status={userStatus[p.id]} onContextMenu={(e: any) => handleContextMenu(e, p)} />)}
                                </div>
                            ) : (
                                <>
                                    {settings.showSystemTags && (
                                        <>
                                            <div className="section-tags" ref={tagsRef} onScroll={handleScroll}>
                                                <div className="section-title"><span>TAGS ({systemFolders.length})</span><span className="action-icon" onClick={fetchCFProblems}>🔄</span></div>
                                                {systemFolders.map(f => <FolderItem key={f.id} folder={f} settings={settings} isDark={theme.isDark} isOpen={expandedFolderIds.includes(f.id)} onToggle={() => toggleFolder(f.id)} userStatus={userStatus} onContextMenu={handleContextMenu} />)}
                                            </div>
                                            <div className={`resizer-horizontal ${isDraggingH.current ? 'active' : ''}`} onMouseDown={startResizeH}></div>
                                        </>
                                    )}
                                    <div className="section-mylist" style={settings.showSystemTags ? { height: myListHeight } : { flex: 1, maxHeight: 'none', height: 'auto' }} ref={myListRef} onScroll={handleScroll}>
                                        <div className="section-title"><span>MY LISTS</span><div><span className="action-icon" onClick={() => { setImportText("My List\n4A"); setShowImportModal(true); }}>📥</span><span className="action-icon" onClick={createFolder}>➕</span></div></div>
                                        {myFolders.map(f => <FolderItem key={f.id} folder={f} settings={settings} isDark={theme.isDark} onDeleteFolder={() => deleteFolder(f.id)} onDeleteProblem={deleteProblem} isOpen={expandedFolderIds.includes(f.id)} onToggle={() => toggleFolder(f.id)} userStatus={userStatus} onContextMenu={handleContextMenu} />)}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {view === 'contests' && (
                        <div className="view-container">
                            <div className="section-title"><span>CONTESTS</span><span className="action-icon" onClick={() => fetchContests(settings.userHandle)} title="Refresh">🔄</span></div>
                            <div className="contest-tabs">
                                <div className={`contest-tab ${contestTab === 'upcoming' ? 'active' : ''}`} onClick={() => setContestTab('upcoming')}>Upcoming</div>
                                <div className={`contest-tab ${contestTab === 'history' ? 'active' : ''}`} onClick={() => setContestTab('history')}>History</div>
                            </div>
                            <div className="contest-list-container">
                                {(contestTab === 'upcoming' ? upcomingContests : historyContests).length === 0 && !isLoading && <div style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>{isLoading ? "Loading..." : "No contests."}</div>}
                                {(contestTab === 'upcoming' ? upcomingContests : historyContests).map(c => (
                                    <div key={c.id} className="contest-item" onClick={() => window.location.href = `https://codeforces.com/contests/${c.id}`}>
                                        <div className="contest-status">{contestTab === 'upcoming' ? <StatusIconUnsolved isDark={theme.isDark} /> : (c.participated ? <StatusIconSolved /> : <StatusIconUnsolved isDark={theme.isDark} />)}</div>
                                        <div className="contest-details">
                                            <div className="contest-name">{c.name}</div>
                                            <div className="contest-meta"><span>{formatTime(c.startTimeSeconds)}</span>{contestTab === 'upcoming' && <span className="contest-time">in {formatDuration(c.startTimeSeconds - now / 1000)}</span>}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {view === 'ai-leaderboard' && (
                        <div className="view-container">
                            <div className="section-title">
                                <span>AI LEADERBOARD</span>
                                <span className="action-icon" onClick={refreshAIModels} title="Refresh">🔄</span>
                            </div>
                            <div className="ai-controls" style={{ padding: '10px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Sort by:</span>
                                    <select className="cf-input" style={{ flex: 1, fontSize: 11 }} value={aiSortBy} onChange={e => setAiSortBy(e.target.value as any)}>
                                        <option value="rating">Rating</option>
                                        <option value="usageRate">Usage Rate</option>
                                        <option value="popularity">Popularity</option>
                                        <option value="costEffectiveness">Cost-Effectiveness</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Category:</span>
                                    <select className="cf-input" style={{ flex: 1, fontSize: 11 }} value={aiFilterCategory} onChange={e => setAiFilterCategory(e.target.value)}>
                                        <option value="all">All</option>
                                        <option value="LLM">LLM</option>
                                        <option value="Code">Code Assistants</option>
                                        <option value="Image">Image Generation</option>
                                    </select>
                                </div>
                            </div>
                            <div className="ai-leaderboard-container" style={{ flex: 1, overflow: 'auto' }}>
                                {isLoading ? (
                                    <div style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>Loading...</div>
                                ) : (
                                    aiModels
                                        .filter(m => aiFilterCategory === 'all' || m.category === aiFilterCategory)
                                        .sort((a, b) => b[aiSortBy] - a[aiSortBy])
                                        .map((model, index) => (
                                            <div key={model.id} className="ai-model-item" style={{ 
                                                padding: '12px', 
                                                borderBottom: '1px solid var(--border-color)',
                                                background: index < 3 ? 'var(--bg-secondary)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <div style={{ 
                                                        width: 24, 
                                                        height: 24, 
                                                        borderRadius: '50%', 
                                                        background: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--bg-input)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: 10,
                                                        fontWeight: 'bold',
                                                        color: index < 3 ? '#000' : 'var(--text-dim)'
                                                    }}>
                                                        {index + 1}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{model.name}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{model.provider} • {model.category}</div>
                                                    </div>
                                                    <div style={{ 
                                                        padding: '2px 6px', 
                                                        borderRadius: 4, 
                                                        background: 'var(--accent-color)', 
                                                        color: '#fff',
                                                        fontSize: 11,
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {model.rating.toFixed(1)}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                                                    <div className="ai-metric">
                                                        <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>Usage Rate</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <div style={{ 
                                                                flex: 1, 
                                                                height: 6, 
                                                                background: 'var(--bg-input)', 
                                                                borderRadius: 3,
                                                                overflow: 'hidden'
                                                            }}>
                                                                <div style={{ 
                                                                    width: `${model.usageRate}%`, 
                                                                    height: '100%', 
                                                                    background: '#4caf50',
                                                                    transition: 'width 0.3s'
                                                                }}></div>
                                                            </div>
                                                            <span style={{ fontSize: 10, minWidth: 35, textAlign: 'right' }}>{model.usageRate.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="ai-metric">
                                                        <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>Popularity</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <div style={{ 
                                                                flex: 1, 
                                                                height: 6, 
                                                                background: 'var(--bg-input)', 
                                                                borderRadius: 3,
                                                                overflow: 'hidden'
                                                            }}>
                                                                <div style={{ 
                                                                    width: `${model.popularity}%`, 
                                                                    height: '100%', 
                                                                    background: '#2196f3',
                                                                    transition: 'width 0.3s'
                                                                }}></div>
                                                            </div>
                                                            <span style={{ fontSize: 10, minWidth: 35, textAlign: 'right' }}>{model.popularity.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="ai-metric">
                                                        <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>Cost-Effectiveness</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <div style={{ 
                                                                flex: 1, 
                                                                height: 6, 
                                                                background: 'var(--bg-input)', 
                                                                borderRadius: 3,
                                                                overflow: 'hidden'
                                                            }}>
                                                                <div style={{ 
                                                                    width: `${model.costEffectiveness}%`, 
                                                                    height: '100%', 
                                                                    background: '#ff9800',
                                                                    transition: 'width 0.3s'
                                                                }}></div>
                                                            </div>
                                                            <span style={{ fontSize: 10, minWidth: 35, textAlign: 'right' }}>{model.costEffectiveness.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="ai-metric">
                                                        <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>Last Updated</div>
                                                        <div style={{ fontSize: 10 }}>{formatTime(model.lastUpdated)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'data' && (
                        <div className="view-container data-panel">
                            <div className="settings-group-title">LOCAL DATABASE</div>
                            <div className="data-card">
                                <div className="data-desc">Records Stored</div>
                                <div className="data-stat">{dbCount}</div>
                                <div className="data-desc">{syncStatus || (dbCount > 0 ? "Synced" : "Not synced")}</div>
                                <div className="sync-actions">
                                    <button className="sync-btn" onClick={handleSyncData}>🔄 Sync Submissions</button>
                                    <button className="sync-btn" style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }} onClick={handleClearDb}>🗑️ Clear DB</button>
                                </div>
                            </div>

                            <div className="settings-group" style={{ marginTop: 15, background: 'var(--bg-secondary)', padding: 10, borderRadius: 4, border: '1px solid var(--border-color)' }}>
                                <div className="settings-group-title">EXPORT OPTIONS</div>
                                <div className="settings-item">
                                    <span>Format</span>
                                    <select className="cf-input" style={{ width: 80 }} value={exportFormat} onChange={e => setExportFormat(e.target.value as "csv" | "json")}>
                                        <option value="csv">CSV (Excel)</option>
                                        <option value="json">JSON</option>
                                    </select>
                                </div>
                                <div className="settings-item">
                                    <span>Only AC</span>
                                    <input type="checkbox" checked={exportOnlyAC} onChange={e => setExportOnlyAC(e.target.checked)} />
                                </div>
                                <button className="backup-btn" style={{ marginTop: 10, background: 'var(--accent-color)', color: 'white', border: 'none' }} onClick={handleExportHistory}>📤 Export History</button>
                            </div>

                            {localPreview.length > 0 && (
                                <div className="data-table-container">
                                    <div className="data-header">Recent Activity ({localPreview.length})</div>
                                    <div className="data-list">
                                        {localPreview.map((sub: any) => (
                                            <div key={sub.id} className="data-row" onClick={() => window.location.href = `https://codeforces.com/contest/${sub.contestId}/submission/${sub.id}`}>
                                                <div className="data-col-status">
                                                    {sub.verdict === "OK" ? <span className="data-verdict-ok">✅</span> : <span className="data-verdict-wrong">⚠️</span>}
                                                </div>
                                                <div className="data-col-info">
                                                    <div className="data-title">{sub.contestId}{sub.index} - {sub.name}</div>
                                                    <div className="data-meta">{formatDateTime(sub.creationTimeSeconds)} • {sub.programmingLanguage}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'settings' && (<div className="view-container settings-panel"><div className="settings-group"><div className="settings-group-title">THEME</div><div className="settings-item"><span>Background</span><input type="color" className="color-picker-input" value={settings.bgColor} onChange={e => updateSetting("bgColor", e.target.value)} /></div></div><div className="settings-group"><div className="settings-group-title">GENERAL</div><div className="settings-item"><span>Keep Open</span><input type="checkbox" checked={settings.keepOpen} onChange={e => updateSetting("keepOpen", e.target.checked)} /></div><div className="settings-item"><span>Show System Tags</span><input type="checkbox" checked={settings.showSystemTags} onChange={e => updateSetting("showSystemTags", e.target.checked)} /></div></div><div className="settings-group"><div className="settings-group-title">DISPLAY</div><div className="settings-item"><span>Show Tags</span><input type="checkbox" checked={settings.showTags} onChange={e => updateSetting("showTags", e.target.checked)} /></div><div className="settings-item"><span>Blur Tags (Spoiler)</span><input type="checkbox" checked={settings.blurTags} onChange={e => updateSetting("blurTags", e.target.checked)} /></div><div className="settings-item"><span>Show Status</span><input type="checkbox" checked={settings.showStatus} onChange={e => updateSetting("showStatus", e.target.checked)} /></div>{settings.showStatus && (<div className="settings-item"><span>Handle</span><div style={{ display: 'flex', alignItems: 'center' }}><input className="cf-input" value={settings.userHandle} onChange={e => updateSetting("userHandle", e.target.value)} onBlur={() => fetchUserStatus(settings.userHandle)} /><button className="sync-btn" onClick={() => fetchUserStatus(settings.userHandle, true)}>Sync</button></div></div>)}</div><div className="settings-group"><div className="settings-group-title">DATA</div><button className="backup-btn" onClick={handleExportData}>Export</button><div style={{ marginTop: 10 }}><button className="backup-btn" onClick={() => fileInputRef.current?.click()}>Import</button><input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleImportFile} /></div></div></div>)}
                    {showImportModal && <div className="modal-overlay"><div className="modal-content"><div className="modal-title">Import List</div><textarea className="import-textarea" value={importText} onChange={e => setImportText(e.target.value)}></textarea><div className="modal-actions"><button className="btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button><button className="btn-primary" onClick={handleImport}>Import</button></div></div></div>}

                    {contextMenu.visible && (
                        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseLeave={() => setContextMenu({ ...contextMenu, visible: false })}>
                            <div className="context-menu-item" style={{ fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: 4, marginBottom: 4 }}>{contextMenu.problem?.id}</div>
                            <div className="context-menu-label" style={{ fontSize: 10, color: 'var(--text-dim)', padding: '0 12px' }}>Add to:</div>
                            {myFolders.map(f => (<div key={f.id} className="context-menu-item" onClick={() => { addProblemToFolder(f.id); setContextMenu({ ...contextMenu, visible: false }); }}>📂 {f.title}</div>))}
                            <div className="context-menu-divider"></div>
                            <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(contextMenu.problem?.id || ""); setContextMenu({ ...contextMenu, visible: false }); }}>📋 Copy ID</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// === Subcomponents ===
const FolderItem = ({ folder, settings, onDeleteFolder, onDeleteProblem, isOpen, onToggle, isDark, userStatus, onContextMenu }: any) => {
    const total = folder.problems.length;
    const solved = folder.problems.filter((p: any) => userStatus && userStatus[p.id] === "OK").length;
    const progressText = settings.showStatus ? `(${solved}/${total})` : `(${total})`;
    return (
        <div className={`folder ${isOpen ? 'open' : ''}`}>
            <div className="folder-header" onClick={onToggle}>
                <span className="arrow">›</span><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.title} <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 'normal' }}>{progressText}</span></span>
                {onDeleteFolder && <span className="delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteFolder() }}>🗑️</span>}
            </div>
            <div className="problem-list">
                {folder.problems.map((p: any) => <ProblemItem key={p.id} p={p} s={settings} isDark={isDark} status={userStatus ? userStatus[p.id] : undefined} onDelete={folder.isCustom && onDeleteProblem ? () => onDeleteProblem(folder.id, p.id) : undefined} onContextMenu={(e: any) => onContextMenu(e, p)} />)}
                {folder.problems.length === 0 && <div style={{ padding: '5px 0 5px 25px', opacity: 0.5, fontSize: 11 }}>Empty</div>}
            </div>
        </div>
    )
}

const StatusIconSolved = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#00b8a3" strokeWidth="2" /><path d="M7 12L10 15L17 8" stroke="#00b8a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>)
const StatusIconAttempted = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ffc01e" strokeWidth="2" /><circle cx="12" cy="12" r="6" stroke="#ffc01e" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="#ffc01e" /></svg>)
const StatusIconUnsolved = ({ isDark }: { isDark: boolean }) => (<div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isDark ? '#444' : '#ccc' }}></div>)

const ProblemItem = ({ p, s, onDelete, isDark, status, onContextMenu }: any) => {
    const isSolved = s.showStatus && status === "OK";
    const isAttempted = s.showStatus && status === "WRONG";
    const isUnsolved = s.showStatus && !isSolved && !isAttempted;
    const go = (e: any) => { e.stopPropagation(); const m = p.id.match(/^(\d+)(.*)$/); if (m) window.location.href = `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`; }
    return (
        <div className="problem-item" onClick={go} onContextMenu={onContextMenu}>
            <div className="problem-row-top">
                <div className="status-container">{isSolved && <StatusIconSolved />}{isAttempted && <StatusIconAttempted />}{isUnsolved && <StatusIconUnsolved isDark={isDark} />}</div>
                <span className="problem-id" style={{ color: isSolved ? '#00b8a3' : '' }}>{p.id}</span>
                {p.rating && <span className="problem-rating" style={{ color: getRatingColor(p.rating, isDark) }}>{p.rating}</span>}
                <span className="problem-name" style={{ opacity: isSolved ? 0.6 : 1 }}>{p.name}</span>
                {onDelete && <span className="prob-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</span>}
            </div>
            {s.showTags && p.tags && <div className="problem-row-btm">{p.tags.slice(0, 4).map((t: string) => <span key={t} className={`tag-badge ${s.blurTags ? 'blurred' : ''}`}>{t}</span>)}</div>}
        </div>
    )
}

export default CFHelperOverlay