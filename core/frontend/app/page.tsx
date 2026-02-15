"use client";

import { useState } from "react";

export default function Page() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input) return;

    setLoading(true);
    setReply("");

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      setReply(data.reply ?? "Sin respuesta");
    } catch (e) {
      setReply("❌ Error al conectar con IA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 600 }}>
      <h1>ConectaAI Ventas 🤖</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Escribe aquí"
        style={{ width: "100%", height: 100 }}
      />

      <br /><br />

      <button
        onClick={send}
        style={{
          background: "#2563eb",
          color: "white",
          padding: "10px 20px",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loading ? "Pensando..." : "Enviar"}
      </button>

      <br /><br />

      <pre>{reply}</pre>
    </main>
  );
}
