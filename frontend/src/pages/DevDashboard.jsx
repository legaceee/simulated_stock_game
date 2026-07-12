import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Database,
  Cpu,
  RefreshCw,
  Terminal,
  Play,
  Pause,
  AlertOctagon,
  Shield,
  Layers,
  ChevronRight,
  TrendingUp,
  Activity,
  Trash2,
  ArrowLeft
} from "lucide-react";

export default function DevDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passcode, setPasscode] = useState(localStorage.getItem("devSecret") || "");
  const [verificationError, setVerificationError] = useState(null);
  
  // Dashboard state
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'seed', 'reset', 'sim'
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  const navigate = useNavigate();

  // Verify passcode
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!passcode) {
      setVerificationError("Please enter a developer passcode.");
      return;
    }
    setVerificationError(null);
    setLoading(true);
    try {
      await axios.post("http://localhost:4000/api/v1/dev/verify", {}, {
        headers: { "X-Developer-Secret": passcode }
      });
      localStorage.setItem("devSecret", passcode);
      setIsAuthorized(true);
      fetchStats();
    } catch (err) {
      console.error(err);
      setVerificationError(err.response?.data?.message || "Invalid Developer Passcode.");
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch metrics
  const fetchStats = async () => {
    if (!passcode) return;
    try {
      const res = await axios.get("http://localhost:4000/api/v1/dev/stats", {
        headers: { "X-Developer-Secret": passcode }
      });
      setStats(res.data.data);
    } catch (err) {
      console.error("Failed to load developer stats:", err);
      setActionError("Failed to fetch system telemetries.");
    }
  };

  // Auto-verify on mount if stored in localStorage
  useEffect(() => {
    if (passcode) {
      handleVerify();
    }
  }, []);

  // Trigger Database Seed
  const runSeed = async () => {
    if (actionLoading) return;
    setActionLoading("seed");
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await axios.post("http://localhost:4000/api/v1/dev/seed", {}, {
        headers: { "X-Developer-Secret": passcode }
      });
      setActionMessage("Database seeded successfully!");
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.error || "Seeding failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Reset Demo Data
  const runReset = async () => {
    if (actionLoading) return;
    if (!window.confirm("Are you sure you want to drop all portfolio assets, transactions, order records, and reset balances? This cannot be undone.")) {
      return;
    }
    setActionLoading("reset");
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await axios.post("http://localhost:4000/api/v1/dev/reset-data", {}, {
        headers: { "X-Developer-Secret": passcode }
      });
      setActionMessage("Demo database reset completed. All users set to pending KYC and 100k simulated balance.");
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.error || "Reset failed.");
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Simulation pause/play
  const toggleSim = async (shouldPause) => {
    if (actionLoading) return;
    setActionLoading("sim");
    setActionMessage(null);
    setActionError(null);
    try {
      await axios.post("http://localhost:4000/api/v1/dev/toggle-sim", { paused: shouldPause }, {
        headers: { "X-Developer-Secret": passcode }
      });
      setActionMessage(`Simulation ${shouldPause ? "PAUSED" : "RESUMED"} successfully.`);
      fetchStats();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to toggle simulation.");
    } finally {
      setActionLoading(null);
    }
  };

  // Clear session and lock dev portal
  const handleLock = () => {
    localStorage.removeItem("devSecret");
    setPasscode("");
    setIsAuthorized(false);
    setVerificationError(null);
  };

  // ---------------- Gatekeeper screen ----------------
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col justify-center items-center px-4 font-sans text-slate-100">
        <div className="absolute top-6 left-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>

        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-md rounded-3xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/10 rounded-full blur-xl"></div>
          
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-slate-800 text-green-400 flex items-center justify-center rounded-2xl mb-4 border border-slate-700 shadow-inner">
              <Shield className="w-7 h-7" />
            </div>
            
            <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">Developer Core Portal</h1>
            <p className="text-xs text-slate-400 max-w-[280px] mb-6">
              Enter your developer credentials to access internal system logs, telemetry gauges, and database tasks.
            </p>

            {verificationError && (
              <div className="w-full p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2 mb-4 text-left">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{verificationError}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="w-full space-y-4">
              <input
                type="password"
                placeholder="Enter Developer Secret Passcode..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 text-center font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all placeholder:text-slate-600"
              />
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold py-3.5 rounded-xl transition duration-150 shadow-lg shadow-green-500/10 text-sm cursor-pointer"
              >
                {loading ? "Authenticating security..." : "UNLOCK PORTAL"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Authorized Dashboard screen ----------------
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex flex-col">
      {/* Header bar */}
      <header className="bg-slate-950/50 border-b border-slate-900 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 border border-slate-800 text-green-400 flex items-center justify-center rounded-xl font-mono text-sm">
              Dev
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                Developer Entry Portal
                <span className="h-2 w-2 rounded-full bg-green-400 inline-block animate-pulse"></span>
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Internal Telemetry Console</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition hover:scale-[1.02] cursor-pointer"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleLock}
              className="text-xs font-semibold px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl transition cursor-pointer"
            >
              Lock Console
            </button>
            <Link
              to="/dashboard"
              className="text-xs font-semibold px-4 py-2 bg-slate-900 text-slate-300 border border-slate-800 hover:text-white rounded-xl transition"
            >
              User App
            </Link>
          </div>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-8 mb-12 flex-1 space-y-8">
        
        {/* Status notification alerts */}
        {(actionMessage || actionError) && (
          <div className="grid grid-cols-1 gap-4">
            {actionMessage && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-2xl flex items-center gap-2 font-medium">
                <Activity className="w-5 h-5 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}
            {actionError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-2xl flex items-center gap-2 font-medium">
                <AlertOctagon className="w-5 h-5 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Postgres Telemetry */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-4 right-4 text-blue-500/10">
              <Database className="w-16 h-16" />
            </div>
            <h3 className="font-extrabold text-slate-400 text-xs tracking-wider uppercase mb-4 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-400" />
              PostgreSQL Database
            </h3>
            
            {stats ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">DB Status:</span>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5 rounded-full text-[10px]">
                    {stats.postgres.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Registered Users:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.postgres.userCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Active Sessions:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.postgres.sessionCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Order Logs:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.postgres.orderCount}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Executed Transactions:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.postgres.transactionCount}</span>
                </div>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-xs font-semibold">Loading Postgres gauges...</div>
            )}
          </div>

          {/* Card 2: Redis Cache Status */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-4 right-4 text-red-500/10">
              <Cpu className="w-16 h-16" />
            </div>
            <h3 className="font-extrabold text-slate-400 text-xs tracking-wider uppercase mb-4 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-red-400" />
              Redis Cache & Streams
            </h3>
            
            {stats ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Used Memory:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.redis.memoryUsed}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Connected Clients:</span>
                  <span className="font-mono font-bold text-slate-100">{stats.redis.connectedClients}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">WebSocket Sockets:</span>
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 font-bold px-2 py-0.5 rounded-full text-[10px]">
                    {stats.redis.activeWsClients} Active
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Rate Limiter Backend:</span>
                  <span className="font-bold text-slate-400">Redis Memory Store</span>
                </div>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-xs font-semibold">Loading Redis gauges...</div>
            )}
          </div>

          {/* Card 3: Market Simulator Control */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-400 text-xs tracking-wider uppercase mb-4 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Market Simulation Engine
              </h3>
              
              {stats ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Tick Simulator Status:</span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${
                      stats.simulation.paused 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                        : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}>
                      {stats.simulation.paused ? "PAUSED" : "ACTIVE (3s updates)"}
                    </span>
                  </div>
                  
                  <div className="text-[10px] text-slate-500 leading-normal font-medium">
                    The engine generates ticks for Nifty Stocks and Commodities, manages price limits, evaluates alerts, and settles pending orders.
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-slate-600 text-xs font-semibold">Loading Simulator state...</div>
              )}
            </div>

            {stats && (
              <div className="mt-4 pt-4 border-t border-slate-900">
                {stats.simulation.paused ? (
                  <button
                    onClick={() => toggleSim(false)}
                    disabled={actionLoading === "sim"}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold bg-green-500 hover:bg-green-600 text-slate-950 rounded-xl transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    RESUME SIMULATION
                  </button>
                ) : (
                  <button
                    onClick={() => toggleSim(true)}
                    disabled={actionLoading === "sim"}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl transition cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    PAUSE SIMULATION
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Database Seeding and Reset tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-slate-200 mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-green-400" />
                Seed Initial Metadata
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Seed or upsert core assets data (Nifty 50 Bluechips, Mutual Funds, Commodities) into the database. Existing assets won't be deleted; their metadata will be updated.
              </p>
            </div>
            <button
              onClick={runSeed}
              disabled={actionLoading !== null}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-extrabold bg-slate-905 hover:bg-slate-900 text-slate-200 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === "seed" ? "animate-spin" : ""}`} />
              {actionLoading === "seed" ? "Running Prisma seed..." : "SEED DATABASE ASSETS"}
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-rose-400 mb-2 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                Hard Reset Demo Database
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Truncates orders, transactions, portfolio holdings, active sessions, and wallets. Restores all user simulated balances back to ₹100,000.00 and resets KYC to Pending.
              </p>
            </div>
            <button
              onClick={runReset}
              disabled={actionLoading !== null}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-extrabold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {actionLoading === "reset" ? "Resetting database..." : "RESET ALL DEMO DATA"}
            </button>
          </div>

        </div>

        {/* Server log terminal stream */}
        <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-green-400" />
              Server Console Logs (Real-time Stream)
            </h4>
            <span className="text-[10px] bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded-md border border-slate-800">
              server_logs.txt
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-900 rounded-xl p-4 font-mono text-[11px] text-slate-400 h-64 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
            {stats && stats.logs && stats.logs.length > 0 ? (
              stats.logs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-normal">
                  <span className="text-green-500/70 shrink-0 inline-block mr-1">dev@investnoww:~$</span>
                  {line}
                </div>
              ))
            ) : (
              <div className="text-slate-600 italic">No console logs recorded yet. Perform actions to see logs.</div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
