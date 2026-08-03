import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function Gate() {
  const { user } = useAuth();
  const [mode, setMode] = useState("login");

  if (user) return <Dashboard />;

  return mode === "login" ? (
    <Login onSwitch={() => setMode("register")} />
  ) : (
    <Register onSwitch={() => setMode("login")} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
