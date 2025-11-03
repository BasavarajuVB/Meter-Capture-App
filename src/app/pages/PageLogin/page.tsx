"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    try {
      sessionStorage.setItem("username", username);
    } catch {}
    router.push("/pages/PageHome");
  };

  return (
    <div className="center">
      <form onSubmit={handleSubmit} className="card stack">
        <h2 className="title">Login</h2>
        <label className="stack" style={{ gap: 6 }}>
          <span>Username</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="input"
          />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span>Password</span>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="input"
          />
        </label>
        <div className="actions">
          <button type="submit" className="btn btnPrimary">Continue to Home</button>
        </div>
      </form>
    </div>
  );
}


