const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();
const PORT = 3000;

// Track runtime errors
process.on("uncaughtException", err => console.error("❗ Uncaught Exception:", err.stack));
process.on("unhandledRejection", err => console.error("❗ Unhandled Rejection:", err.stack));

// Error middleware
app.use((err, req, res, next) => {
  console.error("🔥 Uncaught middleware error:", err.stack);
  res.status(500).send("Something broke!");
});

// Paths
const accountsPath = path.join(__dirname, "accounts.json");
const ticketsPath = path.join(__dirname, "tickets.json");
const clientDir = path.join(__dirname, "../client");

// Tickets
let tickets = fs.existsSync(ticketsPath)
  ? JSON.parse(fs.readFileSync(ticketsPath, "utf8"))
  : [];
let ticketCounter = tickets.length > 0 ? Math.max(...tickets.map(t => t.id)) + 1 : 1;

// CORS
app.use((req, res, next) => {
  console.log(`🔄 CORS middleware: ${req.method} ${req.url}`);
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    console.log("⚙️ Responding to OPTIONS preflight");
    return res.sendStatus(204);
  }

  next();
});

// Body/session middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));

// 🔔 SSE
const clients = [];

app.get("/events", (req, res) => {
  console.log("✅ /events route HIT");

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    console.log("✅ Headers flushed for SSE");
  } catch (err) {
    console.error("❌ flushHeaders() failed:", err.stack);
    return res.status(500).send("Failed to open SSE stream");
  }

  clients.push(res);
  console.log(`📡 SSE client connected. Total: ${clients.length}`);

  req.on("close", () => {
    console.log("❌ SSE client disconnected");
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
    console.log(`📉 Clients left: ${clients.length}`);
  });
});

function notifyClients(ticket) {
  const data = `data: ${JSON.stringify(ticket)}\n\n`;
  console.log(`📢 Broadcasting ticket to ${clients.length} clients`);
  clients.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      console.error("❌ Failed to write to client:", err.stack);
    }
  });
}

// Auth middleware
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) return next();
  console.log("🔐 Unauthorized access attempt");
  res.status(403).json({ error: "Unauthorized" });
}

// Routes
app.get("/", (req, res) => {
  console.log("📥 GET /");
  res.sendFile(path.join(clientDir, "index.html"));
});

app.get("/admin", (req, res) => {
  console.log("📥 GET /admin");
  if (!req.session.authenticated) {
    return res.sendFile(path.join(clientDir, "admin-login.html"));
  }
  res.sendFile(path.join(clientDir, "admin.html"));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log("🔑 Login attempt for:", username);

  if (!fs.existsSync(accountsPath)) {
    return res.status(500).json({ error: "Account file missing" });
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
  const match = accounts.find(a => a.username === username && a.password === password);

  if (match) {
    req.session.authenticated = true;
    req.session.username = username;
    console.log("✅ Login success");
    res.json({ message: "Login successful" });
  } else {
    console.log("❌ Login failed");
    res.status(401).json({ message: "Invalid credentials" });
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: "Not logged in" });
  }
  console.log("👤 Session user:", req.session.username);
  res.json({ username: req.session.username });
});

app.get("/api/tickets", isAuthenticated, (req, res) => {
  console.log("📄 Fetching tickets...");
  if (fs.existsSync(ticketsPath)) {
    tickets = JSON.parse(fs.readFileSync(ticketsPath, "utf8"));
  }
  res.json(tickets);
});

app.post("/api/tickets", (req, res) => {
  const { name, facility, message } = req.body;
  console.log("🆕 Ticket submitted:", req.body);

  if (!name || !facility || !message) {
    return res.status(400).json({ error: "All fields required" });
  }

  const newTicket = {
    id: ticketCounter++,
    name,
    facility,
    message,
    timestamp: new Date().toISOString(),
    status: "open"
  };

  tickets.push(newTicket);
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  notifyClients(newTicket);
  res.status(200).json({ message: `Ticket #${newTicket.id} submitted!` });
});

app.post("/api/tickets/close", isAuthenticated, (req, res) => {
  const { id } = req.body;
  console.log("🔒 Closing ticket:", id);
  const ticket = tickets.find(t => t.id === Number(id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  ticket.status = "closed";
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  res.json({ message: `Ticket #${id} closed.` });
});

app.post("/api/tickets/delete", isAuthenticated, (req, res) => {
  const { id } = req.body;
  const numericId = Number(id);
  console.log("🗑 Deleting ticket:", numericId);
  const index = tickets.findIndex(t => t.id === numericId);

  if (index === -1) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  tickets.splice(index, 1);
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  res.json({ message: `Ticket #${numericId} deleted.` });
});

// Serve static files
app.use(express.static(clientDir));

// Keep-alive heartbeat
setInterval(() => console.log("💓 Server alive"), 10000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
