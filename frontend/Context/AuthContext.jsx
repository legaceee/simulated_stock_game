import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // Setup axios auth header whenever token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      localStorage.removeItem("token");
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get("http://localhost:4000/api/v1/users/getMe");
      setUser(res.data.data.user);
    } catch (err) {
      console.error("Failed to fetch current user:", err);
      // If unauthorized, clear token
      if (err.response?.status === 401) {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  const loginUser = async (email, password) => {
    try {
      const res = await axios.post("http://localhost:4000/api/v1/users/login", {
        email,
        password,
      });
      if (res.data.token) {
        setToken(res.data.token);
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Invalid email or password",
      };
    }
  };

  const registerUser = async (username, email, password, confirmPassword) => {
    try {
      const res = await axios.post("http://localhost:4000/api/v1/users/register", {
        username,
        email,
        password,
        confirmPassword,
      });
      if (res.data.token) {
        setToken(res.data.token);
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.message || "Signup failed",
      };
    }
  };

  const logoutUser = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        loginUser,
        registerUser,
        logoutUser,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
