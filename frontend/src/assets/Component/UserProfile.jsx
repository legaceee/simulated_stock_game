import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../Context/AuthContext";
import {
  Settings,
  LogOut,
  FileText,
  Headphones,
  ClipboardList,
  Wallet,
  LayoutDashboard,
  TrendingUp,
  Trophy,
  X
} from "lucide-react";

export default function UserProfile({ onClose }) {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    onClose?.();
    navigate("/");
  };

  const handleNavigate = (path) => {
    navigate(path);
    onClose?.();
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] flex">
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        />
        {/* Drawer container */}
        <div className="fixed top-0 left-0 bottom-0 w-80 sm:w-96 bg-white z-50 shadow-2xl flex flex-col p-6 animate-slide-in-left">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-extrabold text-lg text-gray-800">Profile</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl transition text-gray-500 hover:text-gray-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-500 text-sm">No user logged in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed top-0 left-0 bottom-0 w-80 sm:w-96 bg-white z-50 shadow-2xl flex flex-col justify-between p-6 animate-slide-in-left border-r border-gray-100">
        
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-lg text-gray-800">Account Profile</h3>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-slate-50 rounded-xl transition text-gray-500 hover:text-gray-800"
              aria-label="Close Profile Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info Section */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-green-100 uppercase">
              {user.username ? user.username.slice(0, 2) : "US"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-gray-900 text-base truncate">{user.username || "InvestTrader"}</p>
              <p className="text-gray-400 text-xs font-semibold truncate mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Simulated Balance Badge */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span>Simulated Cash Balance</span>
            </div>
            <p className="text-xl font-extrabold">
              ₹{(user.cashBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Menu Options */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">Navigation</span>
            
            <button 
              onClick={() => handleNavigate("/dashboard")}
              className="w-full flex items-center gap-3 text-gray-700 hover:text-green-600 hover:bg-green-50/50 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>My Portfolio / Dashboard</span>
            </button>

            <button 
              onClick={() => handleNavigate("/stocks")}
              className="w-full flex items-center gap-3 text-gray-700 hover:text-green-600 hover:bg-green-50/50 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <TrendingUp className="w-4.5 h-4.5" />
              <span>Explore Stocks</span>
            </button>

            <button 
              onClick={() => handleNavigate("/leaderboard")}
              className="w-full flex items-center gap-3 text-gray-700 hover:text-green-600 hover:bg-green-50/50 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              <Trophy className="w-4.5 h-4.5" />
              <span>Trader Leaderboard</span>
            </button>
          </div>

          {/* Extra options */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">Actions</span>

            <button 
              onClick={() => handleNavigate("/orders")}
              className="w-full flex items-center gap-3 text-gray-600 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <ClipboardList className="w-4.5 h-4.5 text-gray-400" />
              <span>All Orders</span>
            </button>

            <button 
              onClick={() => handleNavigate("/transactions")}
              className="w-full flex items-center gap-3 text-gray-600 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl text-sm font-medium transition"
            >
              <FileText className="w-4.5 h-4.5 text-gray-400" />
              <span>Transaction History</span>
            </button>

            <button className="w-full flex items-center gap-3 text-gray-600 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl text-sm font-medium transition">
              <Headphones className="w-4.5 h-4.5 text-gray-400" />
              <span>24 x 7 Support</span>
            </button>

            <button className="w-full flex items-center gap-3 text-gray-600 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl text-sm font-medium transition">
              <Settings className="w-4.5 h-4.5 text-gray-400" />
              <span>Account Settings</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <button className="flex items-center gap-2 text-gray-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-sm font-semibold transition">
            <Settings className="w-4 h-4 text-gray-400" />
            <span>Theme</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-3.5 py-2 rounded-xl text-sm font-bold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>

      </div>
    </div>
  );
}
