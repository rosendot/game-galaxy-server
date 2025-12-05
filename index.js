// Temporary placeholder server for Render
import express from "express";

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Game Galaxy Server Placeholder");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
