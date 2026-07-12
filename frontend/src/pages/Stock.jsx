import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import { useModal } from "../../Context/ModalContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import GuestNavbar from "../assets/Component/GuestNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import MpinModal from "../assets/Component/MpinModal";
import {
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD
} from "../utils/indicators";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Area,
  CartesianGrid
} from "recharts";
import {
  TrendingUp,
  ArrowLeft,
  Settings,
  Plus,
  Bell,
  Eye,
  Sliders,
  ChevronDown,
  X
} from "lucide-react";

// Custom shape for Candlestick bar + wick
const CandlestickShape = (props) => {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { open, close, high, low } = payload;
  if (open == null || close == null || high == null || low == null) return null;

  const isGrowing = close >= open;
  const color = isGrowing ? "#22c55e" : "#ef4444";

  const scale = height / Math.max(0.01, Math.abs(open - close));
  const highY = y - (high - Math.max(open, close)) * scale;
  const lowY = y + height + (Math.min(open, close) - low) * scale;

  return (
    <g>
      <line x1={x + width / 2} y1={highY} x2={x + width / 2} y2={lowY} stroke={color} strokeWidth={1.5} />
      <rect x={x} y={y} width={width} height={Math.max(2, height)} fill={color} rx={0.5} />
    </g>
  );
};

const CandlestickTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.open == null) return null;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-3.5 shadow-xl text-xs space-y-1">
        <p className="font-extrabold text-slate-500 border-b border-slate-800 pb-1 mb-1.5">{data.time}</p>
        <div className="space-y-0.5 font-mono">
          <div className="flex justify-between gap-6"><span>Open:</span><span className="font-bold text-slate-200">₹{data.open.toFixed(2)}</span></div>
          <div className="flex justify-between gap-6"><span>High:</span><span className="font-bold text-green-400">₹{data.high.toFixed(2)}</span></div>
          <div className="flex justify-between gap-6"><span>Low:</span><span className="font-bold text-rose-500">₹{data.low.toFixed(2)}</span></div>
          <div className="flex justify-between gap-6"><span>Close:</span><span className="font-bold text-slate-200">₹{data.close.toFixed(2)}</span></div>
          <div className="flex justify-between gap-6"><span>Volume:</span><span className="font-bold text-slate-400">{data.volume}</span></div>
          {data.sma && <div className="flex justify-between gap-6 text-blue-400"><span>SMA:</span><span>₹{data.sma}</span></div>}
          {data.ema && <div className="flex justify-between gap-6 text-pink-400"><span>EMA:</span><span>₹{data.ema}</span></div>}
          {data.vwap && <div className="flex justify-between gap-6 text-amber-400"><span>VWAP:</span><span>₹{data.vwap}</span></div>}
        </div>
      </div>
    );
  }
  return null;
};

