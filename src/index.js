import WebSocket from "ws";
import { BINANCE_WS_URL } from "./constants/index.js";
import fs from "fs";

const ws = new WebSocket(BINANCE_WS_URL);

ws.on("open", () => {
  console.log("connected");
});

ws.on("message", (msg) => {
  const parsed = JSON.parse(msg.toString());
  fs.appendFileSync("src/logs/response.logs", JSON.stringify(parsed) + "\n");
});

ws.on("close", (code, reason) => {
  console.log("closed", code, reason.toString());
  // reconnect logic here
});

ws.on("error", console.error);
