"use client";

import { useState } from "react";

export default function ScheduleModal({
  dealId,
  onClose,
}: {
  dealId: number;
  onClose: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  async function schedule() {
    setLoading(true);
    await fetch(
      `https://conectaai.cl/api/actions/schedule/${dealId}?start_time=${start}&end_time=${end}`,
      { method: "POST" }
    );
    setLoading(false);
    onClose();
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[360px] space-y-4">
        <h3 className="text-lg font-semibold">Agendar cita</h3>

        <div>
          <label className="text-sm">Inicio</label>
          <input
            type="datetime-local"
            className="w-full border rounded p-2"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm">Fin</label>
          <input
            type="datetime-local"
            className="w-full border rounded p-2"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border"
          >
            Cancelar
          </button>
          <button
            onClick={schedule}
            disabled={loading}
            className="px-3 py-1 rounded bg-blue-600 text-white"
          >
            {loading ? "Agendando..." : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
