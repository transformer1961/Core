document.addEventListener('DOMContentLoaded', () => {
  const pageName = document.body.dataset.page || 'home';

  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach((link) => {
    const isActive = link.dataset.page === pageName;
    link.classList.toggle('active', isActive);
  });

  const statusNodes = {
    status: document.getElementById('stat-status'),
    guilds: document.getElementById('stat-guilds'),
    incidents: document.getElementById('stat-incidents'),
    uptime: document.getElementById('stat-uptime'),
    summary: document.getElementById('status-summary'),
    state: document.getElementById('status-state'),
    uptimeValue: document.getElementById('status-uptime'),
    guildsValue: document.getElementById('status-guilds'),
    incidentsValue: document.getElementById('status-incidents')
  };

  async function loadStats() {
    try {
      const response = await fetch('/api/bot/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();

      if (statusNodes.status) {
        statusNodes.status.textContent = data.online ? 'Online' : 'Offline';
        statusNodes.status.classList.toggle('status-online', !!data.online);
      }

      if (statusNodes.guilds) statusNodes.guilds.textContent = data.guilds ?? 0;
      if (statusNodes.incidents) statusNodes.incidents.textContent = data.incidentsHandledTotal ?? 0;
      if (statusNodes.uptime) statusNodes.uptime.textContent = formatUptime(data.uptimeSeconds ?? 0);

      if (statusNodes.summary) {
        statusNodes.summary.textContent = data.online ? 'System nominal' : 'Awaiting heartbeat';
      }
      if (statusNodes.state) {
        statusNodes.state.textContent = data.online ? 'Online' : 'Offline';
      }
      if (statusNodes.uptimeValue) {
        statusNodes.uptimeValue.textContent = formatUptime(data.uptimeSeconds ?? 0);
      }
      if (statusNodes.guildsValue) {
        statusNodes.guildsValue.textContent = data.guilds ?? 0;
      }
      if (statusNodes.incidentsValue) {
        statusNodes.incidentsValue.textContent = data.incidentsHandledTotal ?? 0;
      }
    } catch (error) {
      console.error('Stats load failed', error);
      if (statusNodes.status) {
        statusNodes.status.textContent = 'Unavailable';
        statusNodes.status.classList.remove('status-online');
      }
      if (statusNodes.guilds) statusNodes.guilds.textContent = '—';
      if (statusNodes.incidents) statusNodes.incidents.textContent = '—';
      if (statusNodes.uptime) statusNodes.uptime.textContent = '—';
    }
  }

  function formatUptime(seconds) {
    const totalSeconds = Number(seconds) || 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  loadStats();
});
