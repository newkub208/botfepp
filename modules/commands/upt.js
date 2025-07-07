const os = require('os');
const { performance } = require('perf_hooks');

module.exports = {
  name: 'upt',
  description: 'Uptime of the bot',
  author: 'NashBot',
  nashPrefix: false,
  version: '1.0.0',
  alias: ['uptime'],
  async execute(api, event, args, prefix, commands) {
    const uptimeMessage = await genStats(api);
    api.sendMessage(uptimeMessage, event.threadID);
  },
};

async function genStats(api) {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);

  const cpuUsage = getCpuUsage();
  const ramUsage = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2);
  const cores = os.cpus().length;
  const ping = await calPing(api);
  const osPlatform = os.platform();
  const cpuArchitecture = os.arch();

  return `BOT has been working for ${hours} hour(s) ${minutes} minute(s) ${seconds} second(s).\n\n` +
    `❖ Cpu usage: ${cpuUsage}%\n` +
    `❖ RAM usage: ${ramUsage} MB\n` +
    `❖ Cores: ${cores}\n` +
    `❖ Ping: ${ping}ms\n` +
    `❖ Operating System Platform: ${osPlatform}\n` +
    `❖ System CPU Architecture: ${cpuArchitecture}`;
}

async function calPing(api) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const http = require('http');
    const req = http.request({
      hostname: '0.0.0.0',
      port: 3000,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }, (res) => {
      const endTime = performance.now();
      const pingTime = Math.round(endTime - startTime);
      resolve(pingTime);
    });

    req.on('error', () => {
      const endTime = performance.now();
      const pingTime = Math.round(endTime - startTime);
      resolve(pingTime);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(5000);
    });

    req.end();
  });
}

function getCpuUsage() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (let cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const total = user + nice + sys + idle + irq;
  const usage = ((total - idle) / total) * 100;

  return usage.toFixed(2);
}
