#!/usr/bin/env node

import { startServer } from "./server.mjs";

const args = process.argv.slice(2);
let targetPort = 3000;
let editorPort = 3001;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "-p" && args[i + 1]) {
    targetPort = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "-e" && args[i + 1]) {
    editorPort = parseInt(args[i + 1], 10);
    i++;
  }
}

startServer({ targetPort, editorPort, projectRoot: process.cwd() });
