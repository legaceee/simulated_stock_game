import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import Footer from "../assets/Component/Footer";
import Loading from "../assets/Component/Loader";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Download,
  Calendar,
  Search,
  Filter,
  Eye,
  FileText
} from "lucide-react";

export default function Transactions() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [assetType, setAssetType] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected transaction for details modal
  const [selectedTx, setSelectedTx] = useState(null);

  // Fetch transactions from API
  const fetchTransactions = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        assetType,
        type,
        search,
        startDate,
        endDate
      };

      const res = await axios.get("http://localhost:4000/api/v1/transactions", {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setTransactions(res.data.data || []);
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.totalCount || 0);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token, page, assetType, type, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["ID", "Date", "Asset Type", "Symbol", "Type", "Price", "Quantity", "Total Value", "Brokerage", "Charges", "GST", "PnL", "Description"];
    const rows = transactions.map(t => [
      t.id,
      new Date(t.createdAt).toLocaleString(),
      t.assetType || "STOCK",
      t.symbol || "",
      t.type,
      t.price || "",
      t.quantity || "",
      t.totalValue || "",
      t.brokerage || 0,
      t.charges || 0,
      t.gst || 0,
      t.profitOrLoss || 0,
      t.description || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transactions_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live Invoice Note Generator
  const downloadContractNote = (t) => {
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Contract Note - ${t.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #334155; line-height: 1.5; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #10b981; }
            .title { font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 5px; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 13px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            .table th, .table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            .table th { background-color: #f8fafc; font-weight: 700; color: #475569; }
            .summary { width: 320px; margin-left: auto; font-size: 13px; margin-top: 20px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
            .summary-total { font-weight: bold; border-top: 2px solid #e2e8f0; border-bottom: none; font-size: 15px; color: #0f172a; padding-top: 10px; }
            .footer-note { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 80px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">InvestNow</div>
            <div class="title">Official Trade Confirmation & Contract Note</div>
          </div>
          <div class="invoice-details">
            <div>
              <strong>ISSUED TO:</strong><br/>
              Client Ref ID: ${t.userId}<br/>
              Billing Date: ${new Date(t.createdAt).toLocaleString()}
            </div>
            <div>
              <strong>BROKER DETAILS:</strong><br/>
              InvestNow Securities India Ltd.<br/>
              SEBI Reg No: INZ00049923<br/>
              Contract Ref: CN-${t.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Asset Type</th>
                <th>Symbol / ID</th>
                <th>Action</th>
                <th>Qty</th>
                <th>Avg Execution Price</th>
                <th>Gross Trade Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${t.assetType || "STOCK"}</td>
                <td>${t.symbol || "N/A"}</td>
                <td>${t.type}</td>
                <td>${t.quantity || 1}</td>
                <td>₹${t.price ? t.price.toFixed(2) : t.amount.toFixed(2)}</td>
                <td>₹${t.totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-row"><span>Gross Valuation</span><span>₹${t.totalValue.toFixed(2)}</span></div>
            <div class="summary-row"><span>Brokerage Commission (0.05%)</span><span>₹${(t.brokerage || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Exchange Transaction Charges</span><span>₹${(t.charges || 0).toFixed(2)}</span></div>
            <div class="summary-row"><span>Integrated GST (18%)</span><span>₹${(t.gst || 0).toFixed(2)}</span></div>
            <div class="summary-row summary-total">
              <span>Net Settlement Amount</span>
              <span>₹${(t.totalValue + (t.brokerage || 0) + (t.charges || 0) + (t.gst || 0)).toFixed(2)}</span>
            </div>
          </div>
          <p class="footer-note">
            This is a computer-generated contract note issued by InvestNow and does not require signature. All transactions are settled under regulatory margins of stock exchanges.
          </p>
        </body>
      </html>
    `);
    win.document.close();
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
                <h1 className="text-2xl font-extrabold text-slate-800">Transaction History</h1>
                <p className="text-xs text-gray-400">View and audit ledger entries for all trades and funding transactions.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportCSV}
                disabled={transactions.length === 0}
                className="bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                EXPORT CSV
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-50">
              <Filter className="w-4 h-4 text-green-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search & Filter Criteria</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Asset Group</label>
                <select
                  value={assetType}
                  onChange={(e) => { setAssetType(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">All Assets</option>
                  <option value="STOCK">Stocks</option>
                  <option value="COMMODITY">Commodities</option>
                  <option value="MUTUAL_FUND">Mutual Funds</option>
                  <option value="WALLET">Wallet Transfers</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Transaction Type</label>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="">All Types</option>
                  <option value="BUY">Buy / Invest</option>
                  <option value="SELL">Sell / Redeem</option>
                  <option value="DEPOSIT">Deposit</option>
                  <option value="WITHDRAW">Withdraw</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="w-full border border-gray-150 rounded-xl p-2.5 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by Symbol (e.g. INF, GOLD) or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-gray-150 rounded-xl p-3 pl-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-950 text-white font-extrabold px-6 rounded-xl text-xs transition cursor-pointer"
              >
                APPLY SEARCH
              </button>
            </form>
          </div>

          {/* Transactions List */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            {loading ? (
              <div className="py-20 text-center"><Loading text="Gathering ledger entries..." /></div>
            ) : transactions.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left">
                        <th className="pb-3 pl-2">Details</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Price / Rate</th>
                        <th className="pb-3">Quantity</th>
                        <th className="pb-3">Net Valuation</th>
                        <th className="pb-3 text-right pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {transactions.map((tx) => {
                        const isCredit = tx.type === "SELL" || tx.type === "DEPOSIT";
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4.5 pl-2 font-bold text-slate-800">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isCredit ? "bg-green-50 text-green-600" : "bg-rose-50 text-rose-600"
                                }`}>
                                  {isCredit ? <ArrowDownLeft className="w-4.5 h-4.5" /> : <ArrowUpRight className="w-4.5 h-4.5" />}
                                </div>
                                <div>
                                  <p className="font-extrabold">{tx.symbol || "WALLET"}</p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{tx.assetType || "STOCK"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4.5 text-gray-400 font-semibold">{new Date(tx.createdAt).toLocaleString()}</td>
                            <td className="py-4.5">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase ${
                                isCredit ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-4.5 font-mono font-bold text-slate-700">
                              {tx.price ? `₹${tx.price.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-4.5 font-mono font-bold text-slate-700">
                              {tx.quantity ? tx.quantity.toFixed(3) : "-"}
                            </td>
                            <td className="py-4.5 font-mono font-extrabold text-slate-800">
                              ₹{tx.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-4.5 text-right pr-2 space-x-2">
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 font-bold bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-[10px] uppercase"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Details
                              </button>
                              {tx.assetType !== "WALLET" && (
                                <button
                                  onClick={() => downloadContractNote(tx)}
                                  className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-bold bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-[10px] uppercase"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Note
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
                  <span className="text-gray-400 font-semibold">Showing {transactions.length} of {totalCount} logs</span>
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
                No transactions matched your filter query.
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl p-6 relative overflow-hidden">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 pb-3 border-b border-slate-100">
              Transaction Details
            </h3>

            <div className="space-y-3.5 text-xs text-slate-600 font-medium">
              <div className="flex justify-between">
                <span className="text-gray-400">Transaction ID</span>
                <span className="font-mono font-bold text-slate-800 select-all">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Timestamp</span>
                <span className="text-slate-800">{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Asset Type</span>
                <span className="text-slate-800 font-bold uppercase">{selectedTx.assetType || "STOCK"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Instrument Symbol</span>
                <span className="text-slate-800 font-extrabold">{selectedTx.symbol || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Action / Type</span>
                <span className="font-extrabold uppercase text-slate-800">{selectedTx.type}</span>
              </div>
              
              <div className="border-t border-dashed border-slate-100 my-2 pt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Rate</span>
                  <span className="font-bold text-slate-800">
                    {selectedTx.price ? `₹${selectedTx.price.toFixed(2)}` : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Quantity</span>
                  <span className="font-bold text-slate-800">
                    {selectedTx.quantity ? selectedTx.quantity.toFixed(4) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gross Valuation</span>
                  <span className="font-extrabold text-slate-800">₹{selectedTx.totalValue.toFixed(2)}</span>
                </div>
              </div>

              {selectedTx.assetType !== "WALLET" && (
                <div className="border-t border-slate-100 pt-2.5 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Brokerage Fee</span>
                    <span>₹{(selectedTx.brokerage || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Exchange Charges</span>
                    <span>₹{(selectedTx.charges || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400">Integrated GST (18%)</span>
                    <span>₹{(selectedTx.gst || 0).toFixed(2)}</span>
                  </div>
                  {selectedTx.type === "SELL" && (
                    <div className="flex justify-between text-[11px] pt-1.5 border-t border-slate-50">
                      <span className="text-gray-400">Computed Profit/Loss</span>
                      <span className={`font-bold ${selectedTx.profitOrLoss >= 0 ? "text-green-600" : "text-rose-500"}`}>
                        ₹{(selectedTx.profitOrLoss || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Description</span>
                <p className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[11px] text-slate-700 leading-relaxed font-semibold">
                  {selectedTx.description || "Simulated portfolio ledger transfer."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedTx(null)}
              className="mt-6 w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold py-3 rounded-xl transition text-xs cursor-pointer"
            >
              CLOSE DETAILS
            </button>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}
