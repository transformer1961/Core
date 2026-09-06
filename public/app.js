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

    const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[character]));

    const formatRelativeTime = (timestamp) => {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return '';
      const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
      if (seconds < 60) return 'now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    };

    const setStatusValue = (element, text, tone) => {
      if (!element) return;
      element.textContent = text;
      element.classList.remove('success', 'pending', 'danger');
      if (tone) element.classList.add(tone);
    };

    // Live overview — one fetch fills the overview, bot health, posture,
    // event feed, and per-bot protection panels with real data.
    const loadOwnerOverview = async () => {
      const data = await fetch('/api/owner/overview', { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) throw new Error(`Overview unavailable (${response.status})`);
        return response.json();
      });

      // Overview metrics
      const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
      setText('owner-bots-online', `${data.counts.online}/${data.counts.total}`);
      setText('owner-guild-count', data.counts.totalGuilds);
      setText('owner-active-incidents', data.counts.activeIncidents);
      setText('owner-queued-commands', data.security.queuedCommands);

      const pendingChip = document.getElementById('overview-pending-chip');
      if (pendingChip) {
        pendingChip.hidden = data.counts.pending === 0;
        pendingChip.textContent = `${data.counts.pending} pending approval`;
      }

      // Bot health list
      const healthList = document.getElementById('bot-health-list');
      if (healthList) {
        healthList.innerHTML = data.bots.length
          ? data.bots.map((bot) => `<div class="table-row"><span><strong>${escapeHtml(bot.name)}</strong> <span class="bot-id">${escapeHtml(bot.botId)}</span></span><strong class="bot-health ${escapeHtml(bot.health)}">${escapeHtml(bot.health)}</strong></div>`).join('')
          : '<p class="empty-state">No bots registered yet.</p>';
      }

      // Security posture
      const posture = data.security;
      setStatusValue(document.getElementById('posture-delivery'), posture.globallyDisabled ? 'Disabled globally' : 'Enabled', posture.globallyDisabled ? 'danger' : 'success');
      setStatusValue(document.getElementById('posture-pending'), String(posture.pendingApprovals), posture.pendingApprovals > 0 ? 'pending' : 'success');
      setStatusValue(document.getElementById('posture-stale'), String(posture.staleBots), posture.staleBots > 0 ? 'pending' : 'success');
      setStatusValue(document.getElementById('posture-offline'), String(posture.offlineActiveBots), posture.offlineActiveBots > 0 ? 'danger' : 'success');
      setStatusValue(document.getElementById('posture-access'), `${data.session.role} · ${data.session.permissions.length || 'all'} permission(s)`, 'success');

      const postureChip = document.getElementById('posture-chip');
      if (postureChip) {
        const issues = (posture.globallyDisabled ? 1 : 0) + posture.pendingApprovals + posture.staleBots + posture.offlineActiveBots;
        postureChip.textContent = issues === 0 ? 'All clear' : `${issues} to review`;
        postureChip.classList.toggle('danger', issues > 0);
      }

      // Real event feed
      if (incidentFeed) {
        incidentFeed.innerHTML = data.events.length
          ? data.events.slice(0, 8).map((entry) => {
            const item = document.createElement('li');
            const time = document.createElement('div');
            time.className = 'incident-time';
            time.textContent = formatRelativeTime(entry.timestamp);
            const text = document.createElement('div');
            text.textContent = entry.message || entry.event;
            item.appendChild(time);
            item.appendChild(text);
            return item;
          }).reduce((fragment, item) => { fragment.appendChild(item); return fragment; }, document.createDocumentFragment())
          : '<li><div class="incident-time">–</div><div>No events reported yet.</div></li>';
      }

      // Per-bot protection panel follows the selected bot in the dropdown.
      const selectedBotId = botSelect?.value;
      const selected = data.bots.find((bot) => bot.botId === selectedBotId) || data.bots[0];
      if (selected) {
        setStatusValue(keplerLabel, selected.keplerStatus, selected.keplerStatus === 'triggered' ? 'danger' : 'success');
        setStatusValue(watchdogLabel, selected.health, selected.health === 'online' ? 'success' : selected.health === 'stale' ? 'pending' : 'danger');
        setStatusValue(moderationLabel, formatUptime(selected.uptimeSeconds), 'success');
        setStatusValue(escalationLabel, selected.latencyMs == null ? '–' : `${selected.latencyMs} ms`, 'success');
      }
    };

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
      loadOwnerOverview().catch(() => {});
    };

    const loadBots = async () => {
      if (!botSelect || !botList) return;
      try {
        const response = await fetch('/api/bots', { credentials: 'same-origin' });
        if (response.status === 401) {
          botSelect.innerHTML = '<option value="">Sign in to load bots</option>';
          botList.innerHTML = '<p class="empty-state">Sign in with Discord to manage registered bots.</p>';
          return;
        }
        if (response.status === 403) {
          botSelect.innerHTML = '<option value="">Permission required</option>';
          botList.innerHTML = '<p class="empty-state">Your account does not have the bot.read permission.</p>';
          return;
        }
        if (!response.ok) throw new Error('Failed to load bots');
        const data = await response.json();
        const bots = data.bots || [];
        botSelect.innerHTML = bots.length
          ? bots.map((bot) => `<option value="${escapeHtml(bot.botId)}">${escapeHtml(bot.name)}</option>`).join('')
          : '<option value="">No bots registered</option>';
        botList.innerHTML = bots.length
          ? bots.map((bot) => `<div class="bot-list-item"><div><strong>${escapeHtml(bot.name)}</strong><span class="bot-id">${escapeHtml(bot.botId)}</span><span class="bot-seen">${bot.lastSeenAt ? `Last seen ${escapeHtml(new Date(bot.lastSeenAt).toLocaleString())}` : 'No heartbeat yet'}</span></div><div class="bot-list-meta"><span class="bot-health ${escapeHtml(bot.health || bot.status || 'pending')}">${escapeHtml(bot.health || bot.status || 'pending')}</span>${['owner', 'admin'].includes(sessionRole) && bot.status === 'pending' ? `<button type="button" class="bot-review approve" data-bot-review="active" data-bot-id="${escapeHtml(bot.botId)}">Approve</button><button type="button" class="bot-review deny" data-bot-review="denied" data-bot-id="${escapeHtml(bot.botId)}">Deny</button>` : ''}${sessionRole === 'owner' && bot.status === 'active' ? `<button type="button" class="bot-review" data-bot-credential="rotate" data-bot-id="${escapeHtml(bot.botId)}">Rotate</button><button type="button" class="bot-review deny" data-bot-credential="revoke" data-bot-id="${escapeHtml(bot.botId)}">Revoke</button>` : ''}${sessionRole === 'owner' ? `<button type="button" class="bot-review deny" data-bot-remove="true" data-bot-id="${escapeHtml(bot.botId)}">Remove</button>` : ''}</div></div>`).join('')
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

    document.querySelectorAll('[data-owner-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.ownerAction;

        if (action === 'arm-kepler') {
          try { await queueCommand('enable'); } catch (error) { setFeedback(error.message, 'warning'); return; }
          setFeedback('Kepler armed and waiting for escalation triggers.', 'success');
        }

        if (action === 'trigger-lockdown') {
          try { await queueCommand('trigger_lockdown', true); } catch (error) { setFeedback(error.message, 'warning'); return; }
          setFeedback('Lockdown triggered and broadcast queued.', 'warning');
        }

        if (action === 'restart-bot') {
          try { await queueCommand('restart'); } catch (error) { setFeedback(error.message, 'warning'); return; }
          setFeedback('Bot restart requested. Service will be refreshed shortly.', 'neutral');
        }

        if (action === 'shutdown-bot') {
          try { await queueCommand('shutdown', true); } catch (error) { setFeedback(error.message, 'warning'); return; }
        }

        if (action === 'deploy-update') {
          if (!window.confirm('Trigger a new Railway deployment for this bot service?')) return;
          try { await queueCommand('deploy_update', true); } catch (error) { setFeedback(error.message, 'warning'); return; }
          setFeedback('Deploy update queued. Railway will restart the service after the build completes.', 'success');
        }

        loadOwnerOverview().catch(() => {});
      });
    });

    // Changing the bot dropdown re-targets the protection panel.
    if (botSelect) {
      botSelect.addEventListener('change', () => loadOwnerOverview().catch(() => {}));
    }

    const sendAlertButton = document.querySelector('[data-send-notice="true"]');
    const previewNoticeButton = document.querySelector('[data-preview-notice="true"]');
    const saveTemplateButton = document.querySelector('[data-save-template="true"]');
    const messageBox = document.getElementById('lockdown-message');
    const templateSelect = document.getElementById('notification-template');

    const loadTemplates = async () => {
      if (!templateSelect) return;
      try {
        const response = await fetch('/api/notification-templates', { credentials: 'same-origin' });
        if (!response.ok) {
          if (response.status !== 401 && response.status !== 403) setFeedback('Saved templates could not be loaded.', 'warning');
          return;
        }
        const data = await response.json();
        templateSelect.innerHTML = '<option value="">Choose a saved template</option>' + (data.templates || []).map((template) => `<option value="${escapeHtml(template.templateId)}" data-message="${escapeHtml(template.message)}" data-audience="${escapeHtml(template.audience)}" data-channel="${escapeHtml(template.channel)}">${escapeHtml(template.name)}</option>`).join('');
      } catch {
        // Templates are optional while the API is unavailable.
      }
    };

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
          loadOwnerOverview().catch(() => {});
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
      saveTemplateButton.addEventListener('click', async () => {
        const name = window.prompt('Name this notification template:');
        const message = messageBox?.value?.trim();
        if (!name || !message) return;
        try {
          const response = await fetch('/api/notification-templates', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message, audience: document.getElementById('notification-target')?.value, channel: document.getElementById('notification-channel')?.value }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Template could not be saved');
          setFeedback(`Template ${data.template.name} saved.`, 'success');
          await loadTemplates();
        } catch (error) {
          setFeedback(error.message, 'warning');
        }
      });
    }

    if (templateSelect) {
      templateSelect.addEventListener('change', () => {
        const option = templateSelect.selectedOptions[0];
        if (!option?.value) return;
        if (messageBox) messageBox.value = option.dataset.message || '';
        const target = document.getElementById('notification-target');
        const channel = document.getElementById('notification-channel');
        if (target && option.dataset.audience) target.value = option.dataset.audience;
        if (channel && option.dataset.channel) channel.value = option.dataset.channel;
        setFeedback(`Loaded template ${option.textContent}.`, 'neutral');
      });
    }

    window.addEventListener('sns-session-loaded', loadTemplates);

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
        await loadOwnerOverview();
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

    let panelRefreshTimer;
    const refreshPanelData = async () => {
      await Promise.all([loadBots(), loadOwnerOverview(), loadCommandHistory(), loadAuditLog()]);
      markRefreshed();
    };

    panelRefreshTimer = window.setInterval(() => {
      if (!document.hidden) refreshPanelData().catch(() => {});
    }, 15000);

    window.addEventListener('beforeunload', () => {
      window.clearInterval(panelRefreshTimer);
    });

    loadBots();
    loadAccess();
    loadOwnerOverview().catch(() => {});
    loadCommandHistory();
    loadAuditLog();
    loadTemplates();
  }

  loadSession();
  loadStats();
});
