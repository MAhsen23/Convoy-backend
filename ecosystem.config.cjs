module.exports = {
  apps: [
    {
      name: "convoy-backend",
      script: "src/server.js",
      cwd: process.env.PROJECT_PATH || `${process.env.HOME}/convoy-backend`,
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      min_uptime: "10s",
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      out_file: `${process.env.PROJECT_PATH || `${process.env.HOME}/convoy-backend`}/logs/pm2-out.log`,
      error_file: `${process.env.PROJECT_PATH || `${process.env.HOME}/convoy-backend`}/logs/pm2-error.log`,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    }
  ]
};

