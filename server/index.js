const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

console.log('🔧 DEBUG: Server starting...');
console.log('🔧 DEBUG: Current working directory:', process.cwd());
console.log('🔧 DEBUG: __dirname:', __dirname);
console.log('🔧 DEBUG: Client path:', path.join(__dirname, '../client'));
console.log('🔧 DEBUG: Index.html path:', path.join(__dirname, '../client/index.html'));

const clientDir = path.join(__dirname, '../client');
const indexPath = path.join(__dirname, '../client/index.html');
const stylePath = path.join(__dirname, '../client/style.css');

console.log('🔧 DEBUG: Checking file existence...');
console.log('🔧 DEBUG: Client directory exists:', fs.existsSync(clientDir));
console.log('🔧 DEBUG: Index.html exists:', fs.existsSync(indexPath));
console.log('🔧 DEBUG: Style.css exists:', fs.existsSync(stylePath));

if (fs.existsSync(clientDir)) {
    console.log('🔧 DEBUG: Files in client directory:', fs.readdirSync(clientDir));
} else {
    console.log('❌ ERROR: Client directory does not exist!');
}

let tickets = [];
let ticketCounter = 1;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`🔧 DEBUG: ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, '../client/index.html');
    if (!fs.existsSync(htmlPath)) {
        return res.status(404).send(`
            <h1>Debug Info</h1>
            <p>index.html not found at: ${htmlPath}</p>
        `);
    }
    res.sendFile(htmlPath);
});

app.post('/api/tickets', (req, res) => {
    const { name, message } = req.body;
    if (!name || !message || name.trim() === "" || message.trim() === "") {
        return res.status(400).json({ error: "Name and message are required" });
    }

    const newTicket = {
        id: ticketCounter++,
        name: name.trim(),
        message: message.trim(),
        timestamp: new Date().toISOString(),
        status: 'open'
    };

    tickets.push(newTicket);

    return res.status(200).json({ 
        message: `Ticket submitted successfully! Your ticket ID is #${newTicket.id}`,
        ticketId: newTicket.id
    });
});

app.get('/api/tickets', (req, res) => {
    res.json({ tickets, total: tickets.length });
});

app.get('/api/tickets/:id', (req, res) => {
    const ticketId = parseInt(req.params.id);
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
});

app.patch('/api/tickets/:id', (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { status } = req.body;
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    if (status && ['open', 'in-progress', 'closed'].includes(status)) {
        ticket.status = status;
        ticket.updatedAt = new Date().toISOString();
    }

    res.json(ticket);
});

app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Admin Dashboard</title><style>
            body { font-family: Arial; margin: 40px; }
            .ticket { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
            .status { padding: 5px 10px; border-radius: 3px; font-size: 12px; }
            .open { background: #fff3cd; color: #856404; }
            .in-progress { background: #cce5ff; color: #004085; }
            .closed { background: #d4edda; color: #155724; }
        </style></head>
        <body>
            <h1>Ticket Dashboard</h1>
            <div id="tickets"></div>
            <script>
                fetch('/api/tickets')
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('tickets');
                    if (!data.tickets.length) {
                        container.innerHTML = '<p>No tickets submitted yet.</p>';
                        return;
                    }
                    container.innerHTML = data.tickets.map(ticket => \`
                        <div class="ticket">
                            <h3>Ticket #\${ticket.id} - \${ticket.name}</h3>
                            <p><strong>Message:</strong> \${ticket.message}</p>
                            <p><strong>Status:</strong> <span class="status \${ticket.status}">\${ticket.status}</span></p>
                            <p><strong>Submitted:</strong> \${new Date(ticket.timestamp).toLocaleString()}</p>
                        </div>\`).join('');
                });
            </script>
        </body>
        </html>
    `);
});

// ✅ NEW: Serve the admin login page
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// ✅ NEW: Handle admin login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const accountsPath = path.join(__dirname, './accounts.json');

    if (!fs.existsSync(accountsPath)) {
        return res.status(500).json({ error: "Admin account file missing" });
    }

    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    const match = accounts.find(acc => acc.username === username && acc.password === password);

    if (match) {
        res.json({ message: "Login successful!" });
    } else {
        res.status(401).json({ message: "Invalid username or password" });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`🔐 Admin login: http://localhost:${PORT}/admin-login`);
});

