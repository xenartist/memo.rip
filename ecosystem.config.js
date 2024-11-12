module.exports = {
    apps: [{
      name: "memo-rip",
      script: "./server.js",
      args: "80",
      max_memory_restart: "1G"
    }]
  }