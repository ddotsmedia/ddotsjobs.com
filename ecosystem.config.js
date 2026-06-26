// PM2 process config for ddotsjobs.
// Never `pm2 restart` directly — use /opt/ddotsjobs/deploy.sh which calls `pm2 reload`.
module.exports = {
  apps: [
    {
      name: 'ddotsjobs-web',
      cwd: '/opt/ddotsjobs',
      // Next standalone server (see next.config.ts output: 'standalone').
      // Plain Node server → PM2 cluster shares the listen socket on :3100.
      script: 'apps/web/.next/standalone/apps/web/server.js',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        // 3100 is occupied by another project (ayurconnect-web); 3107 verified free.
        PORT: '3107',
        HOSTNAME: '127.0.0.1',
      },
      error_file: '/var/log/ddotsjobs/web-error.log',
      out_file: '/var/log/ddotsjobs/web-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'ddotsjobs-worker',
      cwd: '/opt/ddotsjobs/apps/worker',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/ddotsjobs/worker-error.log',
      out_file: '/var/log/ddotsjobs/worker-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
