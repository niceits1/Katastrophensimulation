const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const deggendorfCenter = { lat: 48.835, lng: 12.964 };
const RESILIENCE_MAX = 100;
const RESILIENCE_MIN = 0;
const RESILIENCE_DECAY_PER_EVENT = 0.1;
const RESILIENCE_EXPIRE_PENALTY = 15;
const RESILIENCE_RESOLVE_BONUS = 5;
const RESOURCE_FAILURE_RATE = 0.15;
const RESOURCE_LOCK_MS = 30 * 1000;
const DEFAULT_TTL_SECONDS = 10 * 60;
const logFilePath = path.join(__dirname, "data", "mission-log.jsonl");

const ensureLogDir = () => {
  const dir = path.dirname(logFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadMissionLog = () => {
  if (!fs.existsSync(logFilePath)) {
    return [];
  }
  const content = fs.readFileSync(logFilePath, "utf8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
};

const appendMissionLog = (entry) => {
  ensureLogDir();
  fs.appendFileSync(logFilePath, `${JSON.stringify(entry)}\n`);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const seedState = () => ({
  resources: [
    {
      id: uuidv4(),
      code: "sandbags",
      name: "Sandsäcke",
      available: 50000,
      total: 50000,
      unit: "Stück"
    },
    {
      id: uuidv4(),
      code: "pumps",
      name: "Hochleistungspumpen (5000l/min)",
      available: 8,
      total: 8,
      unit: "Stück"
    },
    {
      id: uuidv4(),
      code: "field_beds",
      name: "Feldbetten",
      available: 200,
      total: 200,
      unit: "Stück"
    }
  ],
  events: [
    {
      id: uuidv4(),
      title: "Isar-Ufer tritt in Fischerdorf über",
      type: "fire",
      status: "active",
      critical: true,
      ttlSeconds: DEFAULT_TTL_SECONDS,
      location: { lat: 48.857, lng: 12.979 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Kreisstraße DEG 23 überflutet",
      type: "thw",
      status: "active",
      critical: true,
      ttlSeconds: DEFAULT_TTL_SECONDS,
      location: { lat: 48.836, lng: 12.949 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Betreuungsstelle Stadthalle vorbereiten",
      type: "san",
      status: "active",
      critical: true,
      ttlSeconds: DEFAULT_TTL_SECONDS,
      location: { lat: 48.831, lng: 12.966 },
      createdAt: Date.now()
    }
  ],
  tasks: [],
  resilienceScore: RESILIENCE_MAX,
  resourceLocks: {},
  missionLog: loadMissionLog(),
  mapCenter: deggendorfCenter
});

const state = seedState();

const emitState = () => {
  io.emit("state:update", state);
};

const createEvent = ({ title, type, location, ttlSeconds, critical }) => ({
  id: uuidv4(),
  title,
  type,
  status: "active",
  critical: critical ?? true,
  ttlSeconds: ttlSeconds ?? DEFAULT_TTL_SECONDS,
  location,
  createdAt: Date.now()
});

const createLogEntry = ({ user, action, details }) => ({
  id: uuidv4(),
  timestamp: Date.now(),
  user: user || "System",
  action,
  details
});

const logAction = ({ user, action, details }) => {
  const entry = createLogEntry({ user, action, details });
  state.missionLog.push(entry);
  appendMissionLog(entry);
};

const injectFloodScenario = (user) => {
  const incidents = [
    {
      title: "Pegel Donau überschreitet Meldestufe 4",
      type: "command",
      location: { lat: 48.827, lng: 12.976 }
    },
    {
      title: "Kritische Sickerstellen am Deich",
      type: "fire",
      location: { lat: 48.857, lng: 12.982 }
    },
    {
      title: "Evakuierung Klinikum Deggendorf vorbereiten",
      type: "san",
      location: { lat: 48.833, lng: 12.968 }
    },
    {
      title: "Verkehrskollaps A3/A92",
      type: "thw",
      location: { lat: 48.806, lng: 12.982 }
    }
  ];

  incidents.forEach((incident) => {
    state.events.push(
      createEvent({
        title: incident.title,
        type: incident.type,
        location: incident.location
      })
    );
  });

  logAction({
    user,
    action: "SCENARIO",
    details: "Deichbruch Fischerdorf ausgelöst."
  });
};

const lockResource = (resourceId, now) => {
  state.resourceLocks[resourceId] = now + RESOURCE_LOCK_MS;
};

const isResourceLocked = (resourceId, now) => {
  const lockedUntil = state.resourceLocks[resourceId];
  return lockedUntil && lockedUntil > now;
};

const attemptResourceAction = ({ socket, resource, quantity, user, successMsg, failMsg }) => {
  const now = Date.now();
  if (isResourceLocked(resource.id, now)) {
    socket.emit("toast", {
      type: "error",
      message: "Ressource ist noch gesperrt."
    });
    return { ok: false };
  }

  if (Math.random() < RESOURCE_FAILURE_RATE) {
    lockResource(resource.id, now);
    resource.lockedUntil = state.resourceLocks[resource.id];
    socket.emit("toast", { type: "error", message: failMsg });
    logAction({
      user,
      action: "FAILURE",
      details: failMsg
    });
    emitState();
    return { ok: false };
  }

  if (resource.available < quantity) {
    socket.emit("toast", {
      type: "error",
      message: "Nicht genügend Ressourcen verfügbar."
    });
    return { ok: false };
  }

  resource.available -= quantity;
  socket.emit("toast", { type: "success", message: successMsg });
  return { ok: true };
};

const updateEventTimers = () => {
  const now = Date.now();
  let updated = false;

  state.events.forEach((event) => {
    if (!event.ttlSeconds || event.status === "resolved") {
      return;
    }

    if (!event.ttlExpiresAt) {
      event.ttlExpiresAt = event.createdAt + event.ttlSeconds * 1000;
    }

    event.ttlRemainingMs = Math.max(event.ttlExpiresAt - now, 0);
    if (!event.expired && event.ttlRemainingMs === 0) {
      event.expired = true;
      event.status = "expired";
      updated = true;

      const followUp = createEvent({
        title: "Überflutung Industriegebiet",
        type: "fire",
        location: {
          lat: event.location.lat + 0.005,
          lng: event.location.lng + 0.004
        }
      });
      state.events.push(followUp);

      state.resilienceScore = clamp(
        state.resilienceScore - RESILIENCE_EXPIRE_PENALTY,
        RESILIENCE_MIN,
        RESILIENCE_MAX
      );

      logAction({
        user: "System",
        action: "ESCALATION",
        details: `${event.title} eskaliert zu "${followUp.title}".`
      });
    }
  });

  return updated;
};

const updateResilience = () => {
  const criticalCount = state.events.filter(
    (event) => event.critical && event.status === "active"
  ).length;
  if (criticalCount === 0) {
    return false;
  }

  const nextScore = clamp(
    state.resilienceScore - criticalCount * RESILIENCE_DECAY_PER_EVENT,
    RESILIENCE_MIN,
    RESILIENCE_MAX
  );
  const changed = nextScore !== state.resilienceScore;
  state.resilienceScore = nextScore;
  return changed;
};

const updateResourceLocks = () => {
  const now = Date.now();
  let updated = false;
  Object.entries(state.resourceLocks).forEach(([resourceId, lockedUntil]) => {
    if (lockedUntil <= now) {
      delete state.resourceLocks[resourceId];
      const resource = state.resources.find((item) => item.id === resourceId);
      if (resource) {
        resource.lockedUntil = null;
      }
      updated = true;
    } else {
      const resource = state.resources.find((item) => item.id === resourceId);
      if (resource) {
        resource.lockedUntil = lockedUntil;
      }
    }
  });
  return updated;
};

setInterval(() => {
  const changedTimers = updateEventTimers();
  const changedScore = updateResilience();
  const changedLocks = updateResourceLocks();
  if (changedTimers || changedScore || changedLocks) {
    emitState();
  }
}, 1000);

io.on("connection", (socket) => {
  socket.emit("state:init", state);

  socket.on("event:inject", ({ scenario, user }) => {
    if (scenario === "deichbruch_fischerdorf") {
      injectFloodScenario(user);
      emitState();
    }
  });

  socket.on("event:move", ({ eventId, lat, lng, user }) => {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }
    event.location = { lat, lng };
    logAction({
      user,
      action: "MARKER",
      details: `${event.title} verschoben (${lat.toFixed(4)}, ${lng.toFixed(4)}).`
    });
    emitState();
  });

  socket.on("task:create", ({ eventId, resourceId, title, user }) => {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (!resource) {
      socket.emit("toast", {
        type: "error",
        message: "Ressource nicht gefunden."
      });
      return;
    }

    const attempt = attemptResourceAction({
      socket,
      resource,
      quantity: 1,
      user,
      successMsg: "Einsatzziel erreicht!",
      failMsg: "⚠️ Konvoi steckengeblieben! Verzögerung!"
    });
    if (!attempt.ok) {
      return;
    }

    const task = {
      id: uuidv4(),
      title: title || "Maßnahme ohne Titel",
      status: "todo",
      eventId,
      resourceId,
      createdAt: Date.now()
    };
    state.tasks.push(task);

    const event = state.events.find((item) => item.id === eventId);
    if (event) {
      event.status = "in_progress";
    }

    logAction({
      user,
      action: "TASK",
      details: title || "Maßnahme ohne Titel"
    });

    emitState();
  });

  socket.on("task:update", ({ taskId, status, user }) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    task.status = status;

    if (status === "done") {
      const event = state.events.find((item) => item.id === task.eventId);
      if (event) {
        event.status = "resolved";
      }
      state.resilienceScore = clamp(
        state.resilienceScore + RESILIENCE_RESOLVE_BONUS,
        RESILIENCE_MIN,
        RESILIENCE_MAX
      );
      logAction({
        user,
        action: "RESOLVE",
        details: `Maßnahme abgeschlossen: ${task.title}`
      });
    }

    emitState();
  });

  socket.on("marker:add", ({ title, type, location, user }) => {
    state.events.push(
      createEvent({
        title,
        type,
        location
      })
    );

    logAction({
      user,
      action: "MARKER",
      details: `${title} gesetzt.`
    });

    emitState();
  });

  socket.on("resource:consume", ({ resourceId, amount, note, user }) => {
    const resource = state.resources.find((item) => item.id === resourceId);
    const quantity = Number(amount || 0);
    if (!resource || quantity <= 0) {
      socket.emit("toast", {
        type: "error",
        message: "Ungültige Ressourcenmenge."
      });
      return;
    }

    const attempt = attemptResourceAction({
      socket,
      resource,
      quantity,
      user,
      successMsg: "Einsatzziel erreicht!",
      failMsg: "⚠️ Konvoi steckengeblieben! Verzögerung!"
    });
    if (!attempt.ok) {
      return;
    }

    logAction({
      user,
      action: "RESSOURCE",
      details: `${quantity} ${resource.name} verbraucht. ${note || ""}`.trim()
    });

    emitState();
  });

  socket.on("sandbag:place", ({ eventId, amount, user }) => {
    const resource = state.resources.find((item) => item.code === "sandbags");
    const quantity = Number(amount || 0);
    if (!resource || quantity <= 0) {
      socket.emit("toast", {
        type: "error",
        message: "Ungültige Sandsackmenge."
      });
      return;
    }

    const event = state.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    const attempt = attemptResourceAction({
      socket,
      resource,
      quantity,
      user,
      successMsg: "Einsatzziel erreicht!",
      failMsg: "⚠️ Konvoi steckengeblieben! Verzögerung!"
    });
    if (!attempt.ok) {
      return;
    }

    state.events.push(
      createEvent({
        title: `Sandsackwall bei ${event.title}`,
        type: "thw",
        location: event.location,
        ttlSeconds: DEFAULT_TTL_SECONDS,
        critical: false
      })
    );

    logAction({
      user,
      action: "RESSOURCE",
      details: `${quantity} Sandsäcke nach ${event.title} verlegt.`
    });

    emitState();
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const distPath = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

