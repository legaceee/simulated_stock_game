import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../Context/AuthContext";
import AuthNavbar from "../assets/Component/AuthNavbar";
import Footer from "../assets/Component/Footer";
import {
  FileText,
  Camera,
  Edit3,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  KeyRound,
  ArrowRight,
  ArrowLeft
} from "lucide-react";

export default function KycFlow() {
  const { user, token, refreshUser } = useAuth();
  const [step, setStep] = useState(1); // 1: Details, 2: Selfie, 3: Signature, 4: MPIN, 5: Success
  const navigate = useNavigate();

  // Step 1: Details
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [address, setAddress] = useState("");
  
  // Step 2: Selfie Mockup
  const [selfie, setSelfie] = useState(null);
  
  // Step 3: Signature Draw Pad Mockup
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Step 4: 6-Digit MPIN
  const [mpin, setMpin] = useState(["", "", "", "", "", ""]);
  const [confirmMpin, setConfirmMpin] = useState(["", "", "", "", "", ""]);
  const mpinRefs = Array(6).fill().map(() => useRef(null));
  const confirmRefs = Array(6).fill().map(() => useRef(null));

  // Error & Status
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate("/");
    }
  }, [token, navigate]);

  // Sync step with KYC Status
  useEffect(() => {
    if (user) {
      if (user.kycStatus === "PENDING") {
        setStep(6);
      } else if (user.kycStatus === "REJECTED") {
        setStep(7);
      } else if (user.kycStatus === "APPROVED") {
        if (user.mpin) {
          setStep(5);
        } else {
          setStep(4);
        }
      }
    }
  }, [user]);

  // Handle drawing on signature canvas
  useEffect(() => {
    if (step === 3 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
    }
  }, [step]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // MPIN digits helper
  const handleMpinChange = (index, value, state, setState, refs) => {
    if (isNaN(Number(value))) return;
    const newPin = [...state];
    newPin[index] = value.slice(-1);
    setState(newPin);

    if (value !== "" && index < 5) {
      refs[index + 1].current.focus();
    }
  };

  const handleMpinKeyDown = (index, e, state, refs) => {
    if (e.key === "Backspace" && state[index] === "" && index > 0) {
      refs[index - 1].current.focus();
    }
  };

  // Submit KYC & Details
  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
      setError("Please enter a valid 10-character PAN number (e.g. ABCDE1234F).");
      return;
    }
    if (!/^\d{12}$/.test(aadhaar)) {
      setError("Please enter a valid 12-digit Aadhaar card number.");
      return;
    }
    if (address.trim().length < 10) {
      setError("Please provide a complete address (minimum 10 characters).");
      return;
    }
    setError(null);
    setStep(2);
  };

  // Capture Selfie Mockup
  const handleSelfieSelect = () => {
    setSelfie("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250&h=250");
    setError(null);
  };

  // Submit Selfie & proceed
  const handleSelfieSubmit = () => {
    if (!selfie) {
      setError("Please upload/capture your selfie to verify identity.");
      return;
    }
    setError(null);
    setStep(3);
  };

  // Submit KYC data to backend
  const handleKycSubmit = async () => {
    if (!hasSignature) {
      setError("Please draw your signature to execute legal declaration.");
      return;
    }
    setLoading(true);
    setError(null);

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas.toDataURL("image/png");

    try {
      // Post to upload endpoint
      await axios.post(
        "http://localhost:4000/api/v1/kyc/upload",
        {
          pan: pan.toUpperCase(),
          aadhaar,
          address,
          selfieUrl: selfie,
          signatureUrl: signatureDataUrl,
          autoApprove: true, // auto approve in sandbox
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      await refreshUser(); // update kycStatus in client
      setStep(4);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "KYC submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Create hashed MPIN
  const handleCreateMpin = async () => {
    const pinStr = mpin.join("");
    const confirmStr = confirmMpin.join("");

    if (pinStr.length < 6 || confirmStr.length < 6) {
      setError("Please enter all 6 digits of the MPIN.");
      return;
    }

    if (pinStr !== confirmStr) {
      setError("MPINs do not match. Please try again.");
      setConfirmMpin(["", "", "", "", "", ""]);
      setTimeout(() => confirmRefs[0].current.focus(), 100);
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
      
      await refreshUser(); // sync context
      setStep(5);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to set MPIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex flex-col font-sans">
      <AuthNavbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 mt-28 mb-12 flex flex-col justify-center">
        
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-8 px-4 text-xs font-semibold text-gray-400">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-green-600" : ""}`}>
            <span className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] ${step >= 1 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>1</span>
            Details
          </div>
          <div className="h-px bg-gray-200 flex-1 mx-2"></div>
          <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-green-600" : ""}`}>
            <span className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] ${step >= 2 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>2</span>
            Selfie
          </div>
          <div className="h-px bg-gray-200 flex-1 mx-2"></div>
          <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-green-600" : ""}`}>
            <span className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] ${step >= 3 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>3</span>
            Signature
          </div>
          <div className="h-px bg-gray-200 flex-1 mx-2"></div>
          <div className={`flex items-center gap-1.5 ${step >= 4 ? "text-green-600" : ""}`}>
            <span className={`w-5 h-5 flex items-center justify-center rounded-full border text-[10px] ${step >= 4 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>4</span>
            MPIN
          </div>
        </div>

        {/* Card Box */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-green-500/5 rounded-full blur-xl"></div>
          
          {error && (
            <div className="mb-6 flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-2xl font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Details */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">KYC Verification</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Provide your personal identification numbers. This information is strictly encrypted and used solely for broker regulatory verification.
              </p>

              <form onSubmit={handleDetailsSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">PAN Card Number</label>
                  <input
                    type="text"
                    placeholder="Enter 10-digit PAN (e.g. ABCDE1234F)"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-mono tracking-wider"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Aadhaar Card Number</label>
                  <input
                    type="text"
                    placeholder="Enter 12-digit Aadhaar card number"
                    maxLength={12}
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-mono tracking-wider"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Permanent Address</label>
                  <textarea
                    placeholder="Enter your registered permanent residential address..."
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 leading-normal"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer text-sm"
                >
                  CONTINUE TO SELFIE VERIFICATION
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: Selfie */}
          {step === 2 && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 mb-2 w-full">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Liveness verification (Selfie)</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed w-full">
                Take a portrait photo of yourself under proper lighting conditions. No sunglasses, hats, or masks.
              </p>

              <div className="w-56 h-56 bg-slate-50 border border-dashed border-slate-200 rounded-full flex items-center justify-center overflow-hidden mb-6 relative group">
                {selfie ? (
                  <img src={selfie} alt="Selfie preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-[10px] text-gray-400 font-semibold">Simulate Liveness Camera</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 w-full mb-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                
                <button
                  onClick={handleSelfieSelect}
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl text-xs font-bold hover:bg-slate-900 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  {selfie ? "RETAKE PORTRAIT" : "CAPTURE SELFIE"}
                </button>
              </div>

              <button
                onClick={handleSelfieSubmit}
                disabled={!selfie}
                className={`w-full flex items-center justify-center gap-1.5 font-extrabold py-3.5 rounded-xl transition text-sm ${
                  selfie ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                PROCEED TO SIGNATURE
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 3: Signature */}
          {step === 3 && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 mb-2 w-full">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Draw Legal Signature</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed w-full">
                Draw your signature on the screen using your mouse, trackpad, or finger. This is required for account activation.
              </p>

              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl cursor-crosshair mb-2 touch-none"
              ></canvas>

              <div className="w-full flex justify-between items-center mb-6">
                <button
                  onClick={clearCanvas}
                  className="text-xs text-rose-500 hover:text-rose-600 font-bold"
                >
                  Clear Draw Pad
                </button>
                <span className="text-[10px] text-gray-400 font-semibold">Draw inside the light box</span>
              </div>

              <div className="flex gap-4 w-full mb-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleKycSubmit}
                  disabled={loading || !hasSignature}
                  className={`flex-1 flex items-center justify-center gap-1.5 font-extrabold py-3 rounded-xl transition text-xs ${
                    hasSignature && !loading
                      ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Submitting..." : "SUBMIT KYC DETAILS"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: MPIN Creation */}
          {step === 4 && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 mb-2 w-full">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">Create Transaction MPIN</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed w-full">
                Your KYC is approved! Now, create a 6-digit MPIN. This MPIN will be required to authenticate all future trades, deposits, and withdrawals.
              </p>

              {/* Enter Pin */}
              <div className="w-full text-left mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">
                  Create 6-Digit MPIN
                </label>
                <div className="flex justify-center gap-3">
                  {mpin.map((digit, idx) => (
                    <input
                      key={`mpin-${idx}`}
                      ref={mpinRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleMpinChange(idx, e.target.value, mpin, setMpin, mpinRefs)}
                      onKeyDown={(e) => handleMpinKeyDown(idx, e, mpin, mpinRefs)}
                      className="w-11 h-11 border border-slate-200 rounded-xl text-center text-lg font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  ))}
                </div>
              </div>

              {/* Confirm Pin */}
              <div className="w-full text-left mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 text-center">
                  Confirm 6-Digit MPIN
                </label>
                <div className="flex justify-center gap-3">
                  {confirmMpin.map((digit, idx) => (
                    <input
                      key={`confirm-${idx}`}
                      ref={confirmRefs[idx]}
                      type="password"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleMpinChange(idx, e.target.value, confirmMpin, setConfirmMpin, confirmRefs)}
                      onKeyDown={(e) => handleMpinKeyDown(idx, e, confirmMpin, confirmRefs)}
                      className="w-11 h-11 border border-slate-200 rounded-xl text-center text-lg font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateMpin}
                disabled={loading || mpin.join("").length < 6 || confirmMpin.join("").length < 6}
                className={`w-full flex items-center justify-center gap-1.5 font-extrabold py-3.5 rounded-xl transition text-sm ${
                  mpin.join("").length === 6 && confirmMpin.join("").length === 6 && !loading
                    ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? "Securing Vault..." : "CONFIRM & SET MPIN"}
              </button>
            </div>
          )}

          {/* STEP 5: Success Screen */}
          {step === 5 && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-green-50 text-green-600 flex items-center justify-center rounded-3xl mb-4 shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Verification Complete!</h2>
              <p className="text-xs text-gray-400 max-w-[340px] mb-8 leading-relaxed">
                Congratulations, your trading account is now fully approved! Your security keys have been registered and trading features are active.
              </p>

              <button
                onClick={() => navigate("/dashboard")}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition cursor-pointer text-sm"
              >
                GO TO TRADING DASHBOARD
              </button>
            </div>
          )}

          {/* STEP 6: KYC Pending Review Screen */}
          {step === 6 && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 flex items-center justify-center rounded-3xl mb-4 shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">KYC Under Review</h2>
              <p className="text-xs text-gray-400 max-w-[380px] mb-8 leading-relaxed font-semibold text-amber-600">
                Your documents have been submitted and are currently being reviewed by our verification team. 
                This normally takes under 24 hours. You will receive full trading access once verified.
              </p>
              <button
                onClick={async () => {
                  setLoading(true);
                  await refreshUser();
                  setLoading(false);
                }}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl transition text-sm cursor-pointer"
              >
                {loading ? "Checking..." : "REFRESH STATUS"}
              </button>
            </div>
          )}

          {/* STEP 7: KYC Rejected Screen */}
          {step === 7 && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 flex items-center justify-center rounded-3xl mb-4 shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-2">KYC Verification Failed</h2>
              <p className="text-xs text-gray-400 max-w-[380px] mb-8 leading-relaxed font-semibold text-rose-500">
                Unfortunately, your verification was rejected. Please review your details and re-submit your documents.
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white font-extrabold py-3.5 rounded-xl transition text-sm cursor-pointer"
              >
                RE-SUBMIT KYC
              </button>
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
