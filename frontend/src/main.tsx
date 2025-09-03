import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import App from "./App";          // your Swap UI (home)
import StakeUI from "./StakeUI";  // the new staking page
import "./index.css";

function Nav() {
  return (
    <div style={{display:"flex", gap:16, padding:"12px 16px", borderBottom:"1px solid #eee", fontFamily:"Inter, system-ui"}}>
      <Link to="/">Swap</Link>
      <Link to="/stake">Stake</Link>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/stake" element={<StakeUI />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
