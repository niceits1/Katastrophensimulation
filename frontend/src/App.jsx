import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import MapComponent from "./components/MapComponent.jsx";
import EventTicker from "./components/EventTicker.jsx";
import TaskBoard from "./components/TaskBoard.jsx";

const getRole = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("role") === "master" ? "master" : "staff";
};

const App = () => {
  const role = getRole();
  const socketRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [mapCenter, setMapCenter] = useState([51.335, 12.373]);
  const [error, setError] = useState("");

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
      setMapCenter([state.mapCenter.lat, state.mapCenter.lng]);
    };

    const handleUpdate = (state) => {
      setEvents(state.events || []);
      setResources(state.resources || []);
      setTasks(state.tasks || []);
    };

    const handleResourceError = (payload) => {
      setError(payload.message || "Ressource nicht verfügbar.");
      setTimeout(() => setError(""), 4000);
    };

    const handleConnectError = () => {
      setError("Backend nicht erreichbar.");
    };

    socket.on("state:init", handleInit);
    socket.on("state:update", handleUpdate);
    socket.on("error:resource_unavailable", handleResourceError);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("state:init", handleInit);
      socket.off("state:update", handleUpdate);
      socket.off("error:resource_unavailable", handleResourceError);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
    };
  }, []);

  const handleInjectScenario = (scenario) => {
    socketRef.current?.emit("event:inject", { scenario });
  };

  const handleMoveEvent = (eventId, lat, lng) => {
    socketRef.current?.emit("event:move", { eventId, lat, lng });
  };

  const handleCreateTask = (event, resourceId) => {
    const resource = resources.find((item) => item.id === resourceId);
    const title = resource
      ? `Maßnahme: ${resource.name} zu ${event.title}`
      : `Maßnahme zu ${event.title}`;
    socketRef.current?.emit("task:create", {
      eventId: event.id,
      resourceId,
      title
    });
  };

  const resourceSummary = resources
    .map((resource) => `${resource.name}: ${resource.available}/${resource.total}`)
    .join(" · ");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6 bg-slate-900">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">
                Blackout Tabletop MVP
              </h1>
              <div className="text-sm text-slate-400">
                Rolle: {role === "master" ? "Übungsleiter" : "Stab"}
              </div>
            </div>
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
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;

