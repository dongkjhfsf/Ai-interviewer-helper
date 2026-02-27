module.exports = {
  apps: [
    {
      name: 'jobinterviewer',
      script: './node_modules/.bin/tsx',
      args: 'server.ts',
      cwd: '/projects/jobinterviewer',
      env_production: {
        NODE_ENV: 'production',
      },
      // Dev mode with watch (auto-restart on file changes)
      env_development: {
        NODE_ENV: 'development',
      },
      // Watch only server-side files (exclude frontend source & dist)
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'src'],
      // Auto-restart on crash
      autorestart: true,
      // Max 10 consecutive restarts within 15s before marking as errored
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 1000,
      // Log output
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Keep logs for 7 days (requires pm2-logrotate)
      max_size: '50M',
      retain: 7,
    },
  ],
};
