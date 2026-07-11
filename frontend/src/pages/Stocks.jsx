import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import GuestNavbar from "../assets/Component/GuestNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  ArrowRight,
  TrendingUp as GainersIcon,
  TrendingDown as LosersIcon
} from "lucide-react";

export default function Stocks() {
  const { token } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch stocks list
  useEffect(() => {
    async function fetchStocks() {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:4000/api/v1/stocks");
        setStocks(res.data.data.stocks || []);
      } catch (err) {
        console.error("Error fetching stocks list:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStocks();
  }, []);

  // Real-time stock price updates via socket
  useEffect(() => {
    if (stocks.length === 0) return;

    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      const symbols = stocks.map((s) => s.symbol);
      socket.emit("subscribe", symbols);
    });

    socket.on("price-update", (updates) => {
      if (!updates || updates.length === 0) return;

      const updateMap = {};
      updates.forEach((up) => {
        updateMap[up.symbol] = up.price;
      });

      setStocks((prevStocks) =>
        prevStocks.map((stock) => {
          if (updateMap[stock.symbol] !== undefined) {
            return { ...stock, currentPrice: updateMap[stock.symbol] };
          }
          return stock;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [stocks.length]);

  // Compute daily performance metrics dynamically for UI richness
  const getStockPerformers = () => {
    return stocks.map((stock) => {
      const charCode0 = stock.symbol.charCodeAt(0) || 65;
      const charCode1 = stock.symbol.charCodeAt(1) || 66;

      const changePercentage = parseFloat(
        (((charCode0 % 5) - 2) * 1.5 + (stock.currentPrice % 3) - 1.2).toFixed(2)
      );

      return {
        ...stock,
        changePercentage,
      };
    });
  };

  const stocksWithPerformance = getStockPerformers();

  // Filter stocks by query
  const filteredStocks = stocksWithPerformance.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topGainers = [...stocksWithPerformance]
    .sort((a, b) => b.changePercentage - a.changePercentage)
    .filter((s) => s.changePercentage > 0)
    .slice(0, 4);

  const topLosers = [...stocksWithPerformance]
    .sort((a, b) => a.changePercentage - b.changePercentage)
    .filter((s) => s.changePercentage < 0)
    .slice(0, 4);

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col font-sans">
      {token ? <AuthNavbar /> : <GuestNavbar />}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-24 mb-12">
        {/* Market Overview Header */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Market Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100">
              <span className="text-xs text-gray-400 font-semibold block uppercase">Nifty 50</span>
              <span className="text-lg font-extrabold text-gray-800 block mt-1">₹24,320.50</span>
              <span className="text-xs text-green-600 font-bold flex items-center gap-0.5 mt-1">
                <TrendingUp className="w-3.5 h-3.5" /> +0.82%
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100">
              <span className="text-xs text-gray-400 font-semibold block uppercase">Sensex</span>
              <span className="text-lg font-extrabold text-gray-800 block mt-1">₹79,890.30</span>
              <span className="text-xs text-green-600 font-bold flex items-center gap-0.5 mt-1">
                <TrendingUp className="w-3.5 h-3.5" /> +0.76%
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100">
              <span className="text-xs text-gray-400 font-semibold block uppercase">Nifty Bank</span>
              <span className="text-lg font-extrabold text-gray-800 block mt-1">₹52,450.90</span>
              <span className="text-xs text-red-500 font-bold flex items-center gap-0.5 mt-1">
                <TrendingDown className="w-3.5 h-3.5" /> -0.15%
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-gray-100">
              <span className="text-xs text-gray-400 font-semibold block uppercase">Nifty IT</span>
              <span className="text-lg font-extrabold text-gray-800 block mt-1">₹39,120.40</span>
              <span className="text-xs text-green-600 font-bold flex items-center gap-0.5 mt-1">
                <TrendingUp className="w-3.5 h-3.5" /> +1.45%
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loading text="Loading all stocks..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle Columns: Search + Explore */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Search Header */}
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Search Stocks</h3>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">Explore Indian stocks, track prices, and start mock trading</p>
                  </div>
                  {/* Search Input Box */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search name, symbol, or sector..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-72 pl-10 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50/50 transition-all"
                    />
                  </div>
                </div>

                {/* Stocks List Grid */}
                <div className="mt-6 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 text-xs font-semibold uppercase tracking-wider pb-3">
                          <th className="py-3 px-2">Company</th>
                          <th className="py-3 px-2 text-right">Price</th>
                          <th className="py-3 px-2 text-right">Daily Change</th>
                          <th className="py-3 px-2 text-center">Sector</th>
                          <th className="py-3 px-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredStocks.map((stock) => (
                          <tr 
                            key={stock.id} 
                            className="hover:bg-slate-50 transition cursor-pointer group"
                            onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                          >
                            <td className="py-4 px-2 flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-50 text-green-600 font-bold flex items-center justify-center rounded-xl text-sm group-hover:bg-green-500 group-hover:text-white transition-all">
                                {stock.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-gray-800 group-hover:text-green-600 transition-all">{stock.symbol}</p>
                                <p className="text-xs text-gray-400 font-semibold truncate max-w-[150px]">{stock.companyName}</p>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-right font-bold text-sm text-gray-800">
                              ₹{stock.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`py-4 px-2 text-right font-bold text-sm ${stock.changePercentage >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {stock.changePercentage >= 0 ? "+" : ""}{stock.changePercentage}%
                            </td>
                            <td className="py-4 px-2 text-center">
                              <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-semibold">
                                {stock.sector}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <Link
                                to={`/stock/${stock.symbol}`}
                                state={{ stock }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 py-1.5 px-3.5 rounded-xl transition-all"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {filteredStocks.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                              No stocks found matching "{searchQuery}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Gainers & Losers */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Top Gainers */}
              <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-sm text-gray-800 tracking-wide uppercase flex items-center gap-1.5">
                    <GainersIcon className="w-4 h-4 text-green-500" />
                    Top Gainers
                  </h4>
                  <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase">Today</span>
                </div>
                <div className="space-y-3">
                  {topGainers.map((stock) => (
                    <div 
                      key={stock.id}
                      onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-green-50 text-green-600 font-bold flex items-center justify-center rounded-lg text-xs">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-800">{stock.symbol}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px] font-semibold">{stock.companyName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs text-gray-800">₹{stock.currentPrice.toFixed(2)}</p>
                        <p className="text-[10px] font-extrabold text-green-600 flex items-center justify-end gap-0.5">
                          +{stock.changePercentage}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Losers */}
              <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-extrabold text-sm text-gray-800 tracking-wide uppercase flex items-center gap-1.5">
                    <LosersIcon className="w-4 h-4 text-red-500" />
                    Top Losers
                  </h4>
                  <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full uppercase">Today</span>
                </div>
                <div className="space-y-3">
                  {topLosers.map((stock) => (
                    <div 
                      key={stock.id}
                      onClick={() => navigate(`/stock/${stock.symbol}`, { state: { stock } })}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-red-50 text-red-600 font-bold flex items-center justify-center rounded-lg text-xs">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-gray-800">{stock.symbol}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[120px] font-semibold">{stock.companyName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-xs text-gray-800">₹{stock.currentPrice.toFixed(2)}</p>
                        <p className="text-[10px] font-extrabold text-red-500 flex items-center justify-end gap-0.5">
                          {stock.changePercentage}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
