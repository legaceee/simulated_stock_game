import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, NavLink } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import { useModal } from "../../Context/ModalContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import GuestNavbar from "../assets/Component/GuestNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldAlert,
  ArrowLeft
} from "lucide-react";

function Stock() {
  const { id } = useParams(); // Stock symbol from route, e.g., AAPL
  const { user, token, refreshUser } = useAuth();
  const { openModal } = useModal();
  const location = useLocation();
  const navigate = useNavigate();

  const stockObj = location.state?.stock;
  const [stockInfo, setStockInfo] = useState(stockObj || null);
  const [chartData, setChartData] = useState([]);
  const [interval, setIntervalVal] = useState("1m");
  const [loading, setLoading] = useState(true);

  // Buy/Sell Transaction States
  const [tradeType, setTradeType] = useState("BUY"); // "BUY" or "SELL"
  const [quantity, setQuantity] = useState(1);
  const [transactionMessage, setTransactionMessage] = useState(null);
  const [transactionError, setTransactionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Stock Info and historical candles
  useEffect(() => {
    async function fetchStockAndCandles() {
      if (!id) return;
      try {
        setLoading(true);
        // 1. Fetch stock basic info by symbol
        const res = await axios.get(`http://localhost:4000/api/v1/stocks/sym/${id}`);
        const stockData = res.data.data.stock;
        setStockInfo(stockData);

        // 2. Fetch candles
        try {
          const chartRes = await axios.get(
            `http://localhost:4000/api/v1/candle/${stockData.id}/candles?interval=${interval}`
          );
          const candles = chartRes.data.data.candles || [];
          // Candles from DB are descending. Reverse them for left-to-right timeline.
          const chronologicalCandles = [...candles].reverse().map((c) => ({
            time: new Date(c.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            price: c.close,
          }));
          setChartData(chronologicalCandles);
        } catch (err) {
          console.warn("No candle database records found. Generating placeholder initial point.", err);
          setChartData([
            {
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              price: stockData.currentPrice,
            },
          ]);
        }
      } catch (err) {
        console.error("Error loading stock or candles:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStockAndCandles();
  }, [id, interval]);

  // Socket updates for real-time price and chart append
  useEffect(() => {
    if (!stockInfo) return;

    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Connected to socket server on stock details page");
      socket.emit("subscribe", [stockInfo.symbol]);
    });

    socket.on("price-update", (updates) => {
      if (!updates || updates.length === 0) return;
      const update = updates[0]; // since we only subscribed to one symbol
      if (update.symbol === stockInfo.symbol) {
        // Update current price
        setStockInfo((prev) => ({ ...prev, currentPrice: update.price }));

        // Append to chart data
        setChartData((prevData) => {
          const newPoint = {
            time: new Date(update.timeStamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            price: update.price,
          };
          // Limit to last 50 points to prevent charts bloating
          const nextData = [...prevData, newPoint];
          if (nextData.length > 50) nextData.shift();
          return nextData;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [stockInfo?.symbol]);

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!token) {
      openModal("login");
      return;
    }
    if (quantity <= 0) {
      setTransactionError("Please enter a valid quantity.");
      return;
    }

    setSubmitting(true);
    setTransactionError(null);
    setTransactionMessage(null);

    const price = stockInfo.currentPrice;
    const body = {
      stockId: stockInfo.id,
      currentPrice: price,
    };

    if (tradeType === "BUY") {
      body.buyQuantity = quantity;
    } else {
      body.sellQuantity = quantity;
    }

    const endpoint = `http://localhost:4000/api/v1/stocks/${tradeType.toLowerCase()}/${stockInfo.symbol}`;

    try {
      const res = await axios.post(endpoint, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setTransactionMessage(
        `Successfully ${tradeType === "BUY" ? "bought" : "sold"} ${quantity} shares of ${stockInfo.symbol}!`
      );
      setQuantity(1);
      // Refresh user balance in context
      await refreshUser();
    } catch (err) {
      console.error(err);
      setTransactionError(err.response?.data?.error || "Transaction failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !stockInfo) {
    return (
      <div className="bg-white min-h-screen">
        {token ? <AuthNavbar /> : <GuestNavbar />}
        <div className="flex items-center justify-center min-h-screen pt-20">
          <Loading text="Fetching stock details..." />
        </div>
      </div>
    );
  }

  // Calculate transaction totals
  const totalCost = quantity * stockInfo.currentPrice;
  const isAffordable = user ? user.cashBalance >= totalCost : true;

  // Chart styling based on trend
  const priceTrendColor = "#10b981"; // Groww vibrant green

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col">
      {/* Navbar selection based on auth */}
      {token ? <AuthNavbar /> : <GuestNavbar />}

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-24 mb-12 flex-1">
        {/* Back Link */}
        <button
          onClick={() => navigate(token ? "/loggedIn" : "/")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Info notice bar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border border-blue-100 rounded-2xl p-4 text-sm bg-blue-50/50 text-blue-800 mb-8 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <p className="font-medium">You are in paper-simulation trading mode with real-time socket feeds.</p>
          </div>
        </div>

        {/* Main Stock layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Area: Chart and stats details (2 columns on large screen) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Header info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-green-500 text-white flex items-center justify-center rounded-2xl text-xl font-bold shadow-md shadow-green-100">
                  {stockInfo.symbol.slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900">{stockInfo.symbol}</h1>
                  <p className="text-sm text-gray-400 font-semibold">{stockInfo.companyName}</p>
                </div>
              </div>

              <div>
                <p className="text-4xl font-extrabold text-gray-900 tracking-tight">
                  ₹{stockInfo.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 text-green-600 text-xs font-bold mt-1 justify-end">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Sector: {stockInfo.sector}</span>
                </div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-800 text-sm tracking-wide uppercase">Price Trend</h3>
                
                {/* Timeframes */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  {["1m", "5m", "1d"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setIntervalVal(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        interval === t 
                          ? "bg-white text-green-600 shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-72 sm:h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={priceTrendColor} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={priceTrendColor} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: "#94a3b8", fontSize: 10 }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={["auto", "auto"]} 
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: "12px", border: "none" }}
                      labelStyle={{ fontWeight: "bold", fontSize: 11 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke={priceTrendColor} 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Extra Stock Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">Stock Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">Exchange</p>
                  <p className="font-bold text-gray-800 text-sm">{stockInfo.exchange}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">Market Cap</p>
                  <p className="font-bold text-gray-800 text-sm">₹{(stockInfo.marketCap / 10000000).toFixed(2)} Cr</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">Sector</p>
                  <p className="font-bold text-gray-800 text-sm">{stockInfo.sector}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">Total Shares</p>
                  <p className="font-bold text-gray-800 text-sm">{(Number(stockInfo.totalQuantity) / 100000).toFixed(1)} L</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Area: BUY / SELL transaction box */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md sticky top-24">
              
              {/* Tab toggles for Buy / Sell */}
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button
                  onClick={() => {
                    setTradeType("BUY");
                    setTransactionError(null);
                    setTransactionMessage(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg transition-all uppercase ${
                    tradeType === "BUY" 
                      ? "bg-green-500 text-white shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    setTradeType("SELL");
                    setTransactionError(null);
                    setTransactionMessage(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-lg transition-all uppercase ${
                    tradeType === "SELL" 
                      ? "bg-red-500 text-white shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Feedbacks */}
              {transactionMessage && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-100 font-medium">
                  {transactionMessage}
                </div>
              )}
              {transactionError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 font-medium">
                  {transactionError}
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleTransaction} className="space-y-6">
                
                {/* Simulated Cash balance summary */}
                {token && (
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                    <span className="text-gray-400 font-semibold uppercase">Wallet Balance</span>
                    <span className="font-extrabold text-gray-700">
                      ₹{user?.cashBalance?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {/* Shares input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Quantity (Shares)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 text-center font-bold text-gray-800"
                  />
                </div>

                {/* Summary list */}
                <div className="space-y-2 border-t border-gray-100 pt-4 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Market Price</span>
                    <span className="font-bold">₹{stockInfo.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 font-bold text-sm pt-1 border-t border-dashed border-gray-100">
                    <span>Est. {tradeType === "BUY" ? "Cost" : "Gain"}</span>
                    <span className={tradeType === "BUY" ? "text-green-600" : "text-red-500"}>
                      ₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                {token ? (
                  tradeType === "BUY" ? (
                    <button
                      type="submit"
                      disabled={submitting || !isAffordable}
                      className={`w-full text-white font-extrabold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all ${
                        isAffordable 
                          ? "bg-green-500 hover:bg-green-600 cursor-pointer" 
                          : "bg-gray-300 cursor-not-allowed"
                      }`}
                    >
                      {submitting ? "Processing..." : isAffordable ? "BUY SHARES" : "INSUFFICIENT BALANCE"}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      {submitting ? "Processing..." : "SELL SHARES"}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal("login")}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-3.5 rounded-xl transition"
                  >
                    LOGIN TO TRADE
                  </button>
                )}

              </form>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Stock;
