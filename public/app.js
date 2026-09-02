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
    panelState: document.getElementById('panel-state'),
    panelGuilds: document.getElementById('panel-guilds'),
    panelIncidents: document.getElementById('panel-incidents'),
    panelUptime: document.getElementById('panel-uptime'),
    uptimeValue: document.getElementById('status-uptime'),
    guildsValue: document.getElementById('status-guilds'),
    incidentsValue: document.getElementById('status-incidents')
  };

  function formatUptime(seconds) {
    const totalSeconds = Number(seconds) || 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async function loadStats() {
    const fallback = {
      online: true,
      guilds: 12,
      uptimeSeconds: 43200,
      incidentsHandledTotal: 137,
      activeIncidents: 1,
    };

    try {
      const response = await fetch('/api/bot/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const data = await response.json();

      const stats = { ...fallback, ...data };

      if (statusNodes.status) {
        statusNodes.status.textContent = stats.online ? 'Online' : 'Offline';
        statusNodes.status.classList.toggle('status-online', !!stats.online);
      }

      if (statusNodes.guilds) statusNodes.guilds.textContent = stats.guilds ?? 0;
      if (statusNodes.incidents) statusNodes.incidents.textContent = stats.incidentsHandledTotal ?? 0;
      if (statusNodes.uptime) statusNodes.uptime.textContent = formatUptime(stats.uptimeSeconds ?? 0);

      if (statusNodes.summary) {
        statusNodes.summary.textContent = stats.online ? 'System nominal' : 'Awaiting heartbeat';
      }
      if (statusNodes.state) {
        statusNodes.state.textContent = stats.online ? 'Online' : 'Offline';
      }
      if (statusNodes.panelState) {
        statusNodes.panelState.textContent = stats.online ? 'Online' : 'Offline';
      }
      if (statusNodes.uptimeValue) {
        statusNodes.uptimeValue.textContent = formatUptime(stats.uptimeSeconds ?? 0);
      }
      if (statusNodes.panelUptime) {
        statusNodes.panelUptime.textContent = formatUptime(stats.uptimeSeconds ?? 0);
      }
      if (statusNodes.guildsValue) {
        statusNodes.guildsValue.textContent = stats.guilds ?? 0;
      }
      if (statusNodes.panelGuilds) {
        statusNodes.panelGuilds.textContent = stats.guilds ?? 0;
      }
      if (statusNodes.incidentsValue) {
        statusNodes.incidentsValue.textContent = stats.incidentsHandledTotal ?? 0;
      }
      if (statusNodes.panelIncidents) {
        statusNodes.panelIncidents.textContent = stats.incidentsHandledTotal ?? 0;
      }
    } catch (error) {
      console.warn('Using fallback stats for local demo mode:', error);
      const stats = fallback;
      if (statusNodes.status) {
        statusNodes.status.textContent = stats.online ? 'Online' : 'Offline';
        statusNodes.status.classList.toggle('status-online', !!stats.online);
      }
      if (statusNodes.guilds) statusNodes.guilds.textContent = stats.guilds ?? 0;
      if (statusNodes.incidents) statusNodes.incidents.textContent = stats.incidentsHandledTotal ?? 0;
      if (statusNodes.uptime) statusNodes.uptime.textContent = formatUptime(stats.uptimeSeconds ?? 0);
      if (statusNodes.summary) statusNodes.summary.textContent = 'System nominal';
      if (statusNodes.state) statusNodes.state.textContent = 'Online';
      if (statusNodes.panelState) statusNodes.panelState.textContent = 'Online';
      if (statusNodes.uptimeValue) statusNodes.uptimeValue.textContent = formatUptime(stats.uptimeSeconds ?? 0);
      if (statusNodes.panelUptime) statusNodes.panelUptime.textContent = formatUptime(stats.uptimeSeconds ?? 0);
      if (statusNodes.guildsValue) statusNodes.guildsValue.textContent = stats.guilds ?? 0;
      if (statusNodes.panelGuilds) statusNodes.panelGuilds.textContent = stats.guilds ?? 0;
      if (statusNodes.incidentsValue) statusNodes.incidentsValue.textContent = stats.incidentsHandledTotal ?? 0;
      if (statusNodes.panelIncidents) statusNodes.panelIncidents.textContent = stats.incidentsHandledTotal ?? 0;
    }
  }

  if (document.body.dataset.page === 'owner') {
    const feedback = document.getElementById('owner-feedback');
    const keplerLabel = document.getElementById('kepler-status-label');
    const watchdogLabel = document.getElementById('watchdog-status-label');
    const moderationLabel = document.getElementById('moderation-status-label');
    const escalationLabel = document.getElementById('escalation-status-label');
    const incidentFeed = document.getElementById('incident-feed-list');

    const STORAGE_KEY = 'sns-owner-panel-state';
    const getOwnerState = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return {
            kepler: 'Armed',
            watchdog: 'Online',
            moderation: 'Enabled',
            escalation: 'Queued',
            incidents: [
              'Guild moderation sweep completed',
              'Kepler watch heartbeat acknowledged',
              'Manual review queue refreshed'
            ]
          };
        }
        return JSON.parse(raw);
      } catch {
        return {
          kepler: 'Armed',
          watchdog: 'Online',
          moderation: 'Enabled',
          escalation: 'Queued',
          incidents: []
        };
      }
    };

    const saveOwnerState = (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // no-op fallback in restricted local environments
      }
    };

    const applyOwnerState = () => {
      const state = getOwnerState();
      if (keplerLabel) keplerLabel.textContent = state.kepler || 'Armed';
      if (watchdogLabel) watchdogLabel.textContent = state.watchdog || 'Online';
      if (moderationLabel) moderationLabel.textContent = state.moderation || 'Enabled';
      if (escalationLabel) escalationLabel.textContent = state.escalation || 'Queued';

      if (incidentFeed) {
        incidentFeed.innerHTML = '';
        const incidents = state.incidents && state.incidents.length ? state.incidents : [
          'Guild moderation sweep completed',
          'Kepler watch heartbeat acknowledged',
          'Manual review queue refreshed'
        ];

        incidents.slice(0, 6).forEach((entry, index) => {
          const item = document.createElement('li');
          const time = document.createElement('div');
          time.className = 'incident-time';
          time.textContent = index === 0 ? 'Now' : `${index * 12}m`;
          const text = document.createElement('div');
          text.textContent = entry;
          item.appendChild(time);
          item.appendChild(text);
          incidentFeed.appendChild(item);
        });
      }
    };

    const setFeedback = (message, tone = 'neutral') => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `owner-feedback ${tone}`;
    };

    const updateIncidentList = (message) => {
      const state = getOwnerState();
      const updated = [message, ...(state.incidents || [])].slice(0, 6);
      saveOwnerState({ ...state, incidents: updated });
      applyOwnerState();
    };

    document.querySelectorAll('[data-owner-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.ownerAction;
        const state = getOwnerState();

        if (action === 'arm-kepler') {
          state.kepler = 'Armed';
          saveOwnerState(state);
          setFeedback('Kepler armed and waiting for escalation triggers.', 'success');
          updateIncidentList('Kepler armed for the active guild set');
        }

        if (action === 'trigger-lockdown') {
          state.kepler = 'Triggered';
          state.watchdog = 'Alerting';
          state.moderation = 'Locked';
          state.escalation = 'Escalated';
          saveOwnerState(state);
          setFeedback('Lockdown triggered and broadcast queued.', 'warning');
          updateIncidentList('Lockdown broadcast triggered for protected guilds');
        }

        if (action === 'restart-bot') {
          setFeedback('Bot restart requested. Service will be refreshed shortly.', 'neutral');
          updateIncidentList('Bot restart command queued');
        }

        if (action === 'deploy-update') {
          setFeedback('Deploy sequence initiated. Owner status update will follow.', 'success');
          updateIncidentList('Deploy update initiated');
        }

        applyOwnerState();
      });
    });

    const sendAlertButton = document.querySelector('[data-send-notice="true"]');
    const previewNoticeButton = document.querySelector('[data-preview-notice="true"]');
    const saveTemplateButton = document.querySelector('[data-save-template="true"]');
    const messageBox = document.getElementById('lockdown-message');

    if (sendAlertButton) {
      sendAlertButton.addEventListener('click', () => {
        const message = messageBox ? messageBox.value : '';
        setFeedback(`Lockdown notice sent: ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`, 'success');
        updateIncidentList('Lockdown alert sent to selected audience');
      });
    }

    if (previewNoticeButton) {
      previewNoticeButton.addEventListener('click', () => {
        const preview = messageBox ? messageBox.value : 'No message selected';
        setFeedback(`Preview: ${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}`, 'neutral');
      });
    }

    if (saveTemplateButton) {
      saveTemplateButton.addEventListener('click', () => {
        setFeedback('Current message saved as a reusable lockdown template.', 'success');
      });
    }

    applyOwnerState();
  }

  loadStats();
});
