import { useMemo, useState } from "react";

const TaskBoard = ({ events, resources, tasks, onCreateTask }) => {
  const [selection, setSelection] = useState({});

  const resourceOptions = useMemo(
    () =>
      resources.map((resource) => ({
        id: resource.id,
        label: `${resource.name} (${resource.available}/${resource.total})`,
        disabled: resource.available <= 0
      })),
    [resources]
  );

  const handleSelect = (eventId, resourceId) => {
    setSelection((prev) => ({ ...prev, [eventId]: resourceId }));
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Task-Board</h2>
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-slate-950 border border-slate-800 rounded-lg p-3"
            >
              <div className="font-semibold">{event.title}</div>
              <div className="text-xs text-slate-400 mb-2">
                Status: {event.status}
              </div>
              <div className="flex flex-col gap-2">
                <select
                  value={selection[event.id] || ""}
                  onChange={(e) => handleSelect(event.id, e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-sm"
                >
                  <option value="">Ressource auswählen</option>
                  {resourceOptions.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    onCreateTask(event, selection[event.id] || null)
                  }
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-600 disabled:opacity-50"
                  disabled={!selection[event.id]}
                >
                  Maßnahme anlegen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold mb-2">Aktive Maßnahmen</h3>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-sm text-slate-400">
              Noch keine Maßnahmen angelegt.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              >
                <div className="font-semibold">{task.title}</div>
                <div className="text-slate-400">Status: {task.status}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;

