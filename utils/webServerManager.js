// Shared web server manager for the bot
let webServers = new Map();

module.exports = {
  // Get all running servers
  getAllServers() {
    return webServers;
  },

  // Get server by key
  getServer(key) {
    return webServers.get(key);
  },

  // Add a new server
  addServer(key, serverData) {
    webServers.set(key, serverData);
  },

  // Remove a server
  removeServer(key) {
    const server = webServers.get(key);
    if (server) {
      if (server.server) {
        server.server.close();
      }
      if (server.timeout) {
        clearTimeout(server.timeout);
      }
      webServers.delete(key);
      return true;
    }
    return false;
  },

  // Check if server exists
  hasServer(key) {
    return webServers.has(key);
  },

  // Get server count
  getServerCount() {
    return webServers.size;
  },

  // Clean up expired servers
  cleanupExpiredServers() {
    const now = new Date();
    for (const [key, server] of webServers.entries()) {
      const elapsed = now - server.startTime;
      if (elapsed >= 24 * 60 * 60 * 1000) { // 24 hours
        this.removeServer(key);
      }
    }
  },

  // Get server info for display
  getServerInfo(key) {
    const server = webServers.get(key);
    if (!server) return null;

    const now = new Date();
    const elapsed = now - server.startTime;
    const remaining = Math.max(0, (24 * 60 * 60 * 1000) - elapsed);
    
    return {
      url: server.url,
      websiteName: server.websiteName || 'Unknown',
      category: server.category || 'general',
      startTime: server.startTime,
      elapsed: elapsed,
      remaining: remaining,
      isExpired: remaining === 0
    };
  }
};
