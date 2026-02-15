"use client";

import { useState } from "react";
import ScheduleModal from "./ScheduleModal";

export default function DealButtons({
  buttons,
  onAction,
  dealId,
}: {
  buttons: any[];
  onAction: (action: string) => void;
  dealId: number;
}) {
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="flex flex-wrap gap-1">
      {buttons.map((b) => {
        if (!b.enabled) return null;

        if (b.action_type === "schedule") {
          return (
            <button
              key={b.id}
              onClick={() => setShowSchedule(true)}
              className="px-2 py-1 text-xs rounded text-white"
              style={{ backgroundColor: b.color }}
            >
              {b.custom_label}
            </button>
          );
        }

        return (
          <button
            key={b.id}
            onClick={() => onAction(b.action_type)}
            className="px-2 py-1 text-xs rounded text-white"
            style={{ backgroundColor: b.color }}
          >
            {b.custom_label}
          </button>
        );
      })}

      {showSchedule && (
        <ScheduleModal
          dealId={dealId}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  );
}
