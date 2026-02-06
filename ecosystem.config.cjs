module.exports = {
  apps: [{
    name: 'atraniru',
    script: 'dist/server/entry.mjs',
    cwd: '/home/greg/atraniru',
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 4321,
      MESSAGE_QUEUE_DIR: '/home/greg/atraniru/data/queue',
    },
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Logs
    error_file: '/home/greg/atraniru/logs/error.log',
    out_file: '/home/greg/atraniru/logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
