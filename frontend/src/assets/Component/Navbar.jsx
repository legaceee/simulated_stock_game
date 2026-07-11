import { useEffect, useRef, useState } from "react";
import { useModal } from "../../../Context/ModalContext";
import Button from "./Button";
import { Link } from "react-router-dom";

export default function Navbar({ children }) {
  const { setModal } = useModal();
  const [query, setQuery] = useState("");
  const inputEl = useRef(null);

  // Handle global shortcut Ctrl+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        console.log("Ctrl+K detected");
        setModal("search");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setModal]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white  ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo + links */}
          <div className="flex items-center justify-between md:justify-start">
            <h1 className="text-lg font-bold">
              <Link to="/">
                INVEST<span className="text-green-500">now</span>
              </Link>
            </h1>
            <ul className="hidden md:flex items-center space-x-6 ml-6 text-sm">
              <li className="font-bold cursor-pointer hover:text-green-500 transition-colors">
                <Link to="/dashboard">Stocks</Link>
              </li>
              <li className="font-bold cursor-pointer hover:text-green-500 transition-colors">
                <Link to="/leaderboard">Leaderboard</Link>
              </li>
              <li className="text-gray-400">Crypto</li>
              <li className="text-gray-400">Mutual Funds</li>
              <li className="text-gray-400">Commodities</li>
            </ul>
          </div>

          <div className="flex flex-row items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputEl}
                type="text"
                placeholder="Search INVESTnow..."
                className="block w-full md:w-96 pl-3 pr-16 py-2 border border-gray-300 rounded-lg
                           leading-5 bg-white placeholder-gray-500 focus:outline-none
                           focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                onFocus={() => {
                  setModal("search");
                  setTimeout(() => inputEl.current?.blur(), 0);
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none hidden sm:block">
                Ctrl + K
              </span>
            </div>

            {/* Right-side actions (Login button etc.) */}
            <div className="flex items-center justify-end shrink-0">{children}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
