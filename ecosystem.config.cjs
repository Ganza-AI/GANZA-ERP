module.exports = {
  apps: [{
    name: 'ganza-erp',
    script: 'cmd',
    args: '/c npm run dev',
    exec_mode: 'fork'
  }]
};