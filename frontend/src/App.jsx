import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import MapComponent from "./components/MapComponent.jsx";
import EventTicker from "./components/EventTicker.jsx";
import TaskBoard from "./components/TaskBoard.jsx";
import MissionLog from "./components/MissionLog.jsx";
import ScoreBoard from "./components/ScoreBoard.jsx";

const getRole = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("role") === "master" ? "master" : "staff";
};

const App = () => {
  const role = getRole();
  const userLabel = role === "master" ? "Admin" : "Stab";
  const socketRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [missionLog, setMissionLog] = useState([]);
  const [mapCenter, setMapCenter] = useState([48.835, 12.964]);
  const [resilienceScore, setResilienceScore] = useState(100);
  const [scoreFlash, setScoreFlash] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const prevScoreRef = useRef(100);

  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (window.location.hostname === "localhost"
        ? "http://localhost:4000"
        : window.location.origin);
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    const handleInit = (state) => {
      setEvents(state.events || []);
      setResources(state.resources || []);
      setTasks(state.tasks || []);
      setMissionLog(state.missionLog || []);
      setMapCenter([state.mapCenter.lat, state.mapCenter.lng]);
      setResilienceScore(state.resilienceScore ?? 100);
    };

    const handleUpdate = (state) => {
      setEvents(state.events || []);
      setResources(state.resources || []);
      setTasks(state.tasks || []);
      setMissionLog(state.missionLog || []);
      setResilienceScore(state.resilienceScore ?? 100);
    };

    const handleResourceError = (payload) => {
      setError(payload.message || "Ressource nicht verfügbar.");
      setTimeout(() => setError(""), 4000);
    };

    const handleConnectError = () => {
      setError("Backend nicht erreichbar.");
    };

    const handleToast = (payload) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, ...payload }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4000);
    };

    socket.on("state:init", handleInit);
    socket.on("state:update", handleUpdate);
    socket.on("error:resource_unavailable", handleResourceError);
    socket.on("connect_error", handleConnectError);
    socket.on("toast", handleToast);

    return () => {
      socket.off("state:init", handleInit);
      socket.off("state:update", handleUpdate);
      socket.off("error:resource_unavailable", handleResourceError);
      socket.off("connect_error", handleConnectError);
      socket.off("toast", handleToast);
      socket.disconnect();
    };
  }, []);

  const handleInjectScenario = (scenario) => {
    socketRef.current?.emit("event:inject", { scenario, user: userLabel });
  };

  const handleMoveEvent = (eventId, lat, lng) => {
    socketRef.current?.emit("event:move", { eventId, lat, lng, user: userLabel });
  };

  const handleCreateTask = (event, resourceId) => {
    const resource = resources.find((item) => item.id === resourceId);
    const title = resource
      ? `Maßnahme: ${resource.name} zu ${event.title}`
      : `Maßnahme zu ${event.title}`;
    socketRef.current?.emit("task:create", {
      eventId: event.id,
      resourceId,
      title,
      user: userLabel
    });
  };

  const handleTaskUpdate = (taskId, status) => {
    socketRef.current?.emit("task:update", { taskId, status, user: userLabel });
  };

  const handlePlaceSandbags = (event) => {
    const input = window.prompt("Wie viele Sandsäcke?", "500");
    if (!input) {
      return;
    }
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Bitte eine gültige Zahl für Sandsäcke eingeben.");
      setTimeout(() => setError(""), 4000);
      return;
    }
    socketRef.current?.emit("sandbag:place", {
      eventId: event.id,
      amount,
      user: userLabel
    });
  };

  const resourceSummary = resources
    .map((resource) => `${resource.name}: ${resource.available}/${resource.total}`)
    .join(" · ");

  useEffect(() => {
    if (resilienceScore > prevScoreRef.current) {
      setScoreFlash(true);
      setTimeout(() => setScoreFlash(false), 700);
    }
    prevScoreRef.current = resilienceScore;
  }, [resilienceScore]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6 bg-slate-900 relative">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">
                Blackout Tabletop MVP
              </h1>
              <div className="text-sm text-slate-400">
                Rolle: {role === "master" ? "Übungsleiter" : "Stab"}
              </div>
            </div>
            <ScoreBoard score={resilienceScore} flash={scoreFlash} />
            <a
              href={role === "master" ? "?role=staff" : "?role=master"}
              className="text-sm text-sky-300 hover:text-sky-200"
            >
              Wechsel zu {role === "master" ? "Stab" : "Übungsleiter"}
            </a>
          </div>
          <div className="text-xs sm:text-sm text-amber-300 bg-amber-950/60 border border-amber-800 rounded-md px-3 py-2">
            Ressourcen: {resourceSummary || "Lade..."}
          </div>
          {error && (
            <div className="text-xs sm:text-sm text-red-300 bg-red-950/60 border border-red-800 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-col xl:grid xl:grid-cols-[1.2fr_1fr] gap-4 sm:gap-6 p-4 sm:p-6">
        <div className="h-[55vh] sm:h-[60vh] xl:h-[calc(100vh-200px)]">
          <MapComponent
            events={events}
            center={mapCenter}
            canEdit={role === "master" || role === "staff"}
            onMove={handleMoveEvent}
          />
        </div>

        <div className="space-y-4 sm:space-y-6 max-h-[45vh] xl:max-h-[calc(100vh-200px)] overflow-y-auto pb-6">
          {role === "master" ? (
            <EventTicker events={events} onInjectScenario={handleInjectScenario} />
          ) : (
            <TaskBoard
              events={events}
              resources={resources}
              tasks={tasks}
              onCreateTask={handleCreateTask}
              onPlaceSandbags={handlePlaceSandbags}
              onTaskUpdate={handleTaskUpdate}
            />
          )}
          <MissionLog entries={missionLog} />
        </div>
      </main>

      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm border ${
              toast.type === "error"
                ? "bg-red-950 border-red-800 text-red-200"
                : "bg-emerald-950 border-emerald-800 text-emerald-200"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;

