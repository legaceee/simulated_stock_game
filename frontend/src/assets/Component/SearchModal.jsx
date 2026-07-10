import { useEffect, useRef } from "react";
import { X, Search as SearchIcon } from "lucide-react";
import Modal from "./Modal";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchModal({ onClose }) {
  const inputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [result, setResults] = useState([]);
  const navigate = useNavigate();

  const handleInputChange = (event) => {
    setSearch(event.target.value);
  };
  const handleClick = (stockObj) => {
    navigate(`/stock/${stockObj.symbol}`, { state: { stock: stockObj } });
  };

  useEffect(() => {
    inputRef.current?.focus();
    document.body.classList.add("overflow-hidden");

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("overflow-hidden");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/v1/stocks/${encodeURIComponent(search)}`,
          {
            signal: controller.signal,
          }
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        setResults(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search]);

  // const popular = [
  //   "OLA Electric Mobility Ltd.",
  //   "Tata Motors Ltd.",
  //   "National Securities Depository Ltd.",
  //   "Suzlon Energy Ltd.",
  //   "Rico Auto Industries Ltd.",
  //   "Reliance Power Ltd.",
  // ];

  return (
    // overlay
    <Modal onClose={onClose}>
      <div className="flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden">
        {/* search input */}
        <div className="relative p-3 sm:p-4 border-b">
          <SearchIcon className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search INVESTnow..."
            className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-lg outline-none placeholder-gray-400 text-sm sm:text-base"
            value={search}
            onChange={handleInputChange}
          />
          <button
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* chips */}
        <div className="px-3 sm:px-4 py-3 flex flex-wrap gap-2 text-xs sm:text-sm">
          {["All", "Stocks", "F&O", "Mutual Funds", "ETF", "FAQs"].map(
            (t, i) => (
              <button
                key={t}
                className={`px-3 py-1 rounded-full border ${
                  i === 0
                    ? "bg-gray-100 border-gray-200"
                    : "hover:bg-gray-50 border-gray-200"
                }`}
              >
                {t}
              </button>
            )
          )}
        </div>

        {/* list */}
        <div className="px-3 sm:px-4 pb-4 flex-1 min-h-0">
          <p className="text-sm font-medium text-gray-500 mb-2">
            Popular on INVESTnow
          </p>
          <ul className="h-full overflow-y-auto">
            {result.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handleClick(item)}
              >
                <span className="text-gray-300">↗</span>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-gray-800">{item.symbol}</span>
                  <span className="text-xs text-gray-400">{item.companyName}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
