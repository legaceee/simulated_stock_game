import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { X, ShieldCheck, KeyRound, AlertCircle, HelpCircle } from "lucide-react";

function MpinModal({ token, onClose, onSuccess, actionType, stockSymbol, quantity, totalValue }) {
  const [mode, setMode] = useState("checking"); // checking, set, enter, forgot
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);
  
  // Forgot MPIN states
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newMpin, setNewMpin] = useState(["", "", "", "", "", ""]);
  const [confirmNewMpin, setConfirmNewMpin] = useState(["", "", "", "", "", ""]);
  
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Enter new PIN, 2: Confirm new PIN

  const pinRefs = Array(6).fill().map(() => useRef(null));
  const confirmRefs = Array(6).fill().map(() => useRef(null));
  const otpRefs = Array(6).fill().map(() => useRef(null));
  const newMpinRefs = Array(6).fill().map(() => useRef(null));
  const confirmNewRefs = Array(6).fill().map(() => useRef(null));

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
    if (value !== "" && index < 5) {
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

    if (pinStr.length < 6 || confirmStr.length < 6) {
      setError("Please fill all 6 digits.");
      return;
    }

    if (pinStr !== confirmStr) {
      setError("PINs do not match. Please try again.");
      setConfirmPin(["", "", "", "", "", ""]);
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
      setMode("enter");
      setPin(["", "", "", "", "", ""]);
      setConfirmPin(["", "", "", "", "", ""]);
      setError(null);
      setStatusMessage("MPIN created successfully! Please re-enter it to authorize transaction.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to set MPIN.");
    } finally {
      setLoading(false);
    }
  };

  // Submit the MPIN to execute the trade
  const handleVerifyMpin = () => {
    const pinStr = pin.join("");
    if (pinStr.length < 6) {
      setError("Please enter your 6-digit MPIN.");
      return;
    }
    onSuccess(pinStr);
  };

  // Forgot MPIN flow start
  const handleForgotMpinClick = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      await axios.post(
        "http://localhost:4000/api/v1/users/forgot-mpin",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMode("forgot");
      setStep(1); // Reset step inside forgot flow
      setOtp(["", "", "", "", "", ""]);
      setNewMpin(["", "", "", "", "", ""]);
      setConfirmNewMpin(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  // Reset MPIN via OTP verification
  const handleResetMpin = async () => {
    const otpStr = otp.join("");
    const newMpinStr = newMpin.join("");
    const confirmNewMpinStr = confirmNewMpin.join("");

    if (otpStr.length < 6) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }
    if (newMpinStr.length < 6 || confirmNewMpinStr.length < 6) {
      setError("Please fill all 6 digits for your new MPIN.");
      return;
    }
    if (newMpinStr !== confirmNewMpinStr) {
      setError("New MPINs do not match.");
      setConfirmNewMpin(["", "", "", "", "", ""]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(
        "http://localhost:4000/api/v1/users/reset-mpin",
        { otp: otpStr, newMpin: newMpinStr },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMode("enter");
      setPin(["", "", "", "", "", ""]);
      setError(null);
      setStatusMessage("MPIN reset successfully! Please log in with your new MPIN.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reset MPIN. Check OTP code.");
    } finally {
      setLoading(false);
    }
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
    <div className="bg-white rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl border border-slate-100 relative text-slate-800">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-slate-50 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col items-center text-center mt-2">
        <div className="w-12 h-12 bg-green-50 text-green-600 flex items-center justify-center rounded-2xl mb-4 shadow-inner">
          {mode === "set" || mode === "forgot" ? <KeyRound className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
        </div>

        <h3 className="text-xl font-extrabold text-slate-800">
          {mode === "set"
            ? step === 1
              ? "Set 6-Digit Transaction MPIN"
              : "Confirm 6-Digit Transaction MPIN"
            : mode === "forgot"
            ? "Reset Transaction MPIN"
            : "Confirm Authorized Action"}
        </h3>
        
        <p className="text-xs text-gray-400 mt-1 max-w-[280px] leading-relaxed">
          {mode === "set"
            ? "Create a 6-digit MPIN to secure all transactions, deposits, and profile changes."
            : mode === "forgot"
            ? "Provide the OTP code sent to your registered email to reset your 6-digit MPIN."
            : `Authorizing: ${actionType} ${quantity || ""} of ${stockSymbol || "asset"} for ₹${(totalValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
        </p>

        {statusMessage && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-100 w-full font-semibold">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-1.5 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-100 w-full font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-left">{error}</span>
          </div>
        )}

        {/* ---------------- mode: SET MPIN ---------------- */}
        {mode === "set" && (
          <div className="w-full">
            <div className="flex justify-center gap-2.5 my-6">
              {step === 1 ? (
                pin.map((digit, idx) => (
                  <input
                    key={`pin-${idx}`}
                    ref={pinRefs[idx]}
                    type="password"
                    value={digit}
                    maxLength={1}
                    onChange={(e) => handleChange(idx, e.target.value, pin, setPin, pinRefs)}
                    onKeyDown={(e) => handleKeyDown(idx, e, pin, pinRefs)}
                    className="w-11 h-11 border border-slate-200 rounded-xl text-center text-lg font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                ))
              ) : (
                confirmPin.map((digit, idx) => (
                  <input
                    key={`confirm-${idx}`}
                    ref={confirmRefs[idx]}
                    type="password"
                    value={digit}
                    maxLength={1}
                    onChange={(e) => handleChange(idx, e.target.value, confirmPin, setConfirmPin, confirmRefs)}
                    onKeyDown={(e) => handleKeyDown(idx, e, confirmPin, confirmRefs)}
                    className="w-11 h-11 border border-slate-200 rounded-xl text-center text-lg font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                ))
              )}
            </div>

            <button
              onClick={
                step === 1
                  ? () => {
                      if (pin.join("").length < 6) {
                        setError("Please enter all 6 digits.");
                        return;
                      }
                      setError(null);
                      setStep(2);
                      setTimeout(() => confirmRefs[0].current.focus(), 100);
                    }
                  : handleSetMpin
              }
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition cursor-pointer text-sm"
            >
              {step === 1 ? "CONTINUE" : "CREATE MPIN"}
            </button>
            
            {step === 2 && (
              <button
                onClick={() => { setStep(1); setError(null); }}
                className="text-xs text-gray-500 hover:text-green-500 mt-3 font-semibold"
              >
                Go Back
              </button>
            )}
          </div>
        )}

        {/* ---------------- mode: ENTER MPIN ---------------- */}
        {mode === "enter" && (
          <div className="w-full">
            <div className="flex justify-center gap-2.5 my-6">
              {pin.map((digit, idx) => (
                <input
                  key={`enter-${idx}`}
                  ref={pinRefs[idx]}
                  type="password"
                  value={digit}
                  maxLength={1}
                  onChange={(e) => handleChange(idx, e.target.value, pin, setPin, pinRefs)}
                  onKeyDown={(e) => handleKeyDown(idx, e, pin, pinRefs)}
                  className="w-11 h-11 border border-slate-200 rounded-xl text-center text-lg font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyMpin}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer text-sm"
            >
              {loading ? "Processing..." : "CONFIRM TRANSACTION"}
            </button>

            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={handleForgotMpinClick}
                className="text-xs text-slate-500 hover:text-green-600 font-bold flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Forgot MPIN?
              </button>
            </div>
          </div>
        )}

        {/* ---------------- mode: FORGOT MPIN FLOW ---------------- */}
        {mode === "forgot" && (
          <div className="w-full space-y-4 mt-4 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email Verification OTP</label>
              <div className="flex justify-between gap-1.5">
                {otp.map((digit, idx) => (
                  <input
                    key={`otp-${idx}`}
                    ref={otpRefs[idx]}
                    type="text"
                    value={digit}
                    maxLength={1}
                    onChange={(e) => handleChange(idx, e.target.value, otp, setOtp, otpRefs)}
                    onKeyDown={(e) => handleKeyDown(idx, e, otp, otpRefs)}
                    className="w-9 h-9 border border-slate-200 rounded-lg text-center text-sm font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">New 6-Digit MPIN</label>
              <div className="flex justify-between gap-1.5">
                {newMpin.map((digit, idx) => (
                  <input
                    key={`newMpin-${idx}`}
                    ref={newMpinRefs[idx]}
                    type="password"
                    value={digit}
                    maxLength={1}
                    onChange={(e) => handleChange(idx, e.target.value, newMpin, setNewMpin, newMpinRefs)}
                    onKeyDown={(e) => handleKeyDown(idx, e, newMpin, newMpinRefs)}
                    className="w-9 h-9 border border-slate-200 rounded-lg text-center text-sm font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Confirm New 6-Digit MPIN</label>
              <div className="flex justify-between gap-1.5">
                {confirmNewMpin.map((digit, idx) => (
                  <input
                    key={`confirmNewMpin-${idx}`}
                    ref={confirmNewRefs[idx]}
                    type="password"
                    value={digit}
                    maxLength={1}
                    onChange={(e) => handleChange(idx, e.target.value, confirmNewMpin, setConfirmNewMpin, confirmNewRefs)}
                    onKeyDown={(e) => handleKeyDown(idx, e, confirmNewMpin, confirmNewRefs)}
                    className="w-9 h-9 border border-slate-200 rounded-lg text-center text-sm font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleResetMpin}
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-3.5 rounded-xl transition cursor-pointer text-xs mt-4"
            >
              {loading ? "Resetting MPIN..." : "VERIFY & RESET MPIN"}
            </button>

            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={() => { setMode("enter"); setError(null); }}
                className="text-xs text-gray-500 hover:text-green-500 font-semibold"
              >
                Back to Authentication
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default MpinModal;
