document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("login-form");
  const ticketList = document.getElementById("ticketList");
  const userBox = document.getElementById("userBox");
  const alertBox = document.getElementById("alertBox");

  // LOGIN
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });

      const data = await response.json();
      if (response.ok) {
        window.location.href = "/admin";
      } else {
        document.getElementById("login-status").textContent = data.message || "Login failed.";
        document.getElementById("login-status").style.color = "red";
      }
    });
    return;
  }

  // ADMIN DASHBOARD
  if (!ticketList || !userBox) return;

  try {
    const userRes = await fetch("/api/me", {
      credentials: "include"
    });
    const userData = await userRes.json();
    if (userRes.ok) {
      userBox.textContent = `Logged in as: ${userData.username}`;
    }
  } catch (err) {
    console.error("Error fetching user:", err);
  }

  ticketList.addEventListener("click", async (e) => {
    const parent = e.target.closest(".ticket");
    if (!parent) return;
    const id = parseInt(parent.dataset.ticketId);

    if (e.target.classList.contains("closeBtn")) {
      e.preventDefault();
      try {
        const res = await fetch("/api/tickets/close", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          const statusSpan = parent.querySelector(".status");
          statusSpan.textContent = "closed";
          e.target.remove();
        }
      } catch (err) {
        console.error("Error closing ticket:", err);
      }
    }

    if (e.target.classList.contains("deleteBtn")) {
      e.preventDefault();
      const confirmed = confirm(`Delete Ticket #${id}?`);
      if (!confirmed) return;
      try {
        const res = await fetch("/api/tickets/delete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          parent.remove();
        } else if (res.status === 403) {
          alert("Session expired. Please log in again.");
          window.location.href = "/admin-login.html";
        }
      } catch (err) {
        console.error("Error deleting ticket:", err);
      }
    }
  });

  async function loadTickets() {
    try {
      const res = await fetch("/api/tickets", {
        credentials: "include"
      });
      const tickets = await res.json();
      ticketList.innerHTML = "";

      if (!Array.isArray(tickets) || tickets.length === 0) {
        ticketList.innerHTML = "<p>No tickets yet.</p>";
        return;
      }

      tickets.forEach(ticket => appendTicket(ticket));
    } catch (err) {
      ticketList.innerHTML = "<p>Error loading tickets.</p>";
      console.error(err);
    }
  }

  function appendTicket(ticket) {
    const div = document.createElement("div");
    div.className = "ticket";
    div.dataset.ticketId = ticket.id;
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <p><strong>Ticket #${ticket.id} - ${ticket.name}</strong></p>
          <p><strong>Facility:</strong> ${ticket.facility}</p>
          <p><strong>Status:</strong> <span class="status">${ticket.status}</span></p>
        </div>
        <button class="deleteBtn" style="background: none; border: none; color: red; font-size: 1.2em; cursor: pointer;">&times;</button>
      </div>
      <details>
        <summary>View Message</summary>
        <p>${ticket.message}</p>
      </details>
      ${ticket.status === "open" ? `<button class="closeBtn">Close Ticket</button>` : ""}
    `;
    ticketList.prepend(div);
  }

  await loadTickets();

  // ✅ REAL-TIME EVENT SOURCE
  console.log("Opening EventSource...");
  const eventSource = new EventSource("/events", { withCredentials: true });

  eventSource.onopen = () => console.log("✅ SSE connection established");
  eventSource.onerror = (err) => console.error("❌ SSE error", err);

  eventSource.onmessage = (event) => {
    console.log("🔔 New ticket received:", event.data);
    const ticket = JSON.parse(event.data);
    alertBox.textContent = `New Ticket #${ticket.id} from ${ticket.name} - click to show`;
    alertBox.style.display = "block";

    alertBox.onclick = () => {
      appendTicket(ticket);
      alertBox.style.display = "none";
    };
  };
});
