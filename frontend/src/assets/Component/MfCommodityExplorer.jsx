import { useState, useEffect } from "react";
import axios from "axios";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Layers,
  Coins,
  ShieldCheck,
  Calendar,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Calculator
} from "lucide-react";
import MpinModal from "./MpinModal";
import { io } from "socket.io-client";

export default function MfCommodityExplorer({ token, user, refreshUser, activeSubTab }) {
  // Mutual Funds States
  const [funds, setFunds] = useState([]);
  const [mfHoldings, setMfHoldings] = useState(null);
  const [sips, setSips] = useState([]);
  const [selectedFund, setSelectedFund] = useState(null);
  const [investAmount, setInvestAmount] = useState(5000);
  const [sipFrequency, setSipFrequency] = useState("MONTHLY");
  const [mfCategory, setMfCategory] = useState("ALL");
  const [mfMode, setMfMode] = useState("BUY_LUMPSUM"); // BUY_LUMPSUM, BUY_SIP

  // Commodities States
  const [commodities, setCommodities] = useState([]);
  const [commHoldings, setCommHoldings] = useState(null);
  const [selectedComm, setSelectedComm] = useState(null);
  const [commQty, setCommQty] = useState(1);
  const [commAction, setCommAction] = useState("BUY"); // BUY, SELL

  // Security modals
  const [showMpinModal, setShowMpinModal] = useState(false);
  const [securityContext, setSecurityContext] = useState(null); // { type, asset }

  // Status & Feedback
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // SIP Calculator State
  const [calcAmount, setCalcAmount] = useState(5000);
  const [calcDuration, setCalcDuration] = useState(5);
  const [calcRate, setCalcRate] = useState(15);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  // Subscribe to live commodity prices
  useEffect(() => {
    if (activeSubTab !== "commodities" || commodities.length === 0) return;

    const socket = io("http://localhost:4000");

    socket.on("connect", () => {
      const symbols = commodities.map(c => c.symbol);
      socket.emit("subscribe", symbols);
    });

    socket.on("price-update", (updates) => {
      if (!updates || updates.length === 0) return;
      
      setCommodities((prev) => {
        return prev.map(comm => {
          const match = updates.find(u => u.symbol === comm.symbol);
          if (match) {
            return { ...comm, currentPrice: match.price };
          }
          return comm;
        });
      });

      setSelectedComm((prevSelected) => {
        if (!prevSelected) return prevSelected;
        const match = updates.find(u => u.symbol === prevSelected.symbol);
        if (match) {
          return { ...prevSelected, currentPrice: match.price };
        }
        return prevSelected;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [activeSubTab, commodities.length]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (activeSubTab === "mf") {
        // Fetch funds
        const fundsRes = await axios.get("http://localhost:4000/api/v1/mf", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFunds(fundsRes.data.data.funds || []);

        // Fetch holdings
        const holdingsRes = await axios.get("http://localhost:4000/api/v1/mf/holdings", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMfHoldings(holdingsRes.data.data);

        // Fetch active SIPs
        const sipsRes = await axios.get("http://localhost:4000/api/v1/mf/sips", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSips(sipsRes.data.data.sips || []);
      } else if (activeSubTab === "commodities") {
        // Fetch commodities
        const commRes = await axios.get("http://localhost:4000/api/v1/commodity", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCommodities(commRes.data.data.commodities || []);

        // Fetch holdings
        const holdingsRes = await axios.get("http://localhost:4000/api/v1/commodity/holdings", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCommHoldings(holdingsRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch investment details. Please verify your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger MPIN validation modal
  const handleMfSubmit = (e) => {
    e.preventDefault();
    if (!selectedFund) return;
    if (investAmount <= 0) {
      setError("Please enter a valid investment amount.");
      return;
    }
    setError(null);
    setSecurityContext({
      type: mfMode === "BUY_LUMPSUM" ? "mf_lumpsum" : "mf_sip",
      asset: selectedFund
    });
    setShowMpinModal(true);
  };

  const handleCommSubmit = (e) => {
    e.preventDefault();
    if (!selectedComm) return;
    if (commQty <= 0) {
      setError("Please enter a valid quantity.");
      return;
    }
    setError(null);
    setSecurityContext({
      type: commAction === "BUY" ? "commodity_buy" : "commodity_sell",
      asset: selectedComm
    });
    setShowMpinModal(true);
  };

  // Execution call on MPIN validation success
  const handleMpinSuccess = async (mpin) => {
    setShowMpinModal(false);
    setError(null);
    setMessage(null);

    const ctx = securityContext;
    if (!ctx) return;

    try {
      if (ctx.type === "mf_lumpsum") {
        const res = await axios.post(
          "http://localhost:4000/api/v1/mf/lumpsum",
          { fundId: ctx.asset.id, amount: investAmount, mpin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage(res.data.message);
        setSelectedFund(null);
      } else if (ctx.type === "mf_sip") {
        const res = await axios.post(
          "http://localhost:4000/api/v1/mf/sip",
          { fundId: ctx.asset.id, amount: investAmount, frequency: sipFrequency, mpin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage(res.data.message);
        setSelectedFund(null);
      } else if (ctx.type === "mf_redeem") {
        const res = await axios.post(
          "http://localhost:4000/api/v1/mf/redeem",
          { fundId: ctx.asset.id, units: ctx.asset.units, mpin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage(res.data.message);
        setSelectedFund(null);
      } else if (ctx.type === "commodity_buy") {
        const res = await axios.post(
          "http://localhost:4000/api/v1/commodity/buy",
          { commodityId: ctx.asset.id, quantity: commQty, mpin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage(res.data.message);
        setSelectedComm(null);
      } else if (ctx.type === "commodity_sell") {
        const res = await axios.post(
          "http://localhost:4000/api/v1/commodity/sell",
          { commodityId: ctx.asset.id, quantity: commQty, mpin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessage(res.data.message);
        setSelectedComm(null);
      }

      await refreshUser();
      fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Transaction execution failed.");
    }
  };

  // Cancel SIP
  const handleCancelSip = async (sipId) => {
    if (!window.confirm("Are you sure you want to cancel this SIP plan?")) return;
    try {
      await axios.post(
        `http://localhost:4000/api/v1/mf/sip/${sipId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("SIP plan cancelled successfully.");
      fetchData();
    } catch (err) {
      setError("Failed to cancel SIP plan.");
    }
  };

  // Calculate SIP returns formula
  const getSipCalcResult = () => {
    const monthlyRate = calcRate / 12 / 100;
    const months = calcDuration * 12;
    const invested = calcAmount * months;
    
    // Future value of SIP formula
    const futureValue = calcAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    const returns = futureValue - invested;
    return { invested, estReturns: returns, totalValue: futureValue };
  };

  const { invested, estReturns, totalValue } = getSipCalcResult();

  // Filter mutual funds by category
  const filteredFunds = funds.filter(f => mfCategory === "ALL" || f.category === mfCategory);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {message && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl text-xs font-semibold">
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-100 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* ---------------- MUTUAL FUNDS VIEW ---------------- */}
      {activeSubTab === "mf" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main MF list */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Category Filter Pills */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex gap-2 flex-wrap">
              {["ALL", "EQUITY", "DEBT", "HYBRID", "ELSS"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMfCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    mfCategory === cat 
                      ? "bg-green-500 text-white shadow-sm shadow-green-100" 
                      : "bg-slate-50 text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Funds List */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-green-500" />
                Explore Mutual Funds
              </h3>
              
              <div className="space-y-4">
                {filteredFunds.map((fund) => (
                  <div
                    key={fund.id}
                    onClick={() => {
                      setSelectedFund(fund);
                      setError(null);
                      setMessage(null);
                    }}
                    className={`p-4 border rounded-2xl hover:border-green-300 transition-all cursor-pointer flex justify-between items-center ${
                      selectedFund?.id === fund.id ? "border-green-500 bg-slate-50/50" : "border-slate-100"
                    }`}
                  >
                    <div>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase mr-2">
                        {fund.category}
                      </span>
                      <h4 className="font-bold text-sm text-slate-800 mt-1.5">{fund.name}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">NAV: ₹{fund.nav.toFixed(2)}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-semibold mb-0.5">3Y Annualised Returns</p>
                      <span className="text-xs font-bold text-green-600 flex items-center justify-end gap-0.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {fund.returns3y}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SIP Returns Calculator Widget */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Calculator className="w-4.5 h-4.5 text-green-500" />
                Mutual Fund SIP Calculator
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Monthly SIP Amount</label>
                  <input
                    type="number"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Math.max(500, parseInt(e.target.value) || 500))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Return Rate (% p.a.)</label>
                  <input
                    type="number"
                    value={calcRate}
                    onChange={(e) => setCalcRate(Math.max(1, parseFloat(e.target.value) || 12))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Duration (Years)</label>
                  <input
                    type="number"
                    value={calcDuration}
                    onChange={(e) => setCalcDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-1">Total Invested</p>
                  <p className="font-extrabold text-slate-700 text-sm">₹{invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-1">Est. Returns</p>
                  <p className="font-extrabold text-green-600 text-sm">₹{estReturns.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold mb-1">Total Value</p>
                  <p className="font-extrabold text-slate-800 text-sm">₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Side panel: Buy Widget & Active holdings */}
          <div className="space-y-6">
            
            {/* MF Lumpsum / SIP Investment Widget */}
            {selectedFund && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase">Invest in Fund</h4>
                  <button onClick={() => setSelectedFund(null)} className="text-xs text-gray-400 hover:text-slate-600">Cancel</button>
                </div>

                <p className="font-bold text-xs text-slate-600 mb-1">{selectedFund.name}</p>
                <p className="text-[10px] text-slate-400 mb-4">NAV: ₹{selectedFund.nav.toFixed(2)}</p>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold text-center">
                  <button
                    onClick={() => setMfMode("BUY_LUMPSUM")}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      mfMode === "BUY_LUMPSUM" ? "bg-white text-slate-850 shadow-sm" : "text-gray-400"
                    }`}
                  >
                    Lumpsum
                  </button>
                  <button
                    onClick={() => setMfMode("BUY_SIP")}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      mfMode === "BUY_SIP" ? "bg-white text-slate-850 shadow-sm" : "text-gray-400"
                    }`}
                  >
                    SIP Plan
                  </button>
                </div>

                <form onSubmit={handleMfSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Investment Amount</label>
                    <input
                      type="number"
                      value={investAmount}
                      onChange={(e) => setInvestAmount(Math.max(500, parseInt(e.target.value) || 500))}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold"
                    />
                  </div>

                  {mfMode === "BUY_SIP" && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">SIP Frequency</label>
                      <select
                        value={sipFrequency}
                        onChange={(e) => setSipFrequency(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold text-slate-700"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                  )}

                  {user && user.kycStatus === "APPROVED" ? (
                    <button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer text-sm shadow-md"
                    >
                      {mfMode === "BUY_LUMPSUM" ? "INVEST LUMPSUM" : "ESTABLISH SIP PLAN"}
                    </button>
                  ) : (
                    <div className="w-full text-center p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl space-y-2">
                      <p>Complete and verify your KYC to start investing.</p>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* MF Holdings Summary */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-green-500" />
                Mutual Fund Holdings
              </h3>

              {mfHoldings && mfHoldings.holdings.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold mb-0.5">Holdings Current Value</p>
                      <p className="font-extrabold text-slate-700 text-sm">₹{mfHoldings.summary.totalCurrentValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 font-semibold mb-0.5">Total Returns</p>
                      <span className={`font-bold flex items-center gap-0.5 justify-end ${mfHoldings.summary.totalReturns >= 0 ? "text-green-600" : "text-rose-500"}`}>
                        {mfHoldings.summary.totalReturns >= 0 ? "+" : ""}
                        ₹{mfHoldings.summary.totalReturns.toFixed(2)} ({mfHoldings.summary.totalReturnsPercentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {mfHoldings.holdings.map((hold) => (
                      <div key={hold.id} className="p-3 border border-slate-100 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-800">{hold.name}</p>
                          <p className="font-bold text-slate-700">₹{hold.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Units: {hold.units.toFixed(3)} | Avg NAV: ₹{hold.avgNav.toFixed(2)}</span>
                          <span className={hold.returns >= 0 ? "text-green-600 font-bold" : "text-rose-500 font-bold"}>
                            {hold.returns >= 0 ? "+" : ""}
                            {hold.returnsPercentage.toFixed(2)}%
                          </span>
                        </div>
                        {user && user.kycStatus === "APPROVED" && (
                          <div className="flex justify-end pt-1 border-t border-slate-50">
                            <button
                              type="button"
                              onClick={() => {
                                const redeemAmt = prompt(`Enter units to redeem (Max ${hold.units.toFixed(4)}):`);
                                const val = parseFloat(redeemAmt);
                                if (!isNaN(val) && val > 0 && val <= hold.units) {
                                  setSecurityContext({
                                    type: "mf_redeem",
                                    asset: { id: hold.fundId, name: hold.name, units: val }
                                  });
                                  setShowMpinModal(true);
                                } else if (redeemAmt !== null) {
                                  alert("Invalid quantity of units entered.");
                                }
                              }}
                              className="text-amber-600 hover:text-amber-700 font-extrabold text-[10px] uppercase cursor-pointer"
                            >
                              Redeem Units
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-gray-400 font-medium">You don't own any mutual funds yet.</div>
              )}
            </div>

            {/* Active SIP Plans */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-green-500" />
                Active SIP Plans
              </h3>

              {sips.length > 0 ? (
                <div className="space-y-3">
                  {sips.map((sip) => (
                    <div key={sip.id} className="p-3 border border-slate-100 rounded-xl text-xs space-y-2 relative">
                      <div>
                        <p className="font-bold text-slate-800 pr-12">{sip.fund.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">₹{sip.amount} | {sip.frequency.toLowerCase()} frequency</p>
                      </div>

                      <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-dashed border-slate-100">
                        <span className="text-slate-400 font-medium">Next run: {new Date(sip.nextDate).toLocaleDateString()}</span>
                        {sip.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleCancelSip(sip.id)}
                            className="text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                          >
                            Cancel Plan
                          </button>
                        ) : (
                          <span className="text-slate-400 font-bold uppercase">{sip.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-gray-400 font-medium">No active SIP schedules.</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ---------------- COMMODITIES VIEW ---------------- */}
      {activeSubTab === "commodities" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Commodities List */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Coins className="w-4.5 h-4.5 text-green-500" />
                Commodities Live Market
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {commodities.map((comm) => (
                  <div
                    key={comm.id}
                    onClick={() => {
                      setSelectedComm(comm);
                      setCommQty(1);
                      setError(null);
                      setMessage(null);
                    }}
                    className={`p-5 border rounded-2xl hover:border-green-300 transition-all cursor-pointer flex justify-between items-center ${
                      selectedComm?.id === comm.id ? "border-green-500 bg-slate-50/50" : "border-slate-100"
                    }`}
                  >
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-850">{comm.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Unit: {comm.unit}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">₹{comm.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <span className="text-[9px] bg-green-50 text-green-600 font-bold px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
                        LIVE FEED
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commodity Holdings */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-1.5">
                <Coins className="w-4.5 h-4.5 text-green-500" />
                Commodity Portfolio Holdings
              </h3>

              {commHoldings && commHoldings.holdings.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold mb-0.5">Portfolio Value</p>
                      <p className="font-extrabold text-slate-700 text-sm">₹{commHoldings.summary.totalCurrentValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 font-semibold mb-0.5">Net Returns</p>
                      <span className={`font-bold flex items-center gap-0.5 justify-end ${commHoldings.summary.totalReturns >= 0 ? "text-green-600" : "text-rose-500"}`}>
                        {commHoldings.summary.totalReturns >= 0 ? "+" : ""}
                        ₹{commHoldings.summary.totalReturns.toFixed(2)} ({commHoldings.summary.totalReturnsPercentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {commHoldings.holdings.map((hold) => (
                      <div key={hold.id} className="p-4 border border-slate-100 rounded-2xl text-xs flex justify-between items-center">
                        <div>
                          <p className="font-extrabold text-slate-800">{hold.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Holdings: {hold.quantity} {hold.unit} | Avg price: ₹{hold.avgBuyPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">₹{hold.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                          <span className={`text-[10px] font-bold ${hold.returns >= 0 ? "text-green-600" : "text-rose-500"}`}>
                            {hold.returns >= 0 ? "+" : ""}
                            {hold.returnsPercentage.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-gray-400 font-medium">You don't own any physical commodities in your vault.</div>
              )}
            </div>

          </div>

          {/* Trade panel */}
          <div>
            {selectedComm ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md sticky top-24">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase">Trade Commodity</h4>
                  <button onClick={() => setSelectedComm(null)} className="text-xs text-gray-400 hover:text-slate-600">Close</button>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-6 text-xs font-bold text-center">
                  <button
                    onClick={() => { setCommAction("BUY"); setError(null); }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      commAction === "BUY" ? "bg-green-500 text-white shadow-sm" : "text-gray-500"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => { setCommAction("SELL"); setError(null); }}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      commAction === "SELL" ? "bg-red-500 text-white shadow-sm" : "text-gray-500"
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <h4 className="font-extrabold text-sm text-slate-800 mb-1">{selectedComm.name}</h4>
                <p className="text-[10px] text-slate-400 mb-4">Price per unit: ₹{selectedComm.currentPrice.toFixed(2)}</p>

                <form onSubmit={handleCommSubmit} className="space-y-5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">
                      Quantity ({selectedComm.unit.replace("per ", "")})
                    </label>
                    <input
                      type="number"
                      step={selectedComm.symbol === "GOLD" || selectedComm.symbol === "SILVER" ? 0.01 : 1}
                      min={0.01}
                      value={commQty}
                      onChange={(e) => setCommQty(Math.max(0.01, parseFloat(e.target.value) || 1))}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Rate</span>
                      <span className="font-bold">₹{selectedComm.currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold text-sm pt-1 border-t border-dashed border-slate-100">
                      <span>Total Value</span>
                      <span className={commAction === "BUY" ? "text-green-600" : "text-rose-500"}>
                        ₹{(commQty * selectedComm.currentPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {user && user.kycStatus === "APPROVED" ? (
                    <button
                      type="submit"
                      className={`w-full text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer text-sm shadow-md ${
                        commAction === "BUY" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      {commAction === "BUY" ? "EXECUTE PURCHASE" : "EXECUTE SELL"}
                    </button>
                  ) : (
                    <div className="w-full text-center p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl space-y-2">
                      <p>Complete and verify your KYC to start investing.</p>
                    </div>
                  )}
                </form>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center text-xs text-slate-400 py-16 font-medium">
                Select a commodity on the left to start trading.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MPIN Verification Modal */}
      {showMpinModal && securityContext && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <MpinModal
            token={token}
            actionType={securityContext.type === "mf_lumpsum" ? "invest lumpsum" : securityContext.type === "mf_sip" ? "establish sip" : securityContext.type === "commodity_buy" ? "buy commodity" : "sell commodity"}
            stockSymbol={securityContext.asset.symbol}
            quantity={securityContext.type.startsWith("mf") ? `${investAmount} INR` : `${commQty} units`}
            totalValue={securityContext.type.startsWith("mf") ? investAmount : (commQty * securityContext.asset.currentPrice)}
            onClose={() => setShowMpinModal(false)}
            onSuccess={handleMpinSuccess}
          />
        </div>
      )}

    </div>
  );
}
