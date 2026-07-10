import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Market from "./pages/Market";
import Coin from "./pages/Coin";
import News from "./pages/News";
import Simulator from "./pages/Simulator";
import Stocks from "./pages/Stocks";
import Stock from "./pages/Stock";
import Alerts from "./pages/Alerts";
import Login from "./components/Login";
import Splash from "./components/Splash";
import { checkAuth } from "./api";

type AuthState = "checking" | "authed" | "login";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    checkAuth().then((ok) => setAuth(ok ? "authed" : "login"));
    const onFail = () => setAuth("login");
    window.addEventListener("auth-fail", onFail);
    return () => window.removeEventListener("auth-fail", onFail);
  }, []);

  if (auth === "checking") {
    return <div className="boot" />;
  }
  if (auth === "login") {
    return <Login onOk={() => setAuth("authed")} />;
  }
  if (!booted) {
    return <Splash onDone={() => setBooted(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="mercado" element={<Market />} />
          <Route path="moeda/:symbol" element={<Coin />} />
          <Route path="acoes" element={<Stocks />} />
          <Route path="acao/:symbol" element={<Stock />} />
          <Route path="simulador" element={<Simulator />} />
          <Route path="alertas" element={<Alerts />} />
          <Route path="noticias" element={<News />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
