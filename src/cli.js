import "dotenv/config";
import { handleMessage } from "./agent.js";
import { loadConfig } from "./config.js";
import { createStore } from "./store.js";

const config = loadConfig();
const store = createStore(config.dataFile);
const text = process.argv.slice(2).join(" ").trim() || "help";
const reply = handleMessage(text, store, new Date());
console.log(reply);
