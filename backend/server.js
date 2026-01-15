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
      location: { lat: 48.857, lng: 12.979 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Kreisstraße DEG 23 überflutet",
      type: "thw",
      status: "active",
      location: { lat: 48.836, lng: 12.949 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Betreuungsstelle Stadthalle vorbereiten",
      type: "san",
      status: "active",
      location: { lat: 48.831, lng: 12.966 },
      createdAt: Date.now()
    }
  ],
  tasks: [],
  missionLog: loadMissionLog(),
  mapCenter: deggendorfCenter
});

const state = seedState();

const emitState = () => {
  io.emit("state:update", state);
};

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
    state.events.push({
      id: uuidv4(),
      title: incident.title,
      type: incident.type,
      status: "active",
      location: incident.location,
      createdAt: Date.now()
    });
  });

  logAction({
    user,
    action: "SCENARIO",
    details: "Deichbruch Fischerdorf ausgelöst."
  });
};

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
    if (!resource || resource.available <= 0) {
      socket.emit("error:resource_unavailable", {
        message: "Keine Ressourcen mehr verfügbar."
      });
      return;
    }

    resource.available -= 1;

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

  socket.on("marker:add", ({ title, type, location, user }) => {
    state.events.push({
      id: uuidv4(),
      title,
      type,
      status: "active",
      location,
      createdAt: Date.now()
    });

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
    if (!resource || quantity <= 0 || resource.available < quantity) {
      socket.emit("error:resource_unavailable", {
        message: "Nicht genügend Ressourcen verfügbar."
      });
      return;
    }
    resource.available -= quantity;

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
    if (!resource || quantity <= 0 || resource.available < quantity) {
      socket.emit("error:resource_unavailable", {
        message: "Nicht genügend Sandsäcke verfügbar."
      });
      return;
    }

    const event = state.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    resource.available -= quantity;

    state.events.push({
      id: uuidv4(),
      title: `Sandsackwall bei ${event.title}`,
      type: "thw",
      status: "active",
      location: event.location,
      createdAt: Date.now()
    });

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

