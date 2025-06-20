const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = 3000;

const accountsPath = path.join(__dirname, "accounts.json");
const clientAccountsPath = path.join(__dirname, "client-accounts.json");
const ticketsPath = path.join(__dirname, "tickets.json");
const clientDir = path.join(__dirname, "../client");

let tickets = fs.existsSync(ticketsPath)
  ? JSON.parse(fs.readFileSync(ticketsPath, "utf8"))
  : [];
let ticketCounter = tickets.length > 0 ? Math.max(...tickets.map(t => t.id)) + 1 : 1;

const adminSession = session({
  name: "admin.sid",
  secret: "adminSecret",
  resave: false,
  saveUninitialized: false
});

const clientSession = session({
  name: "client.sid",
  secret: "clientSecret",
  resave: false,
  saveUninitialized: false
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.static(clientDir));

app.use("/api/login", adminSession);
app.use("/admin", adminSession);
app.use("/api/tickets", adminSession);
app.use("/api/tickets/update-status", adminSession);
app.use("/api/tickets/close", adminSession);
app.use("/api/tickets/delete", adminSession);
app.use("/api/admin-me", adminSession); // ✅ ADMIN SESSION PROTECTION

app.use("/api/client-login", clientSession);
app.use("/api/client-submit", clientSession);
app.use("/api/client-tickets", clientSession);
app.use("/dashboard.html", clientSession);
app.use("/api/me", clientSession);

const clients = [];

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.push(res);
  req.on("close", () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

function notifyClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => client.write(message));
}

function isAdmin(req, res, next) {
  if (req.session.admin) return next();
  return res.status(403).json({ error: "Unauthorized" });
}

function isClient(req, res, next) {
  if (req.session.client) return next();
  return res.status(403).json({ error: "Unauthorized" });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(clientDir, "client-login.html"));
});

app.get("/dashboard.html", isClient, (req, res) => {
  res.sendFile(path.join(clientDir, "dashboard.html"));
});

app.get("/admin", (req, res) => {
  if (!req.session.admin) {
    return res.sendFile(path.join(clientDir, "admin-login.html"));
  }
  res.sendFile(path.join(clientDir, "admin.html"));
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
  const match = accounts.find(a => a.username === username && a.password === password);
  if (match) {
    req.session.admin = true;
    req.session.username = username;
    return res.json({ message: "Admin login success" });
  }
  res.status(401).json({ message: "Invalid admin credentials" });
});

app.post("/api/client-login", (req, res) => {
  const { username, password } = req.body;
  const accounts = JSON.parse(fs.readFileSync(clientAccountsPath, "utf8"));
  const match = accounts.find(a => a.username === username && a.password === password);
  if (match) {
    req.session.client = true;
    req.session.clientUsername = username;
    return res.json({ message: "Client login success" });
  }
  res.status(401).json({ message: "Invalid client credentials" });
});

app.get("/api/me", (req, res) => {
  if (req.session.admin) {
    return res.json({ username: req.session.username });
  } else if (req.session.client) {
    return res.json({ username: req.session.clientUsername });
  }
  res.status(403).json({ error: "Not logged in" });
});

// ✅ NEW ROUTE: admin-only identity check
app.get("/api/admin-me", isAdmin, (req, res) => {
  res.json({ username: req.session.username });
});

app.get("/api/tickets", isAdmin, (req, res) => {
  tickets = JSON.parse(fs.readFileSync(ticketsPath, "utf8"));
  res.json(tickets);
});

app.get("/api/client-tickets", isClient, (req, res) => {
  const user = req.session.clientUsername;
  tickets = JSON.parse(fs.readFileSync(ticketsPath, "utf8"));
  const userTickets = tickets.filter(t => t.client === user);
  res.json(userTickets);
});

app.post("/api/client-submit", isClient, (req, res) => {
  const { name, facility, message } = req.body;
  const client = req.session.clientUsername;

  if (!name || !facility || !message || !client) {
    return res.status(400).json({ error: "Missing fields or not logged in" });
  }

  const newTicket = {
    id: ticketCounter++,
    name,
    facility,
    message,
    timestamp: new Date().toISOString(),
    status: "to be read",
    client
  };

  tickets.push(newTicket);
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  notifyClients({ type: "ticket-update", ticket: newTicket });
  res.status(200).json({ message: `Ticket #${newTicket.id} submitted!` });
});

app.post("/api/tickets/close", isAdmin, (req, res) => {
  const { id } = req.body;
  const ticket = tickets.find(t => t.id === Number(id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  ticket.status = "completed";
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  notifyClients({ type: "ticket-update", ticket });
  res.json({ message: `Ticket #${id} closed.` });
});

app.post("/api/tickets/delete", isAdmin, (req, res) => {
  const { id } = req.body;
  const index = tickets.findIndex(t => t.id === Number(id));
  if (index === -1) return res.status(404).json({ error: "Ticket not found" });
  tickets.splice(index, 1);
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  res.json({ message: `Ticket #${id} deleted.` });
});

app.post("/api/tickets/update-status", isAdmin, (req, res) => {
  const { id, status } = req.body;
  const ticket = tickets.find(t => t.id === Number(id));
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  ticket.status = status;
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  notifyClients({ type: "ticket-update", ticket });
  res.json({ message: `Status updated for ticket #${id}` });
});

setInterval(() => console.log("💓 Server alive"), 10000);
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

