//Needs to fix multiple ticket deletions
document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("login-form");
  const ticketList = document.getElementById("ticketList");
  const userBox = document.getElementById("userBox");

  // Handle login page
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
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

  // Load dashboard
  if (!ticketList || !userBox) return;

  try {
    const userRes = await fetch("/api/me");
    const userData = await userRes.json();
    if (userRes.ok) {
      userBox.textContent = `Logged in as: ${userData.username}`;
    }
  } catch (err) {
    console.error("Error fetching user:", err);
  }

  // Event delegation - attach ONE listener to the parent container
  ticketList.addEventListener("click", async (e) => {
    // Handle Close Ticket button
    if (e.target.classList.contains("closeBtn")) {
      e.preventDefault();
      const parent = e.target.closest(".ticket");
      const id = parseInt(parent.dataset.ticketId);

      try {
        const res = await fetch("/api/tickets/close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        if (res.ok) {
          const statusSpan = parent.querySelector(".status");
          statusSpan.textContent = "closed";
          e.target.remove();
        } else {
          console.error("Failed to close ticket");
        }
      } catch (err) {
        console.error("Error closing ticket:", err);
      }
    }

    // Handle Delete Ticket button
    if (e.target.classList.contains("deleteBtn")) {
      e.preventDefault();
      const parent = e.target.closest(".ticket");
      const id = parseInt(parent.dataset.ticketId);

      const confirmed = confirm(`Are you sure you want to permanently delete Ticket #${id}?`);
      if (!confirmed) return;

      try {
        const res = await fetch("/api/tickets/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });

        if (res.ok) {
          await loadTickets(); // Re-render the list
        } else {
          console.error("Failed to delete ticket");
        }
      } catch (err) {
        console.error("Error deleting ticket:", err);
      }
    }
  });

  async function loadTickets() {
    try {
      const res = await fetch("/api/tickets");
      const tickets = await res.json();
      ticketList.innerHTML = "";

      if (tickets.length === 0) {
        ticketList.innerHTML = "<p>No tickets yet.</p>";
        return;
      }

      tickets.forEach(ticket => {
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

        ticketList.appendChild(div);
      });

    } catch (err) {
      ticketList.innerHTML = "<p>Error loading tickets.</p>";
      console.error(err);
    }
  }

  await loadTickets();
});
