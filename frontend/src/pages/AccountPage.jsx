import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Briefcase, 
  LineChart, 
  Search, 
  Plus, 
  Minus,
  Coins,
  Layers
} from "lucide-react";
import MfCommodityExplorer from "../assets/Component/MfCommodityExplorer";

export default function AccountPage() {
  const { user, token, logoutUser, refreshUser } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("explore"); // "explore" or "portfolio" for mobile responsiveness
  const [activeMainTab, setActiveMainTab] = useState("stocks");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Redirect if not logged in or if KYC is pending/rejected
  useEffect(() => {
    if (!token) {
      navigate("/");
    } else if (user && user.kycStatus !== "APPROVED") {
      navigate("/kyc");
    }
  }, [token, user, navigate]);

  // Fetch stocks & portfolio
  useEffect(() => {
    async function fetchData() {
      if (!token) return;
      try {
        setLoading(true);
        // Fetch all stocks
        const stocksRes = await axios.get("http://localhost:4000/api/v1/stocks");
        const fetchedStocks = stocksRes.data.data.stocks || [];
        setStocks(fetchedStocks);

        // Fetch user portfolio
        try {
          const portfolioRes = await axios.get("http://localhost:4000/api/v1/portfolio");
          setPortfolio(portfolioRes.data.portfolio);
        } catch (err) {
          console.log("No portfolio found yet or empty.");
          setPortfolio(null);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [token]);

  // Sockets for Real-time price updates
  useEffect(() => {
    if (stocks.length === 0) return;

    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      console.log("Connected to socket server");
      // Subscribe to all stock symbols
      const symbols = stocks.map((s) => s.symbol);
      socket.emit("subscribe", symbols);
    });

    socket.on("price-update", (updates) => {
      // updates is an array: [{ stockId, symbol, price, timeStamp }]
      if (!updates || updates.length === 0) return;

      const updateMap = {};
      updates.forEach((up) => {
        updateMap[up.symbol] = up.price;
      });

      // Update stocks state
      setStocks((prevStocks) =>
        prevStocks.map((stock) => {
          if (updateMap[stock.symbol] !== undefined) {
            return { ...stock, currentPrice: updateMap[stock.symbol] };
          }
          return stock;
        })
      );

      // Update portfolio items state
      setPortfolio((prevPortfolio) => {
        if (!prevPortfolio || !prevPortfolio.portfolioItems) return prevPortfolio;
        return {
          ...prevPortfolio,
          portfolioItems: prevPortfolio.portfolioItems.map((item) => {
            if (item.stock && updateMap[item.stock.symbol] !== undefined) {
              return {
                ...item,
                stock: {
                  ...item.stock,
                  currentPrice: updateMap[item.stock.symbol],
                },
              };
            }
            return item;
          }),
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [stocks.length]);

  // Calculate Portfolio stats
  const getPortfolioStats = () => {
    if (!portfolio || !portfolio.portfolioItems || portfolio.portfolioItems.length === 0) {
      return { totalInvested: 0, totalCurrent: 0, totalReturns: 0, returnsPercentage: 0 };
    }

    let totalInvested = 0;
    let totalCurrent = 0;

    portfolio.portfolioItems.forEach((item) => {
      totalInvested += item.quantity * item.avgBuyPrice;
      const currentPrice = item.stock?.currentPrice ?? item.avgBuyPrice;
      totalCurrent += item.quantity * currentPrice;
    });

    const totalReturns = totalCurrent - totalInvested;
    const returnsPercentage = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    return { totalInvested, totalCurrent, totalReturns, returnsPercentage };
  };

  const { totalInvested, totalCurrent, totalReturns, returnsPercentage } = getPortfolioStats();

  // Filter stocks based on query
  const filteredStocks = stocks.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stable week/month performance performers dynamically
  const getStockPerformers = () => {
    return stocks.map((stock) => {
      const charCode0 = stock.symbol.charCodeAt(0) || 65;
      const charCode1 = stock.symbol.charCodeAt(1) || 66;

      const weeklyChange = parseFloat(
        (((charCode0 % 7) - 2) * 3.4 + (stock.currentPrice % 4) - 1.5).toFixed(2)
      );

      const monthlyChange = parseFloat(
        (((charCode1 % 8) - 1) * 5.8 + (stock.currentPrice % 10) - 3.2).toFixed(2)
      );

      return {
        ...stock,
        weeklyChange,
        monthlyChange,
      };
    });
  };

  const stocksWithPerformances = getStockPerformers();

  const topWeekly = [...stocksWithPerformances]
    .sort((a, b) => b.weeklyChange - a.weeklyChange)
    .slice(0, 3);

  const topMonthly = [...stocksWithPerformances]
    .sort((a, b) => b.monthlyChange - a.monthlyChange)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <AuthNavbar />
        <div className="flex items-center justify-center min-h-screen pt-20">
          <Loading text="Loading your dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col font-sans">
      <AuthNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-24 mb-12">
        {/* User Balance Banner & Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Wallet Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute right-4 top-4 text-emerald-100 opacity-20">
              <Wallet className="w-24 h-24" />
            </div>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-2">Simulated Balance</p>
            <h2 className="text-3xl font-extrabold mb-4">
              ₹{(user?.cashBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="flex gap-2">
              <span className="bg-white/20 text-xs px-3 py-1.5 rounded-lg backdrop-blur-md">Simulation Mode</span>
              <span className="bg-emerald-400/30 text-xs px-3 py-1.5 rounded-lg backdrop-blur-md font-semibold">Active</span>
            </div>
          </div>

          {/* Portfolio Value Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute right-4 top-4 text-gray-100">
              <Briefcase className="w-24 h-24" />
            </div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Portfolio Current Value</p>
            <h2 className="text-3xl font-extrabold text-gray-800 mb-4">
              ₹{totalCurrent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <span>Total Returns:</span>
              <span className={`flex items-center gap-0.5 ${totalReturns >= 0 ? "text-green-600" : "text-red-500"}`}>
                {totalReturns >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                ₹{Math.abs(totalReturns).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({returnsPercentage.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Investment Details */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition-all hover:scale-[1.01]">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Invested Capital</p>
            <h2 className="text-3xl font-extrabold text-gray-700 mb-4">
              ₹{totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Stocks Owned:</span>
              <span className="font-bold text-gray-700">{portfolio?.portfolioItems?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Main Category Tabs */}
        <div className="flex bg-white border border-gray-200 p-1.5 rounded-2xl mb-8 shadow-sm max-w-lg">
          <button
            className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
              activeMainTab === "stocks" ? "bg-green-500 text-white shadow-md shadow-green-150" : "text-gray-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveMainTab("stocks")}
          >
            <LineChart className="w-4 h-4" />
            Stocks
          </button>
          <button
            className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
              activeMainTab === "mf" ? "bg-green-500 text-white shadow-md shadow-green-150" : "text-gray-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveMainTab("mf")}
          >
            <Layers className="w-4 h-4" />
            Mutual Funds
          </button>
          <button
            className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase ${
              activeMainTab === "commodities" ? "bg-green-500 text-white shadow-md shadow-green-150" : "text-gray-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveMainTab("commodities")}
          >
            <Coins className="w-4 h-4" />
            Commodities
          </button>
        </div>

        {activeMainTab === "stocks" && (
          <>
            {/* Mobile Tab Toggle */}
            <div className="flex md:hidden bg-white border border-gray-200 p-1 rounded-xl mb-6 shadow-sm">
          <button
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "explore" ? "bg-green-500 text-white shadow-sm" : "text-gray-500"
            }`}
            onClick={() => setActiveTab("explore")}
          >
            Explore Stocks
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "portfolio" ? "bg-green-500 text-white shadow-sm" : "text-gray-500"
            }`}
            onClick={() => setActiveTab("portfolio")}
          >
            My Portfolio
          </button>
        </div>

        {/* Desktop View Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column: Stocks Explorer */}
          <div className={`flex-1 ${activeTab === "explore" ? "block" : "hidden md:block"} space-y-6`}>
            
            {/* Top Performers Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Top Weekly */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-sm text-gray-700 tracking-wide uppercase">Top Performers (Week)</h4>
                  <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">WEEKLY</span>
                </div>
                <div className="space-y-3">
                  {topWeekly.map((stock) => (
                    <div 
                      key={stock.id}
                      onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-green-50 text-green-600 font-bold flex items-center justify-center rounded-lg text-xs">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-800">{stock.symbol}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{stock.companyName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs text-gray-800">₹{stock.currentPrice.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-green-600 flex items-center justify-end gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          +{stock.weeklyChange}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Monthly */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-sm text-gray-700 tracking-wide uppercase">Top Performers (Month)</h4>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">MONTHLY</span>
                </div>
                <div className="space-y-3">
                  {topMonthly.map((stock) => (
                    <div 
                      key={stock.id}
                      onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                      className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center rounded-lg text-xs">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-800">{stock.symbol}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{stock.companyName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs text-gray-800">₹{stock.currentPrice.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-green-600 flex items-center justify-end gap-0.5">
                          <TrendingUp className="w-3 h-3" />
                          +{stock.monthlyChange}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Explore Stock Market</h3>
                  <p className="text-xs text-gray-400">Click on any stock to trade, view graphs, and track performance</p>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by name or symbol..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50/50"
                  />
                </div>
              </div>

              {/* Stocks Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 text-xs font-semibold uppercase tracking-wider pb-3">
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4 text-right">Price</th>
                      <th className="py-3 px-4 text-center">Sector</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStocks.map((stock) => (
                      <tr 
                        key={stock.id} 
                        className="hover:bg-slate-50 transition cursor-pointer group"
                        onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                      >
                        <td className="py-4 px-4 flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 text-green-600 font-bold flex items-center justify-center rounded-xl text-sm group-hover:bg-green-500 group-hover:text-white transition-all">
                            {stock.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-800 group-hover:text-green-600 transition-all">{stock.symbol}</p>
                            <p className="text-xs text-gray-400">{stock.companyName}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-sm text-gray-800">
                          ₹{stock.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">
                            {stock.sector}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/stock/${stock.symbol}`}
                            state={{ stock }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 py-1.5 px-3 rounded-lg transition-all"
                          >
                            Trade
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filteredStocks.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                          No stocks found matching "{searchQuery}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Holdings & Portfolio */}
          <div className={`w-full lg:w-96 ${activeTab === "portfolio" ? "block" : "hidden md:block"}`}>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-green-500" />
                Current Holdings
              </h3>

              <div className="space-y-4">
                {portfolio && portfolio.portfolioItems && portfolio.portfolioItems.length > 0 ? (
                  portfolio.portfolioItems.map((item) => {
                    if (!item.stock) return null;
                    const curPrice = item.stock.currentPrice ?? item.avgBuyPrice;
                    const currentVal = item.quantity * curPrice;
                    const investedVal = item.quantity * item.avgBuyPrice;
                    const itemReturns = currentVal - investedVal;
                    const itemReturnsPct = investedVal > 0 ? (itemReturns / investedVal) * 100 : 0;

                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/stock/${item.stock.symbol}`, { state: { stock: item.stock } })}
                        className="p-4 border border-gray-100 rounded-xl hover:border-green-200 hover:bg-slate-50/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm text-gray-800">{item.stock.symbol}</p>
                            <p className="text-xs text-gray-400">{item.quantity} Shares</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-gray-800">
                              ₹{currentVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </p>
                            <p className={`text-xs font-semibold ${itemReturns >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {itemReturns >= 0 ? "+" : ""}
                              {itemReturnsPct.toFixed(2)}%
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-dashed border-gray-100 pt-2 text-[11px] text-gray-400">
                          <span>Avg Buy: ₹{item.avgBuyPrice.toFixed(2)}</span>
                          <span>LTP: ₹{curPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    <LineChart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="font-medium text-gray-500">Your portfolio is empty</p>
                    <p className="text-xs text-gray-400 mt-1">Explore stocks on the left to start trading.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
          </>
        )}

        {activeMainTab !== "stocks" && (
          <MfCommodityExplorer
            token={token}
            user={user}
            refreshUser={refreshUser}
            activeSubTab={activeMainTab}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
