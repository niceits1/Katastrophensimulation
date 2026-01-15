const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const musterstadtCenter = { lat: 51.335, lng: 12.373 };

const seedState = () => ({
  resources: [
    {
      id: uuidv4(),
      name: "Notstromaggregate (500kVA)",
      available: 5,
      total: 10
    },
    {
      id: uuidv4(),
      name: "THW Bergungsgruppe",
      available: 2,
      total: 4
    },
    {
      id: uuidv4(),
      name: "Diesel-Tanklaster",
      available: 3,
      total: 5
    },
    {
      id: uuidv4(),
      name: "Mobile Funkzelle (Sat)",
      available: 1,
      total: 2
    },
    {
      id: uuidv4(),
      name: "Feldküche",
      available: 1,
      total: 2
    }
  ],
  events: [
    {
      id: uuidv4(),
      title: "Krankenhaus Nord meldet Notstrom auf 4h",
      type: "power_outage",
      status: "active",
      location: { lat: 51.339, lng: 12.362 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Wasserwerk Süd ohne Steuerung",
      type: "power_outage",
      status: "active",
      location: { lat: 51.323, lng: 12.39 },
      createdAt: Date.now()
    },
    {
      id: uuidv4(),
      title: "Feuerwache Mitte meldet Dieselengpass",
      type: "power_outage",
      status: "active",
      location: { lat: 51.335, lng: 12.38 },
      createdAt: Date.now()
    }
  ],
  tasks: [],
  mapCenter: musterstadtCenter
});

const state = seedState();

const emitState = () => {
  io.emit("state:update", state);
};

const injectCriticalInfrastructure = () => {
  const incidents = [
    {
      title: "Krankenhaus: Intensivstation ohne Netz",
      location: { lat: 51.338, lng: 12.365 }
    },
    {
      title: "Wasserwerk: Pumpen stehen still",
      location: { lat: 51.327, lng: 12.395 }
    },
    {
      title: "Feuerwache: Kommunikation ausgefallen",
      location: { lat: 51.332, lng: 12.375 }
    }
  ];

  incidents.forEach((incident) => {
    state.events.push({
      id: uuidv4(),
      title: incident.title,
      type: "critical_infra",
      status: "active",
      location: incident.location,
      createdAt: Date.now()
    });
  });
};

io.on("connection", (socket) => {
  socket.emit("state:init", state);

  socket.on("event:inject", ({ scenario }) => {
    if (scenario === "critical_infra") {
      injectCriticalInfrastructure();
      emitState();
    }
  });

  socket.on("event:move", ({ eventId, lat, lng }) => {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }
    event.location = { lat, lng };
    emitState();
  });

  socket.on("task:create", ({ eventId, resourceId, title }) => {
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

    emitState();
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

