const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");

const app = express();
const PORT = 3000;

let ticketCounter = 1;
const accountsPath = path.join(__dirname, "accounts.json");
const ticketsPath = path.join(__dirname, "tickets.json");
const clientDir = path.join(__dirname, "../client");

// Initialize ticket counter based on existing tickets
let tickets = fs.existsSync(ticketsPath)
  ? JSON.parse(fs.readFileSync(ticketsPath, "utf8"))
  : [];

if (tickets.length > 0) {
  ticketCounter = Math.max(...tickets.map(t => t.id)) + 1;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: true
}));
app.use(express.static(clientDir));

function isAuthenticated(req, res, next) {
  if (req.session.authenticated) return next();
  res.status(403).json({ error: "Unauthorized" });
}

app.get("/", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

app.post("/api/tickets", (req, res) => {
  const { name, facility, message } = req.body;
  if (!name || !facility || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (fs.existsSync(ticketsPath)) {
    tickets = JSON.parse(fs.readFileSync(ticketsPath, "utf8"));
    if (tickets.length > 0) {
      ticketCounter = Math.max(...tickets.map(t => t.id)) + 1;
    }
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
  res.status(200).json({ message: `Ticket #${newTicket.id} submitted!` });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(accountsPath)) {
    return res.status(500).json({ error: "Admin account file missing" });
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf8"));
  const match = accounts.find(a => a.username === username && a.password === password);
  if (match) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ message: "Login successful" });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});

app.get("/admin", (req, res) => {
  if (!req.session.authenticated) {
    return res.sendFile(path.join(clientDir, "admin-login.html"));
  }
  res.sendFile(path.join(clientDir, "admin.html"));
});

app.get("/api/tickets", isAuthenticated, (req, res) => {
  if (fs.existsSync(ticketsPath)) {
    tickets = JSON.parse(fs.readFileSync(ticketsPath, "utf8"));
  }
  res.json(tickets);
});

app.post("/api/tickets/close", isAuthenticated, (req, res) => {
  const { id } = req.body;
  const ticket = tickets.find(t => t.id === Number(id));
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  ticket.status = "closed";
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  res.json({ message: `Ticket #${id} closed.` });
});

app.post("/api/tickets/delete", isAuthenticated, (req, res) => {
  const { id } = req.body;
  const numericId = Number(id);
  const ticketIndex = tickets.findIndex(t => t.id === numericId);

  if (ticketIndex === -1) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  tickets.splice(ticketIndex, 1);
  fs.writeFileSync(ticketsPath, JSON.stringify(tickets, null, 2));
  res.json({ message: `Ticket #${numericId} deleted.` });
});

app.get("/api/me", (req, res) => {
  if (!req.session.authenticated) {
    return res.status(403).json({ error: "Not logged in" });
  }
  res.json({ username: req.session.username });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));


