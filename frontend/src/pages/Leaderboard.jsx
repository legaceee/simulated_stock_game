import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import { useModal } from "../../Context/ModalContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import GuestNavbar from "../assets/Component/GuestNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import { Trophy, Award, Search, TrendingUp, DollarSign, BarChart3, User } from "lucide-react";

function Leaderboard() {
  const { user, token } = useAuth();
  const { openModal } = useModal();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:4000/api/v1/users/leaderboard", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLeaderboard(res.data.data.leaderboard || []);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch leaderboard rankings. Please ensure you are logged in.");
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchLeaderboard();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Filter based on search
  const filteredLeaderboard = leaderboard.filter((item) =>
    item.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find current user's rank
  const currentUserRank = leaderboard.find((item) => item.id === user?.id);

  if (!token) {
    return (
      <div className="bg-[#f8fafc] min-h-screen flex flex-col justify-between">
        <GuestNavbar />
        <div className="max-w-md w-full mx-auto text-center px-4 my-auto pt-24 pb-12">
          <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-100">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-extrabold text-gray-800">Locked Feature</h2>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              Log in to view the real-time leaderboard and see how you rank among all active traders.
            </p>
            <button
              onClick={() => openModal("login")}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Sign In to View
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col">
      <AuthNavbar />

      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 mt-28 mb-12 flex-1">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 border border-slate-700/30 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Real-Time
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Trader Leaderboard</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-xl">
              Rankings updated live based on users' current cash balances and the real-time value of their stock portfolios.
            </p>
          </div>

          {currentUserRank && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[200px] flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-green-500 text-slate-900 rounded-xl flex items-center justify-center font-extrabold text-xl shadow-lg shadow-green-500/20">
                #{currentUserRank.rank}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Your Position</p>
                <p className="text-lg font-bold text-white truncate max-w-[130px]">{currentUserRank.username}</p>
                <p className="text-xs text-green-400 font-bold">₹{currentUserRank.netWorth.toLocaleString("en-IN")}</p>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loading text="Loading ranking data..." />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 text-center font-medium my-12">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Search and Filters */}
            <div className="flex bg-white rounded-2xl p-3 shadow-sm border border-gray-100 items-center gap-3">
              <Search className="w-5 h-5 text-gray-400 ml-2" />
              <input
                type="text"
                placeholder="Search traders by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full focus:outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400 font-medium"
              />
            </div>

            {/* Leaderboard Table Container */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="py-4 px-6 text-center">Rank</th>
                      <th className="py-4 px-6">Trader</th>
                      <th className="py-4 px-6 text-right">Net Worth</th>
                      <th className="py-4 px-6 text-right hidden sm:table-cell">Cash Balance</th>
                      <th className="py-4 px-6 text-right hidden sm:table-cell">Stock Portfolio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLeaderboard.map((item) => {
                      const isSelf = item.id === user?.id;
                      const isTop1 = item.rank === 1;
                      const isTop2 = item.rank === 2;
                      const isTop3 = item.rank === 3;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/30 transition-colors ${
                            isSelf ? "bg-green-50/40 hover:bg-green-50/60" : ""
                          }`}
                        >
                          {/* Rank column */}
                          <td className="py-5 px-6 text-center">
                            <div className="flex justify-center items-center">
                              {isTop1 ? (
                                <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-extrabold relative shadow-inner">
                                  <Trophy className="w-4 h-4" />
                                </div>
                              ) : isTop2 ? (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-extrabold relative shadow-inner">
                                  <Award className="w-4 h-4 text-slate-500" />
                                </div>
                              ) : isTop3 ? (
                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold relative shadow-inner">
                                  <Award className="w-4 h-4 text-amber-600" />
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-gray-500">{item.rank}</span>
                              )}
                            </div>
                          </td>

                          {/* Trader name + avatar */}
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3">
                              {item.avatarUrl ? (
                                <img
                                  src={item.avatarUrl}
                                  alt={item.username}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-sm"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner uppercase ${
                                  isSelf 
                                    ? "bg-green-100 text-green-700" 
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {item.username.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-gray-800 flex items-center gap-1.5 text-sm sm:text-base">
                                  {item.username}
                                  {isSelf && (
                                    <span className="bg-green-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                      You
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-gray-400 font-semibold block sm:hidden uppercase">
                                  Cash: ₹{item.cashBalance.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Net worth */}
                          <td className="py-5 px-6 text-right font-mono font-bold text-gray-800 text-sm sm:text-base">
                            ₹{item.netWorth.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Cash Balance */}
                          <td className="py-5 px-6 text-right font-mono text-gray-500 text-xs sm:text-sm hidden sm:table-cell">
                            ₹{item.cashBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          {/* Stock Value */}
                          <td className="py-5 px-6 text-right font-mono text-gray-500 text-xs sm:text-sm hidden sm:table-cell">
                            ₹{item.stockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400 font-medium">
                          No traders found matching "{searchTerm}"
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default Leaderboard;
