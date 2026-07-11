import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { X, ShieldCheck, KeyRound, AlertCircle } from "lucide-react";

function MpinModal({ token, onClose, onSuccess, actionType, stockSymbol, quantity, totalValue }) {
  const [mode, setMode] = useState("checking"); // checking, set, enter
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Enter new PIN, 2: Confirm new PIN (for set mode)

  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const confirmRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Check if user has MPIN set
  useEffect(() => {
    async function checkMpin() {
      try {
        const res = await axios.get("http://localhost:4000/api/v1/users/has-mpin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.data.hasMpin) {
          setMode("enter");
        } else {
          setMode("set");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to verify transaction security setup. Please try again.");
      }
    }
    checkMpin();
  }, [token]);

  // Handle PIN input digit changes
  const handleChange = (index, value, pinState, setPinState, refs) => {
    if (isNaN(Number(value))) return; // only allow numbers

    const newPin = [...pinState];
    newPin[index] = value.slice(-1); // only take the last char
    setPinState(newPin);

    // Auto focus next input
    if (value !== "" && index < 3) {
      refs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e, pinState, refs) => {
    // Focus previous input on backspace
    if (e.key === "Backspace" && pinState[index] === "" && index > 0) {
      refs[index - 1].current.focus();
    }
  };

  // Submit to set a new MPIN
  const handleSetMpin = async () => {
    const pinStr = pin.join("");
    const confirmStr = confirmPin.join("");

    if (pinStr.length < 4 || confirmStr.length < 4) {
      setError("Please fill all 4 digits.");
      return;
    }

    if (pinStr !== confirmStr) {
      setError("PINs do not match. Please try again.");
      setConfirmPin(["", "", "", ""]);
      setStep(1);
      setTimeout(() => pinRefs[0].current.focus(), 100);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(
        "http://localhost:4000/api/v1/users/set-mpin",
        { mpin: pinStr },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // After setting, shift directly to verification / execution
      setMode("enter");
      setPin(["", "", "", ""]);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to set MPIN.");
    } finally {
      setLoading(false);
    }
  };

  // Submit the MPIN to execute the trade
  const handleVerifyMpin = () => {
    const pinStr = pin.join("");
    if (pinStr.length < 4) {
      setError("Please enter your 4-digit MPIN.");
      return;
    }
    onSuccess(pinStr);
  };

  if (mode === "checking") {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
        <p className="text-gray-500 text-sm mt-4 font-semibold">Verifying secure vault...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-100 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-slate-50 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col items-center text-center mt-2">
        <div className="w-12 h-12 bg-green-50 text-green-600 flex items-center justify-center rounded-2xl mb-4 shadow-inner">
          {mode === "set" ? <KeyRound className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>

        <h3 className="text-xl font-extrabold text-slate-800">
          {mode === "set"
            ? step === 1
              ? "Set Transaction MPIN"
              : "Confirm Transaction MPIN"
            : "Confirm Authorized Trade"}
        </h3>
        
        <p className="text-xs text-gray-400 mt-1 max-w-[280px]">
          {mode === "set"
            ? "Create a 4-digit MPIN to secure your future buy and sell executions."
            : `Authorizing your request to ${actionType} ${quantity} share(s) of ${stockSymbol} for ₹${totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-1.5 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 w-full font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-left">{error}</span>
          </div>
        )}

        {/* Pin Input Fields */}
        <div className="flex justify-center gap-4 my-6">
          {mode === "set" && step === 2
            ? confirmPin.map((digit, idx) => (
                <input
                  key={`confirm-${idx}`}
                  ref={confirmRefs[idx]}
                  type="password"
                  value={digit}
                  maxLength={1}
                  onChange={(e) => handleChange(idx, e.target.value, confirmPin, setConfirmPin, confirmRefs)}
                  onKeyDown={(e) => handleKeyDown(idx, e, confirmPin, confirmRefs)}
                  className="w-12 h-12 border border-slate-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all shadow-sm bg-slate-50"
                />
              ))
            : pin.map((digit, idx) => (
                <input
                  key={`pin-${idx}`}
                  ref={pinRefs[idx]}
                  type="password"
                  value={digit}
                  maxLength={1}
                  onChange={(e) => handleChange(idx, e.target.value, pin, setPin, pinRefs)}
                  onKeyDown={(e) => handleKeyDown(idx, e, pin, pinRefs)}
                  className="w-12 h-12 border border-slate-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all shadow-sm bg-slate-50"
                />
              ))}
        </div>

        {/* Action Button */}
        <button
          onClick={
            mode === "set"
              ? step === 1
                ? () => {
                    if (pin.join("").length < 4) {
                      setError("Please fill all 4 digits.");
                      return;
                    }
                    setError(null);
                    setStep(2);
                    setTimeout(() => confirmRefs[0].current.focus(), 100);
                  }
                : handleSetMpin
              : handleVerifyMpin
          }
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer text-sm"
        >
          {loading
            ? "Processing..."
            : mode === "set"
            ? step === 1
              ? "CONTINUE"
              : "CONFIRM & CREATE"
            : "AUTHORIZE & EXECUTE"}
        </button>

        {mode === "set" && step === 2 && (
          <button
            onClick={() => {
              setStep(1);
              setError(null);
            }}
            className="text-xs text-gray-500 hover:text-green-500 mt-3 font-semibold"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}

export default MpinModal;
