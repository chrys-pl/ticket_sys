document.addEventListener("DOMContentLoaded", async () => {
  const ticketList = document.getElementById("ticketList");
  const userBox = document.getElementById("userBox");
  const alertBox = document.getElementById("alertBox");

  async function loadUser() {
    try {
      const res = await fetch("/api/admin-me", { credentials: "include" });
      if (!res.ok) throw new Error("Not logged in");
      const user = await res.json();
      userBox.textContent = `Logged in as: ${user.username}`;
    } catch (err) {
      alert("Session expired. Redirecting to login...");
      window.location.href = "/admin-login.html";
    }
  }

  async function loadTickets() {
    try {
      const res = await fetch("/api/tickets", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tickets");
      const tickets = await res.json();
      ticketList.innerHTML = "";
      if (tickets.length === 0) {
        ticketList.innerHTML = "<p>No tickets yet.</p>";
        return;
      }
      tickets.forEach(appendTicket);
    } catch (err) {
      ticketList.innerHTML = `<p style="color: red;">Error loading tickets: ${err.message}</p>`;
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
          <p><strong>Client Account:</strong> ${ticket.client || "N/A"}</p>
          <p><strong>Status:</strong> 
            <select class="statusDropdown">
              <option value="to be read" ${ticket.status === "to be read" ? "selected" : ""}>to be read</option>
              <option value="in progress" ${ticket.status === "in progress" ? "selected" : ""}>in progress</option>
              <option value="completed" ${ticket.status === "completed" ? "selected" : ""}>completed</option>
            </select>
          </p>
        </div>
        <button class="deleteBtn" style="background: none; border: none; color: red; font-size: 1.2em; cursor: pointer;">&times;</button>
      </div>
      <details>
        <summary>View Message</summary>
        <p>${ticket.message}</p>
      </details>
    `;
    ticketList.prepend(div);
  }

  ticketList.addEventListener("click", async (e) => {
    const parent = e.target.closest(".ticket");
    if (!parent) return;
    const id = parseInt(parent.dataset.ticketId);

    if (e.target.classList.contains("deleteBtn")) {
      const confirmed = confirm(`Delete Ticket #${id}?`);
      if (!confirmed) return;
      try {
        const res = await fetch("/api/tickets/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          parent.remove();
        } else if (res.status === 403) {
          alert("Session expired. Redirecting to login...");
          window.location.href = "/admin-login.html";
        } else {
          throw new Error("Failed to delete ticket");
        }
      } catch (err) {
        alert("Error deleting ticket: " + err.message);
      }
    }
  });

  ticketList.addEventListener("change", async (e) => {
    if (e.target.classList.contains("statusDropdown")) {
      const parent = e.target.closest(".ticket");
      const id = parseInt(parent.dataset.ticketId);
      const status = e.target.value;
      try {
        const res = await fetch("/api/tickets/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id, status })
        });
        if (!res.ok) {
          alert("Failed to update status.");
        }
      } catch (err) {
        alert("Error updating status: " + err.message);
      }
    }
  });

  const eventSource = new EventSource("/events", { withCredentials: true });
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "ticket-update") {
      loadTickets(); // Refresh on new ticket
    }
  };

  await loadUser();
  await loadTickets();
});


