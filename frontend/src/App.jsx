import Home from "./pages/Home";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Footer from "./assets/Component/Footer";
import GuestNavbar from "./assets/Component/GuestNavbar";
import { ModalProvider } from "../Context/ModalContext";
import { AuthProvider } from "../Context/AuthContext";
import ModalRoot from "./assets/Component/ModalRoot";
import AccountPage from "./pages/AccountPage";
import Stock from "./pages/Stock";
import Leaderboard from "./pages/Leaderboard";
import Stocks from "./pages/Stocks";
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <AuthProvider>
          <ModalProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<AccountPage />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/foot" element={<Footer />} />
              <Route path="/stock/:id" element={<Stock />} />
              <Route path="/stocks" element={<Stocks />} />
            </Routes>
            <ModalRoot />
          </ModalProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
