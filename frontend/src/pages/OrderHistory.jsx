import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import {
  ArrowLeft,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";

export default function OrderHistory() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [side, setSide] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Actions states
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Fetch orders from API
  const fetchOrders = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        side,
        status,
        search
      };

      const res = await axios.get("http://localhost:4000/api/v1/stocks/order/my", {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setOrders(res.data.data.orders || []);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.totalCount || 0);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token, page, side, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  // Cancel order execution
  const handleCancelOrder = async (orderId) => {
    if (!token) return;
    if (!confirm("Are you sure you want to cancel this pending order?")) return;

    try {
      setActionError(null);
      setActionSuccess(null);
      
      const res = await axios.post(`http://localhost:4000/api/v1/stocks/order/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActionSuccess(res.data.message || "Order cancelled successfully!");
      fetchOrders(); // Refresh table
    } catch (err) {
      console.error("Error cancelling order:", err);
      setActionError(err.response?.data?.error || "Failed to cancel order.");
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col font-sans">
      <AuthNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-24 mb-12">
        <div className="flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2.5 bg-white border border-gray-150 hover:bg-slate-50 transition rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-700" />
              </button>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800">Order Book</h1>
                <p className="text-xs text-gray-400">Track and manage limit, GTT, target, stop loss, and market orders.</p>
              </div>
            </div>
          </div>

          {/* Feedback alerts */}
          {actionError && (
            <div className="flex items-center gap-2 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-2xl font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="flex items-center gap-2 p-3.5 bg-green-50 border border-green-100 text-green-700 text-xs rounded-2xl font-bold">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Filters Panel */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
              <Filter className="w-4 h-4 text-green-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search & Filter Criteria</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Trade Action</label>
                <select
                  value={side}
                  onChange={(e) => { setSide(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">All Actions</option>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Order Status</label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending / Open</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex flex-col justify-end">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Search Symbol</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search by Symbol (e.g. INFY)..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full border border-gray-150 rounded-xl p-2.5 pl-9 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  </div>
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-950 text-white font-extrabold px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    SEARCH
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Orders List */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            {loading ? (
              <div className="py-20 text-center"><Loading text="Gathering order lists..." /></div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">
                        <th className="pb-3 pl-2">Instrument</th>
                        <th className="pb-3">Placement Date</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Direction</th>
                        <th className="pb-3">Limit / Trigger</th>
                        <th className="pb-3">Executed Qty</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map((order) => {
                        const isBuy = order.side === "BUY";
                        const isPending = order.status === "PENDING" || order.status === "OPEN";
                        const isCompleted = order.status === "COMPLETED";
                        const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";
                        
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4.5 pl-2 font-bold text-slate-800">
                              <div>
                                <p className="font-extrabold">{order.symbol}</p>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{order.assetType}</p>
                              </div>
                            </td>
                            <td className="py-4.5 text-gray-400 font-semibold">{new Date(order.createdAt).toLocaleString()}</td>
                            <td className="py-4.5 font-bold text-slate-600 uppercase">{order.type}</td>
                            <td className="py-4.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase ${
                                isBuy ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {order.side}
                              </span>
                            </td>
                            <td className="py-4.5 font-mono font-bold text-slate-700">
                              {order.limitPrice ? `₹${Number(order.limitPrice).toFixed(2)}` : "-"}
                              {order.triggerPrice ? ` (Trig: ₹${Number(order.triggerPrice).toFixed(2)})` : ""}
                            </td>
                            <td className="py-4.5 font-mono font-bold text-slate-700">
                              {order.filledQty} / {order.qty}
                            </td>
                            <td className="py-4.5">
                              <div className="flex items-center gap-1.5">
                                {isPending && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                                {isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                                {isCancelled && <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                                <span className={`font-extrabold uppercase tracking-wide text-[10px] ${
                                  isPending ? "text-amber-600" : isCompleted ? "text-green-600" : "text-slate-400"
                                }`}>
                                  {order.status}
                                </span>
                              </div>
                            </td>
                            <td className="py-4.5 text-right pr-2">
                              {isPending && (
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="inline-flex items-center gap-1 text-rose-600 hover:text-white font-bold border border-rose-200 hover:bg-rose-500 hover:border-rose-500 px-3 py-1.5 rounded-xl cursor-pointer transition text-[10px] uppercase shadow-sm"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Control */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-50 text-xs">
                  <span className="text-gray-400 font-semibold">Showing {orders.length} of {totalCount} logs</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border border-gray-250 px-3 py-1.5 rounded-xl font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      PREV
                    </button>
                    <span className="flex items-center px-2 font-bold text-slate-700">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border border-gray-250 px-3 py-1.5 rounded-xl font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      NEXT
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 font-medium">
                No orders found in order book.
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
