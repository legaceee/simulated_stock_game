import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useModal } from "../../Context/ModalContext";
import { useAuth } from "../../Context/AuthContext";
import Modal from "../assets/Component/Modal";
import axios from "axios";
import Loading from "../assets/Component/Loader";

function Login() {
  const [activeTab, setActiveTab] = useState("login"); // "login" or "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Register flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { closeModal } = useModal();
  const { loginUser, registerUser } = useAuth();
  const navigate = useNavigate();

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log("Google Login Success", tokenResponse);
      // Optional: send to backend to get JWT. For now, simulate.
    },
    onError: () => {
      setError("Google Login Failed");
    },
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);
    const res = await loginUser(email, password);
    setLoading(false);
    if (res.success) {
      closeModal();
      navigate("/dashboard");
    } else {
      setError(res.error);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:4000/api/v1/users/send-otp", {
        email,
      });
      setLoading(false);
      if (res.status === 200) {
        setOtpSent(true);
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || "Error sending OTP. Please try again.");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) {
      setError("Please enter the OTP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:4000/api/v1/users/verify-otp", {
        email,
        otp,
      });
      setLoading(false);
      if (res.data.message === "Email verified successfully") {
        setOtpVerified(true);
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || "Invalid OTP. Please try again.");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please provide password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    const username = email.split("@")[0];
    const res = await registerUser(username, email, password, confirmPassword);
    setLoading(false);
    if (res.success) {
      closeModal();
      navigate("/dashboard");
    } else {
      setError(res.error);
    }
  };

  if (loading) {
    return (
      <Modal onClose={closeModal}>
        <div className="w-full max-w-md bg-white rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px]">
          <Loading text="Processing..." />
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={closeModal}>
      <div
        className="grid grid-cols-1 md:grid-cols-5 w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl animate-scale min-h-[450px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Info Panel */}
        <div className="md:col-span-2 bg-gradient-to-br from-green-500 to-emerald-600 text-white flex flex-col justify-between p-8">
          <div>
            <h2 className="text-3xl font-extrabold mb-3 tracking-tight">INVESTnow</h2>
            <p className="text-emerald-50 opacity-90 text-sm leading-relaxed">
              Simple, paperless stock market simulation. Zero risk, maximum learning. Build your portfolio and compete.
            </p>
          </div>
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm">Real-time charts</p>
                <p className="text-xs text-emerald-100/70">Socket-driven stock feeds</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-sm">₹1,00,000 Wallet</p>
                <p className="text-xs text-emerald-100/70">Simulated balance on login</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Input Panel */}
        <div className="md:col-span-3 p-8 flex flex-col justify-between relative bg-gray-50">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold transition"
          >
            &times;
          </button>

          <div>
            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                  activeTab === "login"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
                onClick={() => {
                  setActiveTab("login");
                  setError("");
                }}
              >
                Sign In
              </button>
              <button
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                  activeTab === "register"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
                onClick={() => {
                  setActiveTab("register");
                  setError("");
                }}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                {error}
              </div>
            )}

            {/* Login Tab Content */}
            {activeTab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
                >
                  Sign In
                </button>
              </form>
            )}

            {/* Register Tab Content */}
            {activeTab === "register" && (
              <div className="space-y-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Send Verification OTP
                    </button>
                  </form>
                ) : !otpVerified ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider">
                        Enter verification OTP
                      </span>
                      <button
                        type="button"
                        onClick={() => setOtpSent(false)}
                        className="text-green-600 hover:underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">We sent an OTP to {email}</p>
                    <input
                      type="text"
                      required
                      placeholder="6-digit OTP code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm text-center font-mono tracking-widest text-lg"
                      maxLength={6}
                    />
                    <button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Verify OTP
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <p className="text-xs text-green-600 font-semibold mb-2">✓ Email verified successfully!</p>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Create Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Min 8 characters, 1 Uppercase, 1 Number"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent bg-white shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Create Account
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <button
              onClick={() => googleLogin()}
              className="w-full border border-gray-300 py-3 rounded-lg flex items-center justify-center gap-3 hover:bg-gray-100 transition font-medium text-sm text-gray-700 bg-white shadow-sm"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Continue with Google
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-4">
              By proceeding, I agree to the <span className="underline cursor-pointer">Terms & Conditions</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Login;
