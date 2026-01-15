import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const TaskBoard = ({
  events,
  resources,
  tasks,
  onCreateTask,
  onPlaceSandbags,
  onTaskUpdate
}) => {
  const [selection, setSelection] = useState({});
  const [hiddenTasks, setHiddenTasks] = useState(new Set());
  const timersRef = useRef({});

  const resourceOptions = useMemo(() => {
    const now = Date.now();
    return resources.map((resource) => {
      const locked =
        resource.lockedUntil && Number(resource.lockedUntil) > now;
      const remaining = locked
        ? Math.max(Math.ceil((resource.lockedUntil - now) / 1000), 1)
        : 0;
      const statusLabel = locked ? `gesperrt (${remaining}s)` : "";
      return {
        id: resource.id,
        label: `${resource.name} (${resource.available}/${resource.total}) ${
          statusLabel ? `· ${statusLabel}` : ""
        }`,
        disabled: resource.available <= 0 || locked
      };
    });
  }, [resources]);

  const sandbagResource = useMemo(
    () => resources.find((resource) => resource.code === "sandbags"),
    [resources]
  );

  useEffect(() => {
    tasks.forEach((task) => {
      if (task.status !== "done") {
        return;
      }
      if (hiddenTasks.has(task.id) || timersRef.current[task.id]) {
        return;
      }
      timersRef.current[task.id] = setTimeout(() => {
        setHiddenTasks((prev) => new Set(prev).add(task.id));
        delete timersRef.current[task.id];
      }, 700);
    });
  }, [tasks, hiddenTasks]);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
    };
  }, []);
  const handleSelect = (eventId, resourceId) => {
    setSelection((prev) => ({ ...prev, [eventId]: resourceId }));
  };

  const visibleTasks = useMemo(
    () => tasks.filter((task) => !hiddenTasks.has(task.id)),
    [tasks, hiddenTasks]
  );

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
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm hover:bg-emerald-600 disabled:opacity-50 transition active:scale-95"
                  disabled={!selection[event.id]}
                >
                  Maßnahme anlegen
                </button>
                <button
                  onClick={() => onPlaceSandbags(event)}
                  className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 disabled:opacity-50 transition active:scale-95"
                  disabled={!sandbagResource || sandbagResource.available <= 0}
                >
                  Sandsackwall setzen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold mb-2">Aktive Maßnahmen</h3>
        <div className="space-y-2">
          {visibleTasks.length === 0 ? (
            <div className="text-sm text-slate-400">
              Noch keine Maßnahmen angelegt.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {visibleTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: task.status === "done" ? 0 : 1,
                    x: task.status === "done" ? 40 : 0,
                    backgroundColor:
                      task.status === "done"
                        ? "rgba(20, 83, 45, 0.6)"
                        : "rgba(2, 6, 23, 1)"
                  }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.4 }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="font-semibold">{task.title}</div>
                  <div className="text-slate-400">Status: {task.status}</div>
                  {task.status !== "done" && (
                    <button
                      onClick={() => onTaskUpdate(task.id, "done")}
                      className="mt-2 px-3 py-1 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700 transition active:scale-95"
                    >
                      Erledigt
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;