export default function Stock() {
  const { id } = useParams();
  const { user, token, refreshUser } = useAuth();
  const { openModal } = useModal();
  const location = useLocation();
  const navigate = useNavigate();

  const stockObj = location.state?.stock;
  const [stockInfo, setStockInfo] = useState(stockObj || null);
  const [rawCandles, setRawCandles] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [interval, setIntervalVal] = useState("1m");
  const [loading, setLoading] = useState(true);

  // Indicators selection
  const [activeIndicators, setActiveIndicators] = useState({
    sma: false,
    ema: false,
    vwap: false,
    bb: false,
    rsi: false,
    macd: false
  });

  // Watchlist & Alerts
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlists, setWatchlists] = useState([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertCondition, setAlertCondition] = useState("GT");
  const [alertValue, setAlertValue] = useState("");

  // Order Entry Box
  const [tradeSide, setTradeSide] = useState("BUY"); // BUY, SELL
  const [orderType, setOrderType] = useState("MARKET"); // MARKET, LIMIT, STOP_LOSS, GTT, BRACKET
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState("");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");

  // Trade security
  const [showMpinModal, setShowMpinModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [feedbackErr, setFeedbackErr] = useState(null);

  // Fetch basic Stock & Historical candles
  useEffect(() => {
    async function loadStockDetails() {
      if (!id) return;
      try {
        setLoading(true);
        // Get symbol metadata
        const res = await axios.get(`http://localhost:4000/api/v1/stocks/sym/${id}`);
        const stockData = res.data.data.stock;
        setStockInfo(stockData);
        setLimitPrice(stockData.currentPrice.toFixed(2));
        setTriggerPrice((stockData.currentPrice * 0.98).toFixed(2));

        // Get candles
        try {
          const chartRes = await axios.get(
            `http://localhost:4000/api/v1/candle/${stockData.id}/candles?interval=${interval}`
          );
          const candles = chartRes.data.data.candles || [];
          const chronological = [...candles].reverse().map((c) => ({
            time: new Date(c.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 100
          }));
          setRawCandles(chronological);
        } catch (err) {
          // Fallback mock candles
          const base = stockData.currentPrice;
          const mock = [];
          for (let i = 0; i < 40; i++) {
            const open = base * (1 + (Math.random() - 0.5) * 0.015);
            const close = open * (1 + (Math.random() - 0.5) * 0.01);
            mock.push({
              time: new Date(Date.now() - (40 - i) * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              open,
              high: Math.max(open, close) * (1 + Math.random() * 0.005),
              low: Math.min(open, close) * (1 - Math.random() * 0.005),
              close,
              volume: Math.floor(Math.random() * 500) + 100
            });
          }
          setRawCandles(mock);
        }
      } catch (err) {
        console.error("Error loading details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStockDetails();
  }, [id, interval]);

  // Apply technical indicators onto raw data
  useEffect(() => {
    if (rawCandles.length === 0) return;

    let computed = [...rawCandles].map((c) => ({
      ...c,
      bodyRange: [Math.min(c.open, c.close), Math.max(c.open, c.close)]
    }));

    // SMA
    if (activeIndicators.sma) {
      const sma = calculateSMA(computed, 14);
      computed = computed.map((c, i) => ({ ...c, sma: sma[i] }));
    }
    // EMA
    if (activeIndicators.ema) {
      const ema = calculateEMA(computed, 14);
      computed = computed.map((c, i) => ({ ...c, ema: ema[i] }));
    }
    // VWAP
    if (activeIndicators.vwap) {
      const vwap = calculateVWAP(computed);
      computed = computed.map((c, i) => ({ ...c, vwap: vwap[i] }));
    }
    // Bollinger Bands
    if (activeIndicators.bb) {
      const bb = calculateBollingerBands(computed, 20, 2);
      computed = computed.map((c, i) => ({
        ...c,
        bbUpper: bb.upper[i],
        bbMiddle: bb.middle[i],
        bbLower: bb.lower[i]
      }));
    }
    // RSI
    if (activeIndicators.rsi) {
      const rsi = calculateRSI(computed, 14);
      computed = computed.map((c, i) => ({ ...c, rsi: rsi[i] }));
    }
    // MACD
    if (activeIndicators.macd) {
      const macd = calculateMACD(computed);
      computed = computed.map((c, i) => ({
        ...c,
        macdLine: macd.macdLine[i],
        macdSignal: macd.signalLine[i],
        macdHist: macd.histogram[i]
      }));
    }

    setChartData(computed);
  }, [rawCandles, activeIndicators]);

  // Subscribe to live price ticks
  useEffect(() => {
    if (!stockInfo) return;

    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      socket.emit("subscribe", [stockInfo.symbol]);
      if (user) {
        socket.emit("register", user.id);
      }
    });

    socket.on("price-update", (updates) => {
      if (!updates || updates.length === 0) return;
      const up = updates[0];
      if (up.symbol === stockInfo.symbol) {
        setStockInfo((prev) => ({ ...prev, currentPrice: up.price }));
        
        // Append live candle updates for 1m timeframe
        if (interval === "1m") {
          setRawCandles((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const last = { ...next[next.length - 1] };
            const curMin = new Date(up.timeStamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            if (last.time === curMin) {
              last.close = up.price;
              last.high = Math.max(last.high, up.price);
              last.low = Math.min(last.low, up.price);
              next[next.length - 1] = last;
            } else {
              const newCandle = {
                time: curMin,
                open: last.close,
                high: Math.max(last.close, up.price),
                low: Math.min(last.close, up.price),
                close: up.price,
                volume: 50
              };
              next.push(newCandle);
              if (next.length > 50) next.shift();
            }
            return next;
          });
        }
      }
    });

    // Real-time alert hit notification toast
    socket.on("alert-triggered", (alertData) => {
      if (alertData.symbol === stockInfo.symbol) {
        alert(`🔔 Alert triggered: ${alertData.message}`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [stockInfo?.symbol, interval, user]);

  // Fetch Watchlists on mount
  useEffect(() => {
    if (!token) return;
    async function loadWatchlists() {
      try {
        const res = await axios.get("http://localhost:4000/api/v1/watchlist", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWatchlists(res.data.data.watchlists);
        // Check if currently watchlisted
        const isAdded = res.data.data.watchlists.some(w =>
          w.items.some(item => item.stockId === stockInfo?.id)
        );
        setInWatchlist(isAdded);
      } catch (err) {
        console.error(err);
      }
    }
    if (stockInfo) loadWatchlists();
  }, [token, stockInfo]);

  // Add/Remove Watchlist Item
  const toggleWatchlist = async () => {
    if (!token) return openModal("login");
    try {
      if (inWatchlist) {
        // Find watchlist item id to remove
        let itemId = null;
        for (let w of watchlists) {
          const matched = w.items.find(item => item.stockId === stockInfo.id);
          if (matched) {
            itemId = matched.id;
            break;
          }
        }
        if (itemId) {
          await axios.delete(`http://localhost:4000/api/v1/watchlist/item/${itemId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setInWatchlist(false);
        }
      } else {
        // Add to first watchlist
        const firstWatchlist = watchlists[0];
        if (firstWatchlist) {
          await axios.post("http://localhost:4000/api/v1/watchlist/item", {
            watchlistId: firstWatchlist.id,
            stockId: stockInfo.id
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setInWatchlist(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Alert Creation
  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!token) return openModal("login");
    if (!alertValue || parseFloat(alertValue) <= 0) return;

    try {
      await axios.post("http://localhost:4000/api/v1/alert", {
        symbol: stockInfo.symbol,
        assetType: "STOCK",
        condition: alertCondition,
        value: parseFloat(alertValue)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAlertModal(false);
      setAlertValue("");
      alert("Alert set successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger MPIN popup for order placement
  const triggerOrderSubmit = (e) => {
    e.preventDefault();
    if (!token) return openModal("login");
    if (quantity <= 0) return setFeedbackErr("Quantity must be greater than zero.");
    
    setFeedbackErr(null);
    setFeedbackMsg(null);
    setShowMpinModal(true);
  };

  // Process order on MPIN success
  const executeOrder = async (mpin) => {
    setShowMpinModal(false);
    setSubmitting(true);

    const price = orderType === "MARKET" ? stockInfo.currentPrice : parseFloat(limitPrice);
    
    const body = {
      symbol: stockInfo.symbol,
      assetType: "STOCK",
      side: tradeSide,
      type: orderType,
      qty: quantity,
      limitPrice: price,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
      targetPrice: targetPrice ? parseFloat(targetPrice) : undefined,
      stopPrice: stopPrice ? parseFloat(stopPrice) : undefined,
      mpin
    };

    try {
      const res = await axios.post("http://localhost:4000/api/v1/stocks/order/place", body, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedbackMsg(res.data.message);
      setQuantity(1);
      await refreshUser();
    } catch (err) {
      setFeedbackErr(err.response?.data?.error || "Order execution failed. Please verify credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !stockInfo) {
    return (
      <div className="bg-white min-h-screen">
        {token ? <AuthNavbar /> : <GuestNavbar />}
        <div className="flex items-center justify-center min-h-screen pt-20">
          <Loading text="Loading stock market feeds..." />
        </div>
      </div>
    );
  }

  // Cost estimates
  const executionPrice = orderType === "MARKET" ? stockInfo.currentPrice : parseFloat(limitPrice || stockInfo.currentPrice);
  const totalCost = quantity * executionPrice;
  const isAffordable = user ? user.cashBalance >= totalCost : true;

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col">
      {token ? <AuthNavbar /> : <GuestNavbar />}

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-24 mb-12 flex-1">
        {/* Navigation line */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate(token ? "/dashboard" : "/")}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Quick shortcuts */}
          <div className="flex gap-2">
            <button
              onClick={toggleWatchlist}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                inWatchlist 
                  ? "bg-green-50 text-green-600 border-green-200" 
                  : "bg-white text-gray-500 border-gray-100 hover:text-slate-700"
              }`}
            >
              <Eye className="w-4 h-4" />
              {inWatchlist ? "Watchlisted" : "Watchlist"}
            </button>
            <button
              onClick={() => setShowAlertModal(true)}
              className="p-2.5 bg-white text-gray-500 border border-gray-100 hover:text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Bell className="w-4 h-4" />
              Create Alert
            </button>
          </div>
        </div>

        {/* Stock Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Asset Header Info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-500 text-white flex items-center justify-center rounded-2xl text-xl font-bold shadow-md shadow-green-100">
                  {stockInfo.symbol.slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900">{stockInfo.symbol}</h1>
                  <p className="text-xs text-gray-400 font-semibold">{stockInfo.companyName} | {stockInfo.exchange}</p>
                </div>
              </div>

              <div>
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  ₹{stockInfo.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold mt-1 justify-end">
                  <TrendingUp className="w-3 h-3" />
                  <span>Sector: {stockInfo.sector}</span>
                </div>
              </div>
            </div>

            {/* TradingView-like Charting Canvas */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                
                {/* Timeframes selectors */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-max">
                  {["1m", "5m", "15m", "1d", "1w"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setIntervalVal(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        interval === t ? "bg-white text-green-600 shadow-sm" : "text-gray-400"
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Technical Indicators Pill Toggles */}
                <div className="flex items-center gap-2 flex-wrap text-slate-500 text-xs">
                  <span className="font-semibold flex items-center gap-1 text-[10px] uppercase text-gray-400 mr-1">
                    <Sliders className="w-3.5 h-3.5" /> Overlays:
                  </span>
                  {Object.keys(activeIndicators).map((ind) => (
                    <button
                      key={ind}
                      onClick={() => setActiveIndicators(prev => ({ ...prev, [ind]: !prev[ind] }))}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition ${
                        activeIndicators[ind] 
                          ? "bg-slate-900 text-white border-slate-900" 
                          : "bg-white border-gray-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {ind.toUpperCase()}
                    </button>
                  ))}
                </div>

              </div>

              {/* Composed Chart */}
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    
                    {/* Volume Y-Axis (Hidden, used to scale overlay bars at bottom) */}
                    <YAxis yAxisId="volumeAxis" orientation="right" domain={[0, (dataMax) => dataMax * 4]} hide={true} />

                    <Tooltip content={<CandlestickTooltip />} />

                    {/* Candlestick Body */}
                    <Bar dataKey="bodyRange" shape={<CandlestickShape />} />

                    {/* Volume overlay at the bottom */}
                    <Bar dataKey="volume" yAxisId="volumeAxis" fill="#94a3b8" opacity={0.15} name="Volume" />

                    {/* Dynamic overlay indicators */}
                    {activeIndicators.sma && <Line type="monotone" dataKey="sma" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="SMA" />}
                    {activeIndicators.ema && <Line type="monotone" dataKey="ema" stroke="#ec4899" dot={false} strokeWidth={1.5} name="EMA" />}
                    {activeIndicators.vwap && <Line type="monotone" dataKey="vwap" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="VWAP" />}
                    {activeIndicators.bb && (
                      <>
                        <Line type="monotone" dataKey="bbUpper" stroke="#a855f7" strokeDasharray="3 3" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="bbLower" stroke="#a855f7" strokeDasharray="3 3" dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="bbMiddle" stroke="#a855f7" dot={false} strokeWidth={0.5} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Sub-charts for Oscillators (RSI) */}
              {activeIndicators.rsi && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2">Relative Strength Index (RSI 14)</h4>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" hide={true} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 8 }} ticks={[30, 50, 70]} />
                        <Tooltip />
                        {/* Reference lines at 30 and 70 */}
                        <Line type="monotone" dataKey="rsi" stroke="#6366f1" dot={false} strokeWidth={1.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Sub-charts for MACD */}
              {activeIndicators.macd && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h4 className="text-[10px] text-slate-400 font-bold uppercase mb-2">MACD (12, 26, 9)</h4>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" hide={true} />
                        <YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 8 }} />
                        <Tooltip />
                        <Bar dataKey="macdHist" fill="#cbd5e1" opacity={0.6} />
                        <Line type="monotone" dataKey="macdLine" stroke="#3b82f6" dot={false} strokeWidth={1.2} />
                        <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" dot={false} strokeWidth={1.2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            </div>

            {/* Quick overview */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wide mb-4">Stock Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs leading-normal">
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Exchange</p>
                  <p className="font-bold text-gray-800">{stockInfo.exchange}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Market Cap</p>
                  <p className="font-bold text-gray-800">₹{(stockInfo.marketCap / 10000000).toFixed(2)} Cr</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Sector</p>
                  <p className="font-bold text-gray-800">{stockInfo.sector}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Total Shares</p>
                  <p className="font-bold text-gray-800">{(Number(stockInfo.totalQuantity) / 100000).toFixed(1)} L</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Brokerage Order Panel */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md sticky top-24">
              
              {/* BUY / SELL Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => {
                    setTradeSide("BUY");
                    setFeedbackErr(null);
                    setFeedbackMsg(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg transition-all uppercase ${
                    tradeSide === "BUY" ? "bg-green-500 text-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    setTradeSide("SELL");
                    setFeedbackErr(null);
                    setFeedbackMsg(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg transition-all uppercase ${
                    tradeSide === "SELL" ? "bg-red-500 text-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Feedbacks */}
              {feedbackMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-xl font-medium">{feedbackMsg}</div>}
              {feedbackErr && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{feedbackErr}</div>}

              {/* Form Input fields */}
              <form onSubmit={triggerOrderSubmit} className="space-y-5 text-xs">
                
                {token && (
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <span className="text-gray-400 font-semibold">Simulated Capital</span>
                    <span className="font-extrabold text-slate-700">
                      ₹{user?.cashBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Order Type Dropdown */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Order Execution Type</label>
                  <select
                    value={orderType}
                    onChange={(e) => {
                      setOrderType(e.target.value);
                      setError(null);
                    }}
                    className="w-full border border-gray-200 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="MARKET">Market Order</option>
                    <option value="LIMIT">Limit Order</option>
                    <option value="STOP_LOSS">Stop Loss Trigger</option>
                    <option value="GTT">GTT (Good Till Triggered)</option>
                    <option value="BRACKET">Bracket Order (Target + SL)</option>
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Quantity (Shares)</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold text-slate-800"
                  />
                </div>

                {/* Conditional Fields based on order types */}
                {orderType === "LIMIT" && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Limit Target Price</label>
                    <input
                      type="number"
                      step={0.05}
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                      placeholder="Specify limit price"
                      required
                    />
                  </div>
                )}

                {orderType === "STOP_LOSS" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Trigger Price</label>
                      <input
                        type="number"
                        step={0.05}
                        value={triggerPrice}
                        onChange={(e) => setTriggerPrice(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Limit Price</label>
                      <input
                        type="number"
                        step={0.05}
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                        required
                      />
                    </div>
                  </div>
                )}

                {orderType === "GTT" && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">GTT Trigger Target Price</label>
                    <input
                      type="number"
                      step={0.05}
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                      placeholder="Trigger Price"
                      required
                    />
                  </div>
                )}

                {orderType === "BRACKET" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Limit Buy Price</label>
                      <input
                        type="number"
                        step={0.05}
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Profit</label>
                        <input
                          type="number"
                          step={0.05}
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                          placeholder="e.g. Price + 10"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Stop Loss Limit</label>
                        <input
                          type="number"
                          step={0.05}
                          value={stopPrice}
                          onChange={(e) => setStopPrice(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                          placeholder="e.g. Price - 5"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Estimator details */}
                <div className="space-y-1.5 border-t border-slate-100 pt-4 text-[11px] text-gray-500">
                  <div className="flex justify-between">
                    <span>Est. Share Rate</span>
                    <span className="font-bold">₹{executionPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-bold text-xs pt-1 border-t border-dashed border-slate-100">
                    <span>Est. Margin Required</span>
                    <span className={tradeSide === "BUY" ? "text-green-600" : "text-rose-500"}>
                      ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Submissions */}
                {token ? (
                  user && user.kycStatus === "APPROVED" ? (
                    tradeSide === "BUY" ? (
                      <button
                        type="submit"
                        disabled={submitting || !isAffordable}
                        className={`w-full text-white font-extrabold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-xs cursor-pointer ${
                          isAffordable ? "bg-green-500 hover:bg-green-600" : "bg-gray-300 cursor-not-allowed"
                        }`}
                      >
                        {submitting ? "SUBMITTING TRADE..." : isAffordable ? "PLACE BUY ORDER" : "INSUFFICIENT FUNDS"}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all text-xs cursor-pointer"
                      >
                        {submitting ? "SUBMITTING TRADE..." : "PLACE SELL ORDER"}
                      </button>
                    )
                  ) : (
                    <div className="w-full text-center p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl space-y-2">
                      <p>Complete and verify your KYC to start investing.</p>
                      <button
                        type="button"
                        onClick={() => navigate("/kyc")}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-lg text-[10px] cursor-pointer"
                      >
                        COMPLETE KYC NOW
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal("login")}
                    className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold py-3.5 rounded-xl transition text-xs"
                  >
                    LOGIN TO START TRADING
                  </button>
                )}

              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Alert creation modal */}
      {showAlertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full mx-4 border border-slate-100 shadow-2xl relative text-slate-800">
            <button onClick={() => setShowAlertModal(false)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-slate-600 hover:bg-slate-50 rounded-full">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
              <Bell className="w-5 h-5 text-green-500" />
              Create Price Alert
            </h3>
            <p className="text-[10px] text-gray-400 leading-normal mb-4">
              Get notified in real-time when {stockInfo.symbol} crosses your target trigger price.
            </p>

            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Trigger Condition</label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-center font-bold">
                  <button
                    type="button"
                    onClick={() => setAlertCondition("GT")}
                    className={`flex-1 py-1.5 rounded-md transition-all ${
                      alertCondition === "GT" ? "bg-white text-slate-850 shadow-sm" : "text-gray-400"
                    }`}
                  >
                    Price Goes Above ( &gt; )
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertCondition("LT")}
                    className={`flex-1 py-1.5 rounded-md transition-all ${
                      alertCondition === "LT" ? "bg-white text-slate-850 shadow-sm" : "text-gray-400"
                    }`}
                  >
                    Price Goes Below ( &lt; )
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Target Price (₹)</label>
                <input
                  type="number"
                  step={0.05}
                  value={alertValue}
                  onChange={(e) => setAlertValue(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 font-bold"
                  placeholder={stockInfo.currentPrice.toFixed(2)}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3 rounded-xl transition cursor-pointer text-xs"
              >
                ESTABLISH PRICE ALERT
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MPIN authorization popup */}
      {showMpinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <MpinModal
            token={token}
            actionType={`${tradeSide.toLowerCase()} ${orderType.toLowerCase()}`}
            stockSymbol={stockInfo.symbol}
            quantity={`${quantity} Shares`}
            totalValue={totalCost}
            onClose={() => setShowMpinModal(false)}
            onSuccess={executeOrder}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}
