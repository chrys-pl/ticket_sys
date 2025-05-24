const express = require("express");
const fs = require("fs");
const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const accounts = JSON.parse(fs.readFileSync(__dirname + "/accounts.json", "utf8"));
  const match = accounts.find(acc => acc.username === username && acc.password === password);

  if (match) {
    res.status(200).json({ message: "Login successful!" });
  } else {
    res.status(401).json({ message: "Invalid username or password" });
  }
});

module.exports = router;

