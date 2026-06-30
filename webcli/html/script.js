const departments = [
    { id: 'strategy', name: 'Strategy', head: 'Strategy Head', icon: '🎯' },
    { id: 'engineering', name: 'Engineering', head: 'CTO', icon: '🏗️' },
    { id: 'growth', name: 'Growth', head: 'CMO', icon: '📈' },
    { id: 'revenue', name: 'Revenue', head: 'CRO', icon: '💰' },
    { id: 'operations', name: 'Operations', head: 'Head of Ops', icon: '⚙️' },
    { id: 'security', name: 'Security', head: 'CISO', icon: '🛡️' },
    { id: 'data', name: 'Data', head: 'CDO', icon: '📊' }
];

const specialists = [
    { name: 'QA Specialist', dept: 'Engineering', key: 'qa' },
    { name: 'Frontend Architect', dept: 'Engineering', key: 'frontend' },
    { name: 'SEO Strategist', dept: 'Growth', key: 'seo' },
    { name: 'CRO Specialist', dept: 'Growth', key: 'cro' },
    { name: 'Finance Analyst', dept: 'Operations', key: 'finance' },
    { name: 'Customer Success', dept: 'Operations', key: 'cs' },
    { name: 'Blue Team', dept: 'Security', key: 'blue' },
    { name: 'Data Scientist', dept: 'Data', key: 'data' }
];

const healthChecks = [
    { name: 'AI Gateway', status: 'pass', detail: 'OpenAI/Anthropic Connected' },
    { name: 'Browser Automation', status: 'pass', detail: 'Playwright 1.44.0 (Chromium)' },
    { name: 'Image Intelligence', status: 'pass', detail: 'rembg python package available' },
    { name: 'Corporate Wiki', status: 'pass', detail: 'Connected to SuperMemory' },
    { name: 'Ubiquity Daemon', status: 'warn', detail: 'Inactive; run zilmate daemon start' },
    { name: 'FFmpeg', status: 'pass', detail: 'Multimedia tools enabled' }
];

const models = [
    { id: 'gpt-4o', provider: 'OpenAI', status: 'Ready' },
    { id: 'claude-3-5-sonnet', provider: 'Anthropic', status: 'Ready' },
    { id: 'gemini-1.5-pro', provider: 'Google', status: 'Ready' },
    { id: 'llama-3.1-70b', provider: 'Groq', status: 'Active' }
];

const cameraDevices = [
    { name: 'FaceTime HD Camera', input: '0' },
    { name: 'Logitech C920', input: '1' }
];

const apps = [
    { name: 'GitHub', toolkit: 'github', status: 'Linked', icon: '🐙' },
    { name: 'Slack', toolkit: 'slack', status: 'Linked', icon: '💬' },
    { name: 'Stripe', toolkit: 'stripe', status: 'Linked', icon: '💳' },
    { name: 'HubSpot', toolkit: 'hubspot', status: 'Available', icon: '🧡' },
    { name: 'Gmail', toolkit: 'google_mail', status: 'Available', icon: '📧' }
];

const state = {
    activeTab: 'chat',
    traces: [],
    sessionStarted: Date.now()
};

// Selectors
const chatOutput = document.getElementById('chat-output');
const chatInput = document.getElementById('chat-input');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-container');
const pageTitle = document.querySelector('.page-title');

function init() {
    navItems.forEach(item => {
        item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            handleUserMessage(chatInput.value.trim());
            chatInput.value = '';
        }
    });

    switchTab('chat');
    addMessage('bot', "ZilMate Swarm Command Center v3.5 initialized. Ready to orchestrate the Digital Corporation for your task.");

    // Animate Waveform
    setInterval(animateWaveform, 100);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    navItems.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === tabId));

    views.forEach(view => {
        if (view.id === `view-${tabId}`) {
            view.classList.remove('hidden');
        } else if (view.id === 'view-other' && !document.getElementById(`view-${tabId}`)) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    });

    const titles = {
        chat: 'Talk to ZilMate', swarm: 'Digital Corporation Hierarchy',
        traces: 'Live Swarm Execution Traces', apps: 'Composio Toolkits',
        mcp: 'Model Context Protocol Servers', skills: 'Agent Specialized Skills',
        triggers: 'Event Workflow Triggers', jobs: 'Background Job Scheduler',
        memory: 'Corporate Memory Banks', wiki: 'Intelligence Blackboard',
        doctor: 'System Health Diagnostics', setup: 'System Configuration',
        voice: 'Realtime Voice Interface', camera: 'Camera & Vision Tools',
        models: 'Available AI Models'
    };
    pageTitle.innerText = titles[tabId] || 'Command Center';

    if (tabId === 'swarm') renderSwarm();
    if (tabId === 'doctor') renderDoctor();
    if (tabId === 'traces') renderTraces();
    if (tabId === 'apps') renderApps();
    if (tabId === 'models') renderModels();
    if (tabId === 'camera') renderCamera();
    if (tabId === 'voice') renderVoice();
}

function handleUserMessage(text) {
    addMessage('user', text);
    if (text.toLowerCase().includes('update')) {
        document.getElementById('update-banner').classList.remove('hidden');
        addSystemLine("ZilMate checking for updates... v3.5.1 available.");
    }
    simulateOrchestration(text);
}

