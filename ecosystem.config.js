export const apps = [
  {
    name: 'social-meetup-api',
    script: './src/index.js', // Your server's entry point
    instances: '4', // Create as many instances as there are CPU cores
    exec_mode: 'cluster', // Run in cluster mode
    watch: ['src'], // Automatically restart on file changes in 'src'
    ignore_watch: ['node_modules'],
    args: "attach",
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
  },
];