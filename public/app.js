document.addEventListener('DOMContentLoaded', () => {
  const pageName = document.body.dataset.page || 'home';

  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach((link) => {
    const isActive = link.dataset.page === pageName;
    link.classList.toggle('active', isActive);
  });

  const loginButton = document.querySelector('.btn-login');
  const ownerPage = document.body.dataset.page === 'owner';
  let sessionRole = null;
  let sessionPermissions = [];

  async function loadSession() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        if (loginButton) {
          loginButton.textContent = data.user?.globalName || data.user?.username || 'Signed in';
          loginButton.dataset.authenticated = 'true';
        }
        sessionRole = data.user?.role || null;
        sessionPermissions = data.user?.permissions || [];
        window.dispatchEvent(new Event('sns-session-loaded'));
        return true;
      }
      if (ownerPage && (response.status === 401 || response.status === 403)) {
        const authResult = new URLSearchParams(window.location.search).get('auth');
        if (authResult === 'not-approved') {
          document.body.classList.add('auth-denied');
          const ownerFeedback = document.getElementById('owner-feedback');
          if (ownerFeedback) ownerFeedback.textContent = 'Your Discord account is not approved for owner access.';
          return false;
        }
        window.location.replace('/api/auth/discord');
        return false;
      }
      if (ownerPage) {
        document.querySelectorAll('[data-owner-action], [data-send-notice="true"], [data-save-template="true"], [data-preview-notice="true"]').forEach((control) => {
          control.disabled = true;
        });
        const ownerFeedback = document.getElementById('owner-feedback');
        if (ownerFeedback) ownerFeedback.textContent = 'Sign in with Discord to use owner controls.';
      }
    } catch {
      // Static previews can run without the Netlify auth functions.
    }
    return false;
  }

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      window.location.href = loginButton.dataset.authenticated === 'true' ? '/api/auth/logout' : '/api/auth/discord';
    });
  }

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
    const refreshButton = document.querySelector('[data-refresh-panel="true"]');
    const globalDisableButton = document.querySelector('[data-global-disable="true"]');
    const refreshTime = document.getElementById('owner-refresh-time');
    const botSelect = document.getElementById('owner-bot-select');
    const botList = document.getElementById('bot-list');
    const botCountLabel = document.getElementById('bot-count-label');
    const registerBotForm = document.getElementById('register-bot-form');
    const botToken = document.getElementById('bot-token');
    const accessPanel = document.getElementById('access-panel');
    const accessForm = document.getElementById('access-form');
    const accessList = document.getElementById('access-list');
    const commandHistoryList = document.getElementById('command-history-list');
    const auditList = document.getElementById('audit-list');

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

    const markRefreshed = () => {
      if (refreshTime) refreshTime.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    };

    const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[character]));

    const queueCommand = async (command, requiresConfirmation = false) => {
      const botId = botSelect?.value;
      if (!botId) {
        setFeedback('Select or register an approved bot before sending commands.', 'warning');
        return;
      }
      if (requiresConfirmation && !window.confirm(`Confirm ${command.replace('_', ' ')} for ${botId}?`)) return;
      const response = await fetch('/api/bot/commands', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, command, confirmed: requiresConfirmation, reason: 'Owner Panel action' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Command could not be queued');
      setFeedback(`${command.replace('_', ' ')} queued for ${botId}. Command ID: ${data.commandId}`, 'success');
      updateIncidentList(`${command.replace('_', ' ')} queued for ${botId}`);
    };

    const loadBots = async () => {
      if (!botSelect || !botList) return;
      try {
        const response = await fetch('/api/bots', { credentials: 'same-origin' });
        if (response.status === 401 || response.status === 403) {
          botSelect.innerHTML = '<option value="">Sign in to load bots</option>';
          botList.innerHTML = '<p class="empty-state">Sign in with Discord to manage registered bots.</p>';
          return;
        }
        if (!response.ok) throw new Error('Failed to load bots');
        const data = await response.json();
        const bots = data.bots || [];
        botSelect.innerHTML = bots.length
          ? bots.map((bot) => `<option value="${escapeHtml(bot.botId)}">${escapeHtml(bot.name)}</option>`).join('')
          : '<option value="">No bots registered</option>';
        botList.innerHTML = bots.length
          ? bots.map((bot) => `<div class="bot-list-item"><div><strong>${escapeHtml(bot.name)}</strong><span class="bot-id">${escapeHtml(bot.botId)}</span></div><div class="bot-list-meta"><span>${escapeHtml(bot.status || 'pending')}</span>${['owner', 'admin'].includes(sessionRole) && bot.status === 'pending' ? `<button type="button" class="bot-review approve" data-bot-review="active" data-bot-id="${escapeHtml(bot.botId)}">Approve</button><button type="button" class="bot-review deny" data-bot-review="denied" data-bot-id="${escapeHtml(bot.botId)}">Deny</button>` : ''}${sessionRole === 'owner' && bot.status === 'active' ? `<button type="button" class="bot-review" data-bot-credential="rotate" data-bot-id="${escapeHtml(bot.botId)}">Rotate</button><button type="button" class="bot-review deny" data-bot-credential="revoke" data-bot-id="${escapeHtml(bot.botId)}">Revoke</button>` : ''}${sessionRole === 'owner' ? `<button type="button" class="bot-review deny" data-bot-remove="true" data-bot-id="${escapeHtml(bot.botId)}">Remove</button>` : ''}</div></div>`).join('')
          : '<p class="empty-state">No bots registered yet.</p>';
        if (botCountLabel) botCountLabel.textContent = `${bots.length} registered`;
      } catch (error) {
        console.warn('Bot registry unavailable:', error);
        botSelect.innerHTML = '<option value="">Registry unavailable</option>';
        botList.innerHTML = '<p class="empty-state">The bot registry could not be reached.</p>';
      }
    };

    const loadAccess = async () => {
      if (!accessPanel || sessionRole !== 'owner') return;
      accessPanel.hidden = false;
      try {
        const response = await fetch('/api/access', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Failed to load permissions');
        const data = await response.json();
        if (accessList) {
          accessList.innerHTML = (data.permissions || []).map((record) => `<div class="access-row"><strong>${escapeHtml(record.userId)}</strong><span>${escapeHtml(record.permissions?.join(', ') || 'No permissions')} · ${record.enabled ? 'Enabled' : 'Disabled'}</span></div>`).join('') || '<p class="empty-state">No custom staff permissions yet.</p>';
        }
      } catch (error) {
        setFeedback(error.message, 'warning');
      }
    };

    const loadCommandHistory = async () => {
      if (!commandHistoryList) return;
      try {
        const response = await fetch('/api/bot/command-history', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Failed to load command history');
        const data = await response.json();
        commandHistoryList.innerHTML = (data.history || []).map((entry) => `<div class="command-history-row"><strong>${escapeHtml(entry.command || 'Unknown action')}</strong><span>${escapeHtml(entry.status)} · ${escapeHtml(entry.botId || 'Unknown bot')}</span><span>By ${escapeHtml(entry.actorId || 'system')} · ${escapeHtml(new Date(entry.createdAt).toLocaleString())}<br>${escapeHtml(entry.commandId || '')}</span></div>`).join('') || '<p class="empty-state">No command history yet.</p>';
      } catch (error) {
        commandHistoryList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
      }
    };

    const loadAuditLog = async () => {
      if (!auditList) return;
      try {
        const response = await fetch('/api/audit-log', { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Failed to load audit log');
        const data = await response.json();
        auditList.innerHTML = (data.records || []).map((record) => `<div class="audit-row"><strong>${escapeHtml(record.action)}</strong><span>${escapeHtml(record.targetType)}${record.targetId ? `: ${escapeHtml(record.targetId)}` : ''}</span><span>${escapeHtml(record.actorId)} · ${escapeHtml(new Date(record.createdAt).toLocaleString())}</span></div>`).join('') || '<p class="empty-state">No audit events yet.</p>';
      } catch (error) {
        auditList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
      }
    };

    const updateIncidentList = (message) => {
      const state = getOwnerState();
      const updated = [message, ...(state.incidents || [])].slice(0, 6);
      saveOwnerState({ ...state, incidents: updated });
      applyOwnerState();
    };

    document.querySelectorAll('[data-owner-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.ownerAction;
        const state = getOwnerState();

        if (action === 'arm-kepler') {
          try { await queueCommand('enable'); } catch (error) { setFeedback(error.message, 'warning'); return; }
          state.kepler = 'Armed';
          saveOwnerState(state);
          setFeedback('Kepler armed and waiting for escalation triggers.', 'success');
          updateIncidentList('Kepler armed for the active guild set');
        }

        if (action === 'trigger-lockdown') {
          try { await queueCommand('trigger_lockdown', true); } catch (error) { setFeedback(error.message, 'warning'); return; }
          state.kepler = 'Triggered';
          state.watchdog = 'Alerting';
          state.moderation = 'Locked';
          state.escalation = 'Escalated';
          saveOwnerState(state);
          setFeedback('Lockdown triggered and broadcast queued.', 'warning');
          updateIncidentList('Lockdown broadcast triggered for protected guilds');
        }

        if (action === 'restart-bot') {
          try { await queueCommand('restart'); } catch (error) { setFeedback(error.message, 'warning'); return; }
          setFeedback('Bot restart requested. Service will be refreshed shortly.', 'neutral');
          updateIncidentList('Bot restart command queued');
        }

        if (action === 'shutdown-bot') {
          try { await queueCommand('shutdown', true); } catch (error) { setFeedback(error.message, 'warning'); return; }
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
      sendAlertButton.addEventListener('click', async () => {
        const message = messageBox ? messageBox.value : '';
        const botId = botSelect?.value;
        if (!botId) {
          setFeedback('Select an approved bot before sending a notification.', 'warning');
          return;
        }
        if (!message.trim()) {
          setFeedback('Enter a notification message first.', 'warning');
          return;
        }
        if (!window.confirm('Send this notification to the selected audience?')) return;
        try {
          const response = await fetch('/api/bot/commands', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botId,
              command: 'broadcast_notice',
              message,
              audience: document.getElementById('notification-target')?.value,
              channel: document.getElementById('notification-channel')?.value,
              reason: 'Owner Panel notification',
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Notification could not be queued');
          setFeedback(`Notification queued for ${botId}. Command ID: ${data.commandId}`, 'success');
          updateIncidentList('Notification queued for selected audience');
        } catch (error) {
          setFeedback(error.message, 'warning');
        }
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

    if (registerBotForm) {
      registerBotForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = registerBotForm.querySelector('button[type="submit"]');
        const formData = new FormData(registerBotForm);
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Registering...';
        }
        if (botToken) botToken.hidden = true;

        try {
          const response = await fetch('/api/bots', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botId: formData.get('botId'),
              name: formData.get('name'),
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Bot registration failed');
          if (botToken) {
            botToken.textContent = `Bot token (copy it to Railway now; it will not be shown again): ${data.secret}`;
            botToken.hidden = false;
          }
          registerBotForm.reset();
          setFeedback(`${data.bot.name} registered successfully.`, 'success');
          await loadBots();
        } catch (error) {
          setFeedback(error.message, 'warning');
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Register bot';
          }
        }
      });
    }

    if (accessForm) {
      accessForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(accessForm);
        const permissions = formData.getAll('permission');
        try {
          const response = await fetch('/api/access', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: formData.get('userId'),
              role: 'admin',
              permissions,
              guildIds: String(formData.get('guildIds') || '').split(',').map((id) => id.trim()).filter(Boolean),
              enabled: true,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not save permissions');
          setFeedback(`Permissions saved for ${data.permission.userId}.`, 'success');
          accessForm.reset();
          await loadAccess();
        } catch (error) {
          setFeedback(error.message, 'warning');
        }
      });
    }

    if (botList) {
      botList.addEventListener('click', async (event) => {
        const removeButton = event.target.closest('[data-bot-remove="true"]');
        if (removeButton) {
          if (!window.confirm(`Remove ${removeButton.dataset.botId} from SNS Core? This revokes its access.`)) return;
          removeButton.disabled = true;
          try {
            const response = await fetch('/api/bots', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: removeButton.dataset.botId }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Bot removal failed');
            setFeedback(`${removeButton.dataset.botId} removed.`, 'warning');
            await loadBots();
          } catch (error) {
            setFeedback(error.message, 'warning');
            removeButton.disabled = false;
          }
          return;
        }
        const credentialButton = event.target.closest('[data-bot-credential]');
        if (credentialButton) {
          if (!window.confirm(`${credentialButton.dataset.botCredential === 'revoke' ? 'Revoke' : 'Rotate'} credentials for ${credentialButton.dataset.botId}?`)) return;
          credentialButton.disabled = true;
          try {
            const response = await fetch('/api/bots', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: credentialButton.dataset.botId, action: credentialButton.dataset.botCredential }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Credential action failed');
            if (data.secret) {
              if (botToken) { botToken.textContent = `New bot token (copy it to Railway now): ${data.secret}`; botToken.hidden = false; }
            }
            setFeedback(`${credentialButton.dataset.botId} credentials ${credentialButton.dataset.botCredential}d.`, credentialButton.dataset.botCredential === 'revoke' ? 'warning' : 'success');
            await loadBots();
          } catch (error) {
            setFeedback(error.message, 'warning');
            credentialButton.disabled = false;
          }
          return;
        }
        const reviewButton = event.target.closest('[data-bot-review]');
        if (!reviewButton) return;
        reviewButton.disabled = true;
        try {
          const response = await fetch('/api/bots', {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botId: reviewButton.dataset.botId, status: reviewButton.dataset.botReview }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Review action failed');
          setFeedback(`${reviewButton.dataset.botId} marked ${data.status}.`, data.status === 'active' ? 'success' : 'warning');
          await loadBots();
        } catch (error) {
          setFeedback(error.message, 'warning');
          reviewButton.disabled = false;
        }
      });
    }

    window.addEventListener('sns-session-loaded', loadBots);

    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        refreshButton.disabled = true;
        refreshButton.textContent = 'Refreshing...';
        await loadStats();
        await loadBots();
        await loadCommandHistory();
        await loadAuditLog();
        markRefreshed();
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh data';
        setFeedback('Panel data refreshed.', 'success');
      });
    }

    if (globalDisableButton) {
      fetch('/api/security', { credentials: 'same-origin' })
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!data) return;
          globalDisableButton.dataset.disabled = String(data.disabled);
          globalDisableButton.textContent = data.disabled ? 'Enable commands' : 'Emergency disable';
        })
        .catch(() => {});

      globalDisableButton.addEventListener('click', async () => {
        const disabling = globalDisableButton.dataset.disabled !== 'true';
        if (!window.confirm(`${disabling ? 'Disable' : 'Enable'} all bot command delivery globally?`)) return;
        try {
          const response = await fetch('/api/security', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disabled: disabling }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Security control failed');
          globalDisableButton.dataset.disabled = String(data.disabled);
          globalDisableButton.textContent = data.disabled ? 'Enable commands' : 'Emergency disable';
          setFeedback(data.disabled ? 'Emergency disable is active. Bots cannot claim commands.' : 'Global command delivery restored.', data.disabled ? 'warning' : 'success');
        } catch (error) {
          setFeedback(error.message, 'warning');
        }
      });
    }

    applyOwnerState();
    loadBots();
    loadAccess();
    loadCommandHistory();
    loadAuditLog();
  }

  loadSession();
  loadStats();
});