function renderModels() {
    const list = document.getElementById('models-list');
    list.innerHTML = '';
    models.forEach(m => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--outline-variant)';
        tr.innerHTML = `
            <td style="padding: 16px 24px; font-size: 14px; font-weight: 600;">${m.id}</td>
            <td style="padding: 16px 24px; font-size: 14px; color: var(--on-surface-variant);">${m.provider}</td>
            <td style="padding: 16px 24px;"><span class="card-status bg-ok">${m.status}</span></td>
        `;
        list.appendChild(tr);
    });
}

function renderCamera() {
    const grid = document.getElementById('camera-devices-grid');
    grid.innerHTML = '';
    cameraDevices.forEach(d => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.innerHTML = `<div><strong>${d.name}</strong><div style="font-size: 11px;">Input ID: ${d.input}</div></div><span class="card-status bg-ok">READY</span>`;
        grid.appendChild(card);
    });
}

function renderVoice() {
    const grid = document.getElementById('voice-config-grid');
    grid.innerHTML = '';
    const config = [['Deepgram', 'Enabled'], ['Latency', 'Low'], ['Barge-in', 'Yes'], ['Speaker', 'Stream']];
    config.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<strong>${c[0]}</strong><div style="font-size: 11px;">${c[1]}</div>`;
        grid.appendChild(card);
    });
}

function animateWaveform() {
    const wf = document.getElementById('waveform');
    if (!wf) return;
    wf.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        const h = Math.random() * 30 + 10;
        bar.style.width = '4px';
        bar.style.height = `${h}px`;
        bar.style.background = 'var(--primary-light)';
        bar.style.borderRadius = '2px';
        wf.appendChild(bar);
    }
}

// Reuse previous render functions
function renderSwarm() {
    const grid = document.getElementById('swarm-grid');
    grid.innerHTML = '';
    departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'card';
        const deptSpecs = specialists.filter(s => s.dept === dept.name);
        card.innerHTML = `
            <div class="card-head"><span class="card-title">${dept.icon} ${dept.name}</span> <span class="card-status bg-ok">ONLINE</span></div>
            <div style="margin-bottom: 12px; font-size: 12px; font-weight: 700; color: var(--primary);">HEAD: ${dept.head}</div>
            <div class="spec-list">
                ${deptSpecs.map(s => `<div class="spec-item"><span class="spec-name">${s.name}</span> <span class="card-status" style="font-size: 9px; opacity: 0.6;">IDLE</span></div>`).join('')}
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderDoctor() {
    const grid = document.getElementById('doctor-grid');
    grid.innerHTML = '';
    healthChecks.forEach(check => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px"><span>${check.status === 'pass' ? '🟢' : '🟡'}</span><div><strong>${check.name}</strong><div style="font-size: 11px;">${check.detail}</div></div></div>
            <span class="card-status bg-${check.status}">${check.status.toUpperCase()}</span>
        `;
        grid.appendChild(card);
    });
}

function renderTraces() {
    const container = document.getElementById('trace-container');
    container.innerHTML = '';
    if (state.traces.length === 0) {
        container.innerHTML = '<div id="no-traces" style="text-align: center; padding: 40px; color: var(--outline);">No active traces.</div>';
        return;
    }
    state.traces.forEach(span => {
        const node = document.createElement('div');
        node.className = 'trace-node active';
        node.innerHTML = `
            <div class="trace-header"><strong>${span.name}</strong> <span class="trace-time">${new Date(span.startedAt).toLocaleTimeString()}</span></div>
            <div class="trace-task">${span.task}</div>
            <div class="trace-events">${span.events.map(ev => `<div class="event-item ${ev.type}">${ev.label}: ${ev.detail}</div>`).join('')}</div>
        `;
        container.appendChild(node);
    });
}

function addMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `msg msg-${role}`;
    msg.innerHTML = `<div class="avatar">${role === 'bot' ? 'Z' : 'U'}</div><div class="bubble">${text}</div>`;
    chatOutput.appendChild(msg);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function addSystemLine(text) {
    const line = document.createElement('div');
    line.className = 'sys-line';
    line.innerText = text;
    chatOutput.appendChild(line);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

async function simulateOrchestration(task) {
    addSystemLine(`COO initiating orchestration for: "${task}"`);
    const ctoSpan = addTrace('coo', 'COO', 'Strategy', `Orchestrating task: ${task}`);
    await sleep(800); addEvent(ctoSpan, 'tool_call', 'readCorporateContext', 'Reading strategic alignment');
    await sleep(1000); const engSpan = addTrace('cto', 'CTO', 'Engineering', 'Analyzing requirements');
    await sleep(2000); addMessage('bot', "The Swarm has completed the initial analysis. Ready to proceed.");
}

function addTrace(agentKey, name, dept, task) {
    const span = { id: Math.random().toString(36).substr(2, 9), agentKey, name, dept, task, events: [], startedAt: Date.now() };
    state.traces.unshift(span);
    if (state.activeTab === 'traces') renderTraces();
    return span;
}

function addEvent(span, type, label, detail) {
    span.events.push({ type, label, detail, timestamp: Date.now() });
    if (state.activeTab === 'traces') renderTraces();
}

const sleep = ms => new Promise(res => setTimeout(res, ms));
window.onload = init;
