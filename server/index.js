import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp(config);
app.server.listen(config.port, config.host, () => {
  process.stdout.write(JSON.stringify({ event: 'listening', url: `http://${config.host}:${config.port}`, ready: Boolean(config.apiKey) }) + '\n');
});
app.server.on('error', error => {
  process.stderr.write(JSON.stringify({ event: 'startup_failed', code: error.code }) + '\n');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
