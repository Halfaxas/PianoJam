import { useEffect } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";
import { Toasts } from "./components/Toasts";
import { getSocket } from "./lib/socket";

function NotFound() {
  return (
    <div className="page-center">
      <div className="card">
        <h2>404: off key</h2>
        <p className="hint">This page doesn't exist.</p>
        <Link className="btn primary" to="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  // Connect (and register all socket listeners) as soon as the app loads.
  useEffect(() => {
    getSocket();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  );
}
