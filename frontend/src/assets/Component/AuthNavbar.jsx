import { useState, useRef, useEffect, useMemo } from "react";
import Navbar from "./Navbar";
import Avatar, { genConfig } from "react-nice-avatar";
import UserProfile from "./UserProfile";
import { useAuth } from "../../../Context/AuthContext";

function AuthNavbar() {
  const [clicked, setClicked] = useState(false);
  const { user } = useAuth();

  const config = useMemo(() => {
    const email = user?.email || "guest";
    const cacheKey = `avatar-config-${email}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    const newConfig = genConfig();
    localStorage.setItem(cacheKey, JSON.stringify(newConfig));
    return newConfig;
  }, [user?.email]);

  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
        return;
      }
      if (e.target.closest(".animate-slide-in-left")) {
        return;
      }
      setClicked(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div>
      <Navbar>
        <div className="relative" ref={dropdownRef}>
          {/* Avatar button */}
          <div
            className="cursor-pointer"
            onClick={() => setClicked((prev) => !prev)}
          >
            <Avatar style={{ width: "2rem", height: "2rem" }} {...config} />
          </div>
        </div>
      </Navbar>

      {/* Left Drawer Modal */}
      {clicked && (
        <UserProfile onClose={() => setClicked(false)} />
      )}
    </div>
  );
}

export default AuthNavbar;
