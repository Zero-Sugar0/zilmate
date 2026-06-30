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

const apps = [
    { name: 'GitHub', toolkit: 'github', status: 'Linked', icon: '🐙' },
    { name: 'Slack', toolkit: 'slack', status: 'Linked', icon: '💬' },
    { name: 'Stripe', toolkit: 'stripe', status: 'Linked', icon: '💳' },
    { name: 'HubSpot', toolkit: 'hubspot', status: 'Available', icon: '🧡' },
    { name: 'Gmail', toolkit: 'google_mail', status: 'Available', icon: '📧' }
];

const mcpServers = [
    { name: 'sequential-thinking', status: 'active', type: 'stdio' },
    { name: 'memory', status: 'active', type: 'stdio' },
    { name: 'filesystem', status: 'active', type: 'stdio' },
    { name: 'playwright', status: 'active', type: 'stdio' },
    { name: 'brave-search', status: 'inactive', type: 'stdio' }
];

const skills = [
    { name: 'ui-ux-pro-max', category: 'Design', level: 'Expert' },
    { name: 'ai-seo', category: 'Growth', level: 'Advanced' },
    { name: 'stripe-best-practices', category: 'Revenue', level: 'Expert' },
    { name: 'security-audit', category: 'Security', level: 'Expert' },
    { name: 'data-storytelling', category: 'Data', level: 'Expert' }
];

const triggers = [
    { name: 'GitHub PR Open', toolkit: 'github', status: 'enabled' },
    { name: 'Stripe Payment Success', toolkit: 'stripe', status: 'enabled' },
    { name: 'Gmail New Invoice', toolkit: 'google_mail', status: 'disabled' }
];

const jobs = [
    { id: 'job_88a2', status: 'completed', task: 'Weekly revenue analysis', schedule: '0 0 * * 1' },
    { id: 'job_bc11', status: 'pending', task: 'Market research audit', schedule: 'manual' },
    { id: 'job_fa44', status: 'failed', task: 'Sync knowledge base', schedule: '0 0 * * *' }
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
        chat: 'Talk to ZilMate',
        swarm: 'Digital Corporation Hierarchy',
        traces: 'Live Swarm Execution Traces',
        apps: 'Composio Toolkits',
        mcp: 'Model Context Protocol Servers',
        skills: 'Agent Specialized Skills',
        triggers: 'Event Workflow Triggers',
        jobs: 'Background Job Scheduler',
        memory: 'Corporate Memory Banks',
        wiki: 'Intelligence Blackboard',
        doctor: 'System Health Diagnostics',
        setup: 'System Configuration'
    };
    pageTitle.innerText = titles[tabId] || 'Command Center';

    if (tabId === 'swarm') renderSwarm();
    if (tabId === 'doctor') renderDoctor();
    if (tabId === 'traces') renderTraces();
    if (tabId === 'apps') renderApps();
    if (tabId === 'mcp') renderMCP();
    if (tabId === 'skills') renderSkills();
    if (tabId === 'triggers') renderTriggers();
    if (tabId === 'jobs') renderJobs();
}

function handleUserMessage(text) {
    addMessage('user', text);
    simulateOrchestration(text);
}

async function simulateOrchestration(task) {
    addSystemLine(`COO initiating orchestration for: "${task}"`);

    const ctoSpan = addTrace('coo', 'COO', 'Strategy', `Orchestrating task: ${task}`);
    await sleep(800);
    addEvent(ctoSpan, 'tool_call', 'readCorporateContext', 'Reading strategic alignment');

    await sleep(1000);
    const engSpan = addTrace('cto', 'CTO', 'Engineering', 'Analyzing technical requirements');
    addEvent(engSpan, 'tool_call', 'list_files', 'Scanning workspace structure');

    await sleep(1200);
    const qaSpan = addTrace('qa', 'QA Specialist', 'Engineering', 'Verifying interface compliance');
    addEvent(qaSpan, 'tool_call', 'browser_open', 'Opening localhost:3000 for audit');

    await sleep(1500);
    addEvent(engSpan, 'collaboration', 'Handoff to CMO', 'Technical specs ready for growth review');

    await sleep(1000);
    const cmoSpan = addTrace('cmo', 'CMO', 'Growth', 'Drafting market positioning');
    addEvent(cmoSpan, 'wiki_publish', 'Market Insight', 'Competitive gap identified in AI-UX segment');

    await sleep(2000);
    addMessage('bot', "The Swarm has completed the initial analysis. CTO and CMO have aligned on the technical strategy and market positioning. Implementation phase triggered.");
}

function addMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `msg msg-${role}`;
    msg.innerHTML = `
        <div class="avatar">${role === 'bot' ? 'Z' : 'U'}</div>
        <div class="bubble">${text}</div>
    `;
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

function addTrace(agentKey, name, dept, task) {
    const span = {
        id: Math.random().toString(36).substr(2, 9),
        agentKey, name, dept, task,
        events: [], startedAt: Date.now()
    };
    state.traces.unshift(span);
    if (state.activeTab === 'traces') renderTraces();
    return span;
}

function addEvent(span, type, label, detail) {
    span.events.push({ type, label, detail, timestamp: Date.now() });
    if (state.activeTab === 'traces') renderTraces();
}

function renderSwarm() {
    const grid = document.getElementById('swarm-grid');
    grid.innerHTML = '';
    departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'card';
        const deptSpecs = specialists.filter(s => s.dept === dept.name);
        card.innerHTML = `
            <div class="card-head">
                <span class="card-title">${dept.icon} ${dept.name}</span>
                <span class="card-status bg-ok">ONLINE</span>
            </div>
            <div style="margin-bottom: 12px; font-size: 12px; font-weight: 700; color: var(--primary);">HEAD: ${dept.head}</div>
            <div class="spec-list">
                ${deptSpecs.map(s => `
                    <div class="spec-item"><span class="spec-name">${s.name}</span> <span class="card-status" style="font-size: 9px; opacity: 0.6;">IDLE</span></div>
                `).join('')}
            </div>
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
            <div class="trace-events">
                ${span.events.map(ev => `<div class="event-item ${ev.type}">${ev.label}: ${ev.detail}</div>`).join('')}
            </div>
        `;
        container.appendChild(node);
    });
}

function renderApps() {
    const grid = document.getElementById('apps-grid');
    grid.innerHTML = '';
    apps.forEach(app => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-head"><span class="card-title">${app.icon} ${app.name}</span> <span class="card-status ${app.status === 'Linked' ? 'bg-ok' : 'bg-warn'}">${app.status.toUpperCase()}</span></div>
            <div style="font-size: 11px; color: var(--outline);">Toolkit: ${app.toolkit}</div>
        `;
        grid.appendChild(card);
    });
}

function renderMCP() {
    const grid = document.getElementById('mcp-grid');
    grid.innerHTML = '';
    mcpServers.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-head"><span class="card-title">🧩 ${s.name}</span> <span class="card-status ${s.status === 'active' ? 'bg-ok' : 'bg-warn'}">${s.status.toUpperCase()}</span></div>
            <div style="font-size: 11px; color: var(--outline);">Type: ${s.type}</div>
        `;
        grid.appendChild(card);
    });
}

function renderSkills() {
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';
    skills.forEach(s => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-head"><span class="card-title">⚡ ${s.name}</span> <span class="card-status bg-ok">${s.level.toUpperCase()}</span></div>
            <div style="font-size: 11px; color: var(--outline);">Category: ${s.category}</div>
        `;
        grid.appendChild(card);
    });
}

function renderTriggers() {
    const grid = document.getElementById('triggers-grid');
    grid.innerHTML = '';
    triggers.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-head"><span class="card-title">🔔 ${t.name}</span> <span class="card-status ${t.status === 'enabled' ? 'bg-ok' : 'bg-error'}">${t.status.toUpperCase()}</span></div>
            <div style="font-size: 11px; color: var(--outline);">Toolkit: ${t.toolkit}</div>
        `;
        grid.appendChild(card);
    });
}

function renderJobs() {
    const grid = document.getElementById('jobs-grid');
    grid.innerHTML = '';
    jobs.forEach(j => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-head"><span class="card-title">📅 ${j.id}</span> <span class="card-status ${j.status === 'completed' ? 'bg-ok' : j.status === 'failed' ? 'bg-error' : 'bg-warn'}">${j.status.toUpperCase()}</span></div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">${j.task}</div>
            <div style="font-size: 11px; color: var(--outline);">Schedule: ${j.schedule}</div>
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

const sleep = ms => new Promise(res => setTimeout(res, ms));
window.onload = init;
