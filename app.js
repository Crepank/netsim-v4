// Basic state
let projects = {}; // Store all projects by ID
let currentProjectId = null;
let currentView = { type: 'home' }; // { type: 'project', username, slug, isViewing }
let renameProjectId = null;
let abortController = null;
let discordUsername = 'guest'; // This will now represent the logged-in user or guest
let sidebarView = 'projects'; // 'projects' or 'versions';
let currentOpenFile = null; // Currently open file in the Files tab editor
let isLoggedIn = false;
let selectedAbilities = {}; // 'none', 'llm'
let selectedImages = []; // Stores base64 strings of uploaded images

// Generation sounds
const successSound = new Audio('/success.mp3');
const errorSound = new Audio('/error.mp3');
// Attempt to warm up audio (some browsers require user gesture; this is best-effort)
successSound.preload = 'auto';
errorSound.preload = 'auto';

// Custom Logger
const logger = {
    _log(level, color, ...args) {
        console.log(`%c[${level}]`, `color: ${color}; font-weight: bold;`, ...args);
    },
    debug(...args) {
        this._log('DEBUG', '#7f8c8d', ...args);
    },
    info(...args) {
        this._log('INFO', '#2ecc71', ...args);
    },
    warn(...args) {
        this._log('WARN', '#f39c12', ...args);
    },
    error(...args) {
        this._log('ERROR', '#e74c3c', ...args);
    }
};



// DOM refs
const welcomeEl = document.getElementById('welcome');
const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt-input');
const imagePreviewContainer = document.getElementById('image-preview-container');

const generatingIndicator = document.getElementById('generating-indicator');

const newProjectBtn = document.getElementById('newProjectBtn');
const welcomeNewProjectBtn = document.getElementById('welcomeNewProjectBtn');
const sidebarContent = document.getElementById('sidebar-content');
const sidebarPanel = document.getElementById('sidebar-panel');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const userProfileButton = document.getElementById('user-profile-button');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const projectTitleDisplay = document.getElementById('project-title-display');
const copyUrlBtn = document.getElementById('copy-url-btn');
const previewFrame = document.getElementById('preview-frame');
const browserContainer = document.getElementById('browser-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const shareBtn = document.getElementById('share-btn');
const likeBtn = document.getElementById('like-btn');
const forkBtn = document.getElementById('fork-btn');

// Sidebar Resizing
const sidebarResizer = document.getElementById('sidebar-resizer');
const sidebarRight = document.getElementById('right-sidebar');

// Sidebar Tabs
const tabVersions = document.getElementById('tab-versions');
const tabFiles = document.getElementById('tab-files');
const tabProjects = document.getElementById('tab-projects');
const tabSocial = document.getElementById('tab-social');
const sidebarTitle = document.getElementById('sidebar-title');
const sidebarSubtitle = document.getElementById('sidebar-author');
const sidebarDesc = document.getElementById('sidebar-desc');

// Rail Buttons
const railVersionsBtn = document.getElementById('rail-versions-btn');
const railProjectsBtn = document.getElementById('rail-projects-btn');
const railSocialBtn = document.getElementById('rail-social-btn');

// Experimental Features refs
const experimentalBtn = document.getElementById('experimentalBtn');
const experimentalDropdown = document.getElementById('experimentalDropdown');

// Share Modal refs
const shareModal = document.getElementById('shareModal');
const shareModalContent = document.getElementById('shareModalContent');
const closeShareModalBtn = document.getElementById('closeShareModalBtn');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyShareUrlBtn = document.getElementById('copyShareUrlBtn');
const shareThumbnailPreview = document.getElementById('shareThumbnailPreview');
const updateThumbnailBtn = document.getElementById('updateThumbnailBtn');

// Model Selector refs
const modelSelectorBtn = document.getElementById('modelSelectorBtn');
const modelDropdown = document.getElementById('modelDropdown');
const selectedModelIconContainer = document.getElementById('selectedModelIconContainer');

// Settings Modal refs
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsModalContent = document.getElementById('settingsModalContent');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

// Welcome Modal refs
const welcomeModal = document.getElementById('welcomeModal');
const welcomeModalContent = document.getElementById('welcomeModalContent');
const welcomeModalContinue = document.getElementById('welcomeModalContinue');

// Confirmation Modal refs
const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalContent = document.getElementById('confirmationModalContent');
const confirmationModalTitle = document.getElementById('confirmationModalTitle');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');
const confirmationModalConfirm = document.getElementById('confirmationModalConfirm');
const confirmationModalCancel = document.getElementById('confirmationModalCancel');

// Rename Modal refs
const renameModal = document.getElementById('renameModal');
const renameModalContent = document.getElementById('renameModalContent');
const renameInput = document.getElementById('renameInput');
const renameModalSave = document.getElementById('renameModalSave');
const renameModalCancel = document.getElementById('renameModalCancel');

// Edit Project Modal refs
const editProjectModal = document.getElementById('editProjectModal');
const editProjectModalContent = document.getElementById('editProjectModalContent');
const editProjectTitleInput = document.getElementById('editProjectTitleInput');
const editProjectSlugInput = document.getElementById('editProjectSlugInput');
const editProjectDescriptionInput = document.getElementById('editProjectDescriptionInput');
const editProjectVisibilityBtn = document.getElementById('editProjectVisibilityBtn');
const editProjectVisibilityDropdown = document.getElementById('editProjectVisibilityDropdown');
const editProjectVisibilityLabel = document.getElementById('editProjectVisibilityLabel');
const editProjectModalSave = document.getElementById('editProjectModalSave');
const editProjectModalCancel = document.getElementById('editProjectModalCancel');

// New Project Modal refs
const newProjectModal = document.getElementById('newProjectModal');
const newProjectModalContent = document.getElementById('newProjectModalContent');
const projectTitleInput = document.getElementById('projectTitleInput');
const projectSlugInput = document.getElementById('projectSlugInput');
const projectDescriptionInput = document.getElementById('projectDescriptionInput');
const projectVisibilityBtn = document.getElementById('projectVisibilityBtn');
const projectVisibilityDropdown = document.getElementById('projectVisibilityDropdown');
const projectVisibilityLabel = document.getElementById('projectVisibilityLabel');
const newProjectModalCreate = document.getElementById('newProjectModalCreate');
const newProjectModalCancel = document.getElementById('newProjectModalCancel');

// View Prompt Modal refs
const promptModal = document.getElementById('promptModal');
const promptModalContent = document.getElementById('promptModalContent');
const promptModalText = document.getElementById('promptModalText');
const closePromptModalBtn = document.getElementById('closePromptModalBtn');

// Error Modal refs
const errorModal = document.getElementById('errorModal');
const errorModalContent = document.getElementById('errorModalContent');
const errorModalTitle = document.getElementById('errorModalTitle');
const errorModalMessage = document.getElementById('errorModalMessage');
const errorModalClose = document.getElementById('errorModalClose');
const errorModalRetry = document.getElementById('errorModalRetry');

// Project Info Panel refs
const projectInfoPanel = document.getElementById('project-info-panel');

// Auth Modal refs
const authModal = document.getElementById('authModal');
const authModalContent = document.getElementById('authModalContent');
const authModalTitle = document.getElementById('authModalTitle');
const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleLink = document.getElementById('authToggleLink');
const authErrorMessage = document.getElementById('auth-error-message');
const welcomeLoginBtn = document.getElementById('welcomeLoginBtn');
const settingsLoginBtn = document.getElementById('settingsLoginBtn');
const settingsLoggedOutView = document.getElementById('settings-logged-out-view');
const settingsLoggedInView = document.getElementById('settings-logged-in-view');
const settingsUsernameDisplayMain = document.getElementById('settings-username-display-main');
const settingsUsernameDisplay = document.getElementById('settings-username-display');
const logoutBtn = document.getElementById('logoutBtn');
const changeUsernameInput = document.getElementById('changeUsernameInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const discordLoginBtn = document.getElementById('discordLoginBtn');
const sharePinnedVersionInfo = document.getElementById('share-pinned-version-info');
const pinnedVersionLabel = document.getElementById('pinned-version-label');
const profileProjectBtn = document.getElementById('profileProjectBtn');
const profileProjectDropdown = document.getElementById('profileProjectDropdown');
const profileProjectLabel = document.getElementById('profileProjectLabel');
const resetProfileBtn = document.getElementById('resetProfileBtn');
const homepageProjectInput = document.getElementById('homepageProjectInput');
const resetHomepageBtn = document.getElementById('resetHomepageBtn');
const customInstructionsInput = document.getElementById('customInstructionsInput');
const authModalSubtitle = document.getElementById('authModalSubtitle');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
const avatarUploadInput = document.getElementById('avatarUploadInput');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const settingsBio = document.getElementById('settingsBio');


// --- API Functions ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(`/api/v1${endpoint}`, options);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: `HTTP error! status: ${response.status}` };
            }
            throw new Error(errorData.message || 'An unknown error occurred');
        }
        // Handle cases where the response might be empty (e.g., 204 No Content)
        if (response.status === 204) {
            return { success: true };
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            // Handle non-json responses if necessary, e.g. for file uploads
            return { success: true, data: await response.text() };
        }
    } catch (error) {
        logger.error(`API request to ${endpoint} failed:`, error);
        throw error;
    }
}

// Removed old User Info Panel logic as it's now integrated into the header/subtitle
function updateSidebarHeader(title, author, description) {
    if (sidebarTitle) {
        sidebarTitle.textContent = title;
        sidebarTitle.title = title;
    }
    if (sidebarSubtitle) {
        sidebarSubtitle.textContent = author ? `@${author}` : '';
    }
    
    if (sidebarDesc) {
        if (description) {
            sidebarDesc.textContent = description;
            sidebarDesc.classList.remove('hidden');
        } else {
            sidebarDesc.classList.add('hidden');
        }
    }
}

async function checkUserStatus() {
    try {
        const data = await apiRequest('/me');
        if (data.logged_in) {
            updateLoggedInUI(data.username, data.avatar_url);
            await syncProjectsWithServer();
        } else {
            updateLoggedOutUI();
        }
    } catch (error) {
        logger.error('Failed to check user status:', error);
        updateLoggedOutUI();
    }
}

function updateLoggedInUI(username, avatarUrl) {
    isLoggedIn = true;
    discordUsername = username;
    
    if (settingsUsernameDisplayMain) settingsUsernameDisplayMain.textContent = `@${username}`;
    if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = username;
    if (changeUsernameInput) changeUsernameInput.value = username;

    const defaultAvatar = '/default.webp';
    sidebarAvatar.src = avatarUrl || defaultAvatar;
    settingsAvatarPreview.src = avatarUrl || defaultAvatar;

    settingsLoggedOutView.classList.add('hidden');
    settingsLoggedInView.classList.remove('hidden');
    renderProjectState(); 
}

function updateLoggedOutUI() {
    isLoggedIn = false;
    discordUsername = 'guest';
    // Removed usernameDisplay update
    settingsUsernameDisplay.textContent = 'guest';
    sidebarAvatar.src = '/default.webp';
    
    settingsLoggedOutView.classList.remove('hidden');
    settingsLoggedInView.classList.add('hidden');
    
    loadProjectsFromLocalStorage();
    renderProjectState();
}

async function syncProjectsWithServer() {
    if (!isLoggedIn) return;
    try {
        const data = await apiRequest('/projects');
        if (data.success) {
            projects = data.projects || {};
            saveProjectsToLocalStorage();
            
            const projectIds = Object.keys(projects);
            if (projectIds.length > 0) {
                 // Load most recent project after sync
                currentProjectId = projectIds.sort((a, b) => b - a)[0];
            } else {
                currentProjectId = null;
            }
            renderProjectState();
        }
    } catch (error) {
        showErrorModal('Sync Failed', 'Could not fetch your projects from the server.');
    }
}


// --- Utility Functions ---

function formatTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-us', { month: 'short', day: 'numeric' });
}

function showIframeLoadingAnimation() {
    const loadingHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Generating...</title>
        <style>
            :root { color-scheme: dark; }
            body {
                background-color: #18181b;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                overflow: hidden;
                color: #a1a1aa;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .container {
                text-align: center;
                animation: fade-in 0.5s ease-out;
            }
            @keyframes fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .spinner {
                width: 40px;
                height: 40px;
                position: relative;
                margin: 20px auto;
            }
            .cube1, .cube2 {
                background-color: #60a5fa;
                width: 15px;
                height: 15px;
                position: absolute;
                top: 0;
                left: 0;
                -webkit-animation: sk-cubemove 1.8s infinite ease-in-out;
                animation: sk-cubemove 1.8s infinite ease-in-out;
                border-radius: 2px;
            }
            .cube2 {
                -webkit-animation-delay: -0.9s;
                animation-delay: -0.9s;
            }
            @-webkit-keyframes sk-cubemove {
                25% { -webkit-transform: translateX(25px) rotate(-90deg) scale(0.5) }
                50% { -webkit-transform: translateX(25px) translateY(25px) rotate(-180deg) }
                75% { -webkit-transform: translateX(0px) translateY(25px) rotate(-270deg) scale(0.5) }
                100% { -webkit-transform: rotate(-360deg) }
            }
            @keyframes sk-cubemove {
                25% { 
                    transform: translateX(25px) rotate(-90deg) scale(0.5);
                } 50% { 
                    transform: translateX(25px) translateY(25px) rotate(-179deg);
                } 50.1% { 
                    transform: translateX(25px) translateY(25px) rotate(-180deg);
                } 75% { 
                    transform: translateX(0px) translateY(25px) rotate(-270deg) scale(0.5);
                } 100% { 
                    transform: rotate(-360deg);
                }
            }
            p {
                font-size: 0.875rem;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #71717a;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="spinner">
                <div class="cube1"></div>
                <div class="cube2"></div>
            </div>
            <p>Generating...</p>
        </div>
    </body>
    </html>
    `;
    previewFrame.srcdoc = loadingHtml;
}

  // Model config (added info + pollen requirement for per-model tooltip)
const modelConfig = {
    'GPT-5 Nano': {
        apiName: 'openai-fast',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/openai.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Ultra-fast OpenAI variant optimized for short, low-latency requests — ideal for UI interactions and quick iterations.'
    },
    'GPT-5 Mini': {
        apiName: 'openai',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/openai.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Balanced general-purpose model offering a good mix of speed, cost, and capability for most app tasks.'
    },
    'GPT-5.2': {
        apiName: 'openai-large',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/openai.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Higher-capacity OpenAI model for complex reasoning, multi-step outputs, and larger-context tasks.'
    },
    'Claude Haiku 4.5': {
        apiName: 'claude-fast',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/claude-color.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Lightweight Anthropic Claude tuned for creative writing and safe, succinct responses with good speed.'
    },
    'Claude Sonnet 4.5': {
        apiName: 'claude',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/claude-color.png',
        supportsVision: true,
        requiresPollen: true,
        info: 'Reliable Claude model for longer-form content and nuanced reasoning; often used for thoughtful, safety-conscious outputs.'
    },
    'Claude Opus 4.6': {
        apiName: 'claude-large',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/claude-color.png',
        supportsVision: true,
        requiresPollen: true,
        info: 'High-capacity Claude for advanced reasoning, multi-step planning, and high-quality text generation.'
    },
    'Gemini 2.5 Flash Lite': {
        apiName: 'gemini-fast',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/google-color.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Fast, cost-conscious Gemini variant suitable for many multimodal and conversational use cases.'
    },
    'Gemini 3 Flash': {
        apiName: 'gemini',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/google-color.png',
        supportsVision: true,
        requiresPollen: true,
        info: 'Versatile Gemini model for multimodal tasks and richer reasoning when you need stronger capabilities.'
    },
    'Gemini 3 Pro': {
        apiName: 'gemini-large',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/google-color.png',
        supportsVision: true,
        requiresPollen: true,
        info: 'Top-tier Gemini for the highest-quality multimodal reasoning, long contexts, and demanding tasks.'
    },
    'DeepSeek V3.2': {
        apiName: 'deepseek',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/deepseek-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Search-specialized model optimized for semantic retrieval and high-precision embeddings.'
    },
    'Qwen3 Coder 30B': {
        apiName: 'qwen-coder',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/qwen-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Large code-focused model tailored for programming tasks, code reasoning, and developer workflows.'
    },
    'Mistral Small 3.2': {
        apiName: 'mistral',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/mistral-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Lightweight open-source model with good throughput — great for cost-sensitive or offline deployments.'
    },
    'Grok 4 Fast': {
        apiName: 'grok',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/grok.png',
        supportsVision: false,
        requiresPollen: true,
        info: 'xAI Grok tuned for fast conversational flows and chat-style interactions; good for lively dialogue and quick replies.'
    },
    'Kimi K2.5': {
        apiName: 'kimi',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/moonshot.png',
        supportsVision: true,
        requiresPollen: false,
        info: 'Kimi K2.5 — a compact multimodal model useful for image-aware prompts and efficient inference without purchased pollen.'
    },
    'MiniMax M2.1': {
        apiName: 'minimax',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/minimax-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Compact reasoning model focused on concise, high-quality outputs in constrained environments.'
    },
    'Amazon Nova Micro': {
        apiName: 'nova-fast',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/aws-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Lightweight Amazon model optimized for low-latency and cost-effective inference.'
    },
    'GLM-5': {
        apiName: 'glm',
        icon: 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/zhipu-color.png',
        supportsVision: false,
        requiresPollen: false,
        info: 'Multilingual GLM suited for translation, cross-lingual tasks, and international content.'
    }
};
let selectedModel = 'GPT-5 Nano';
let currentNewProjectVisibility = 'unlisted';
let currentEditProjectVisibility = 'unlisted';
let currentProfileProjectSlug = 'profile';

function bytesToKb(bytes) {
    if (bytes === 0) return '0kb';
    const kb = bytes / 1024;
    return `${kb.toFixed(1)}kb`;
}

function estimateTokens(text) {
    // A common, rough heuristic is that one token is about 4 characters on average.
    return Math.ceil((text || '').length / 4);
}

function updateProjectInfoPanel() {
    // Logic removed as per request to remove token count
}

function setLoading(isLoading) {
    const submitBtn = document.getElementById('submit-btn');
    if (isLoading) {
        if (generatingIndicator) generatingIndicator.classList.remove('opacity-0');
        if (promptInput) promptInput.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        if (generatingIndicator) generatingIndicator.classList.add('opacity-0');
        if (promptInput) {
            promptInput.disabled = false;
            promptInput.focus();
        } 
        if (submitBtn) submitBtn.disabled = false;
    }
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')       // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-')     // Replace multiple - with single -
        .replace(/^-+/, '')         // Trim - from start of text
        .replace(/-+$/, '');        // Trim - from end of text
}

async function createNewProject(title, slug, description, visibility = 'unlisted') {
    const newId = Date.now().toString();
    const initialVersionId = `v_${Date.now()}`;
    
    const newProjectData = {
        id: newId,
        title: title,
        slug: slug,
        description: description,
        visibility: visibility,
        currentVersionId: initialVersionId,
        pinnedVersionId: null, // New field for pinning
        versions: {
            [initialVersionId]: {
                id: initialVersionId,
                prompt: `A modern and clean landing page for a new SaaS product called '${title}'. It should have a navigation bar, a hero section with a call-to-action button, a features section, and a simple footer.`,
                html: '',
                css: '',
                js: ''
            }
        }
    };
    
    projects[newId] = newProjectData;
    currentProjectId = newId;

    if (isLoggedIn) {
        try {
            await apiRequest('/projects', 'POST', { project_data: newProjectData });
            saveProjectsToLocalStorage(); // Save locally only after successful server save
        } catch (error) {
            showErrorModal('Create Project Failed', `Could not save your new project to the server. ${error.message}`);
            delete projects[newId]; // Rollback local change
            currentProjectId = Object.keys(projects).sort((a,b) => b-a)[0] || null;
        }
    } else {
        saveProjectsToLocalStorage();
    }

    renderProjectState();
    navigateTo(`/@${discordUsername}/${slug}`);


    // After creating, focus the prompt input so the user can start typing.
    setTimeout(() => {
        promptInput.focus();
    }, 100);
    return newId;
}

function updatePageMeta(title, description) {
    const siteTitle = title ? `${title} • netsim` : 'netsim';
    document.title = siteTitle;
    
    const desc = description || (title ? 'No description...' : 'netsim is an AI-powered browser simulation for web creation.');
    
    const selectors = {
        'meta[name="description"]': desc,
        'meta[property="og:title"]': title || 'netsim',
        'meta[property="og:description"]': desc,
        'meta[property="twitter:title"]': title || 'netsim',
        'meta[property="twitter:description"]': desc
    };

    for (const [selector, value] of Object.entries(selectors)) {
        const el = document.querySelector(selector);
        if (el) el.setAttribute('content', value);
    }
}

function renderProjectState() {
    // Reset view-only mode styles
    shareBtn.title = "Share Project";
    projectInfoPanel.classList.add('hidden');
    
    // Hide social elements if no active project context
    likeBtn.classList.add('hidden');

    // Update Sidebar Header Info
    if (currentProjectId && projects[currentProjectId]) {
        const p = projects[currentProjectId];
        updateSidebarHeader(p.title, discordUsername, p.description);
    } else if (currentView.type === 'project' && currentView.isViewing) {
        updateSidebarHeader(currentView.slug, currentView.username, 'Viewing shared project');
    } else {
        updateSidebarHeader('Home', '', '');
    }

    if (currentView.type === 'project' && currentView.isViewing) {
        // Handle view-only mode
        updatePageMeta(currentView.title || currentView.slug, currentView.description || 'Viewing shared project');
        welcomeEl.classList.add('hidden');
        promptInput.disabled = true;
        promptInput.value = "Viewing a shared project. Fork or copy to edit.";
        promptInput.placeholder = 'Viewing a shared project';
        shareBtn.title = "View your own projects"; 

        // Show social features even when viewing
        likeBtn.classList.remove('hidden');
        refreshSocialInfo();
    } else if (!currentProjectId || !projects[currentProjectId]) {
        updatePageMeta(null, null);
        welcomeEl.classList.remove('hidden');
        promptInput.value = '';
        promptInput.disabled = true;
        promptInput.placeholder = isLoggedIn ? 'Create a new project to get started' : 'Log in or sign up to create projects';
        updateProjectInfoPanel(); // Hide panel when no project
        projectTitleDisplay.textContent = 'New Project';
    } else {
        welcomeEl.classList.add('hidden');
        promptInput.disabled = !isLoggedIn;

        const project = projects[currentProjectId];
        if (!project) {
             currentProjectId = null;
             navigateTo('/');
             return;
        }

        const currentVersion = project.versions[project.currentVersionId];
        if (!currentVersion) {
             const versionKeys = Object.keys(project.versions).sort((a,b) => b.localeCompare(a));
            if (versionKeys.length > 0) {
                project.currentVersionId = versionKeys[0];
            } else {
                const newVersionId = `v_${Date.now()}`;
                project.versions[newVersionId] = {id: newVersionId, prompt: '', html: '', css: '', js: ''};
                project.currentVersionId = newVersionId;
            }
            saveProject(project);
            renderProjectState();
            return;
        }

        // Just show the prompt, no URL magic in the textarea
        promptInput.value = currentVersion.prompt || '';
        promptInput.placeholder = isLoggedIn ? "Describe the website you want to build..." : 'Sign in to edit';
        
        updatePageMeta(project.title, project.description);

        projectTitleDisplay.textContent = project.title || 'Untitled Project';
        projectTitleDisplay.title = project.title || 'Untitled Project';
        
        updatePreview(currentVersion.html, currentVersion.css, currentVersion.js);
        updateProjectInfoPanel();
        
        // Show social features when in a project
        likeBtn.classList.remove('hidden');
        refreshSocialInfo();
    }
    renderSidebarContent();
}

async function refreshSocialInfo() {
    if (!currentView.username || !currentView.slug || currentView.username === 'guest') {
        updateLikeButtonUI(false, 0);
        return;
    }
    try {
        const data = await apiRequest(`/p/${currentView.username}/${currentView.slug}/social`);
        if (data.success) {
            updateLikeButtonUI(data.liked_by_user, data.likes);
        }
    } catch (e) {
        logger.warn("Failed to fetch social info", e);
    }
}

function updateLikeButtonUI(liked, count) {
    // Support both icon-based and text/button-based like controls.
    const icon = likeBtn.querySelector('i, svg');
    if (icon) {
        if (liked) {
            icon.classList.add('fill-red-500', 'text-red-500');
        } else {
            icon.classList.remove('fill-red-500', 'text-red-500');
        }
    } else {
        // Toggle a visual 'liked' state on the button itself when no icon exists.
        if (liked) {
            likeBtn.classList.add('liked', 'bg-red-600/10');
        } else {
            likeBtn.classList.remove('liked', 'bg-red-600/10');
        }
    }

    likeBtn.title = `Like (${count})`;
    // If the button uses text, update the visible label (keeps small UI feedback)
    const label = likeBtn.querySelector('span');
    if (label) {
        label.textContent = liked ? `Liked (${count})` : `Like (${count})`;
    }

    // Update social view likes if present
    const socialLikeBtn = document.getElementById('social-like-btn');
    const socialLikeCount = document.getElementById('social-like-count');
    if (socialLikeBtn && socialLikeCount) {
        const socialIcon = socialLikeBtn.querySelector('i, svg');
        if (liked) {
            if (socialIcon) socialIcon.classList.add('fill-red-500', 'text-red-500');
            socialLikeBtn.classList.add('bg-red-500/10', 'border-red-500/20');
            socialLikeBtn.classList.remove('bg-zinc-800');
        } else {
            if (socialIcon) socialIcon.classList.remove('fill-red-500', 'text-red-500');
            socialLikeBtn.classList.remove('bg-red-500/10', 'border-red-500/20');
            socialLikeBtn.classList.add('bg-zinc-800');
        }
        socialLikeCount.textContent = `${count} like${count === 1 ? '' : 's'}`;
    }
}

likeBtn.addEventListener('click', async () => {
    if (!isLoggedIn) {
        openAuthModal();
        return;
    }
    if (!currentView.username || !currentView.slug || currentView.username === 'guest') return;

    // Optimistic UI
    // Compute current liked state whether the button uses an icon or the button class
    const icon = likeBtn.querySelector('i, svg');
    const isLiked = icon ? icon.classList.contains('fill-red-500') : likeBtn.classList.contains('liked');

    // Optimistic UI
    updateLikeButtonUI(!isLiked, '...');

    try {
        const data = await apiRequest(`/p/${currentView.username}/${currentView.slug}/like`, 'POST');
        if (data.success) {
            updateLikeButtonUI(data.liked_by_user, data.likes);
        }
    } catch (e) {
        logger.error("Failed to toggle like", e);
        refreshSocialInfo(); // Revert to server state
    }
});

function highlightActiveItems() {
     // Highlight active recent item
    document.querySelectorAll('#sidebar-content [data-project-id]').forEach(el => {
        const itemContainer = el.closest('button.group');
        if (!itemContainer) return;
        if (el.dataset.projectId === currentProjectId && sidebarView === 'projects') {
            itemContainer.classList.add('active');
        } else {
            itemContainer.classList.remove('active');
        }
    });

     // Highlight active version item
     if (sidebarView === 'versions' && currentProjectId && projects[currentProjectId]) {
        const project = projects[currentProjectId];
        document.querySelectorAll('#sidebar-content [data-version-id]').forEach(el => {
            const itemContainer = el.closest('button');
            if (!itemContainer) return;
            if (el.dataset.versionId === project.currentVersionId) {
                itemContainer.classList.add('active');
            } else {
                itemContainer.classList.remove('active');
            }
        });
    }
}

function updatePreview(html, css, js, isStreaming = false) {
    const project = projects[currentProjectId];
    let finalHtml = html;
    let finalCss = css;
    let finalJs = js;
    let virtualFiles = {};

    // Use virtual filesystem if available in current version
    if (project && project.versions[project.currentVersionId]) {
        const ver = project.versions[project.currentVersionId];
        if (ver.files) {
            virtualFiles = ver.files;
            finalHtml = ver.files['index.html'] || '';
            finalCss = ver.files['style.css'] || '';
            finalJs = ver.files['script.js'] || '';
        }
    }

    // New Multi-file logic: Resolve local file references in index.html
    if (finalHtml && virtualFiles && Object.keys(virtualFiles).length > 0) {
        // Simple regex-based substitution for local JS/CSS files to make them work in srcdoc
        // 1. Resolve <script src="...">
        finalHtml = finalHtml.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src) => {
            if (virtualFiles[src]) {
                return `<script id="netsim-resolved-${src.replace(/[^a-z0-9]/gi, '-')}">${virtualFiles[src]}</script>`;
            }
            return match; // Leave as is if not in our virtual filesystem
        });

        // 2. Resolve <link rel="stylesheet" href="...">
        finalHtml = finalHtml.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
            if (virtualFiles[href]) {
                return `<style id="netsim-resolved-${href.replace(/[^a-z0-9]/gi, '-')}">${virtualFiles[href]}</style>`;
            }
            return match;
        });
    }

    if (!finalHtml) {
        previewFrame.srcdoc = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>New Project</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400&display=swap" rel="stylesheet">
                <style>
                    body {
                        background-color: #18181b; /* zinc-900 */
                        color: #a1a1aa; /* zinc-400 */
                        font-family: 'DM Sans', sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        text-align: center;
                        padding: 2rem;
                        box-sizing: border-box;
                        overflow: hidden;
                        position: relative;
                    }

                    body::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-image:
                            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                        background-size: 25px 25px;
                        opacity: 0.5;
                        z-index: 0;
                    }

                    .container {
                        position: relative;
                        z-index: 1;
                        max-width: 500px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        animation: fade-in 0.8s ease-out forwards;
                        opacity: 0;
                    }
                    
                    @keyframes fade-in {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    .icon {
                        width: 56px;
                        height: 56px;
                        color: #60a5fa; /* blue-400 */
                        margin-bottom: 1.5rem;
                        animation: float 3s ease-in-out infinite;
                    }

                    h1 {
                        font-size: 2.25rem;
                        font-weight: 700;
                        color: #fafafa; /* zinc-50 */
                        margin: 0 0 0.75rem;
                    }

                    p {
                        font-size: 1rem;
                        line-height: 1.6;
                        margin: 0;
                        max-width: 400px;
                    }

                    .prompt-container {
                        margin-top: 2rem;
                        padding: 0.75rem 1.25rem;
                        background-color: rgba(39, 39, 42, 0.5); /* zinc-800 with transparency */
                        border: 1px solid #3f3f46; /* zinc-700 */
                        border-radius: 0.5rem;
                        font-family: 'Roboto Mono', monospace;
                        font-size: 0.875rem;
                        color: #d4d4d8; /* zinc-300 */
                        display: inline-block;
                        text-align: left;
                        position: relative;
                    }

                    .prompt-container::after {
                        content: '|';
                        animation: blink 1s step-end infinite;
                    }

                    @keyframes blink {
                        50% { opacity: 0; }
                    }

                    @keyframes float {
                        0% { transform: translateY(0px); }
                        50% { transform: translateY(-8px); }
                        100% { transform: translateY(0px); }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                    <h1>Describe your vision.</h1>
                    <p>Use the address bar above to tell the AI what kind of website you want to create.</p>
                    <div class="prompt-container">
                        <span id="typing-prompt"></span>
                    </div>
                </div>
                <script>
                    const promptElement = document.getElementById('typing-prompt');
                    const prompts = [
                        "A portfolio for a photographer...",
                        "A landing page for a new SaaS app...",
                        "A recipe blog for Italian food...",
                        "A brutalist personal website...",
                        "A vaporwave-style fan page..."
                    ];
                    let currentPromptIndex = 0;
                    let currentText = '';
                    let isDeleting = false;
                    let typingSpeed = 100;

                    function type() {
                        const fullPrompt = prompts[currentPromptIndex];
                        if (isDeleting) {
                            currentText = fullPrompt.substring(0, currentText.length - 1);
                        } else {
                            currentText = fullPrompt.substring(0, currentText.length + 1);
                        }

                        promptElement.textContent = currentText;

                        let typeDelay = typingSpeed;

                        if (!isDeleting && currentText === fullPrompt) {
                            typeDelay = 2000; // Pause at end
                            isDeleting = true;
                        } else if (isDeleting && currentText === '') {
                            isDeleting = false;
                            currentPromptIndex = (currentPromptIndex + 1) % prompts.length;
                            typeDelay = 500; // Pause before new prompt
                        } else if (isDeleting) {
                            typeDelay /= 2;
                        }

                        setTimeout(type, typeDelay);
                    }
                    
                    document.addEventListener('DOMContentLoaded', () => {
                        setTimeout(type, 500); // Initial delay
                    });
                </script>
            </body>
            </html>
        `;
        return;
    }

    // This logic is for the final, non-streaming update
    if (!isStreaming) {
        if (finalCss) {
            if (finalHtml.includes('</head>')) {
                finalHtml = finalHtml.replace('</head>', `<style id="netsim-injected-css">${finalCss}</style>\n</head>`);
            } else {
                finalHtml += `<style id="netsim-injected-css">${finalCss}</style>`;
            }
        }

        if (finalJs) {
            if (finalHtml.includes('</body>')) {
                finalHtml = finalHtml.replace('</body>', `<script id="netsim-injected-js">${finalJs}</script>\n</body>`);
            } else {
                finalHtml += `<script id="netsim-injected-js">${finalJs}</script>`;
            }
        }

        // Inject a <base> tag so relative paths inside the project's HTML resolve to project resource endpoints
        // Determine base URL: if viewing a shared project use currentView, otherwise use user's project path
        try {
            let baseHref = '/';
            if (currentView && currentView.type === 'project' && currentView.username && currentView.slug) {
                baseHref = `${window.location.origin}/@${currentView.username}/${currentView.slug}/`;
            } else if (currentProjectId && projects[currentProjectId]) {
                const p = projects[currentProjectId];
                baseHref = `${window.location.origin}/@${discordUsername}/${p.slug}/`;
            }
            // Only add base if there's a head tag; otherwise prepend a head section
            if (finalHtml.includes('<head')) {
                // Insert base after opening <head> tag
                finalHtml = finalHtml.replace(/<head([^>]*)>/i, (m) => `${m}\n<base href="${baseHref}">`);
            } else if (finalHtml.includes('<html')) {
                finalHtml = finalHtml.replace(/<html([^>]*)>/i, (m) => `${m}\n<head>\n<base href="${baseHref}">\n</head>`);
            } else {
                // As a fallback, prepend a head with base
                finalHtml = `<head><base href="${baseHref}"></head>\n` + finalHtml;
            }
        } catch (e) {
            console.warn('Failed to inject base href for preview iframe:', e);
        }

        // Ensure pointer events and sandbox-friendly behavior
        // Use srcdoc to keep the preview isolated but allow same-origin so embedded project code can use relative fetches
        previewFrame.srcdoc = finalHtml;

        // Also set iframe attributes defensively to allow fullscreen/pointer lock, clipboard use and downloads when needed
        previewFrame.setAttribute('sandbox', 'allow-forms allow-modals allow-pointer-lock allow-same-origin allow-scripts allow-popups allow-top-navigation-by-user-activation');
        previewFrame.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen; geolocation; microphone; camera; autoplay; encrypted-media; payment; display-capture; web-share; usb; allow-downloads');
        previewFrame.style.pointerEvents = 'auto';
        return;
    }

    // --- Streaming Logic to prevent flicker ---
    const doc = previewFrame.contentDocument;
    if (!doc || !doc.body) { // If doc not ready, do a full render
        previewFrame.srcdoc = finalHtml;
        return;
    }
    
    // Parse the incoming HTML string to get the new head and body content
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    // 1. Update Head: The full HTML includes the <head> tag, so we can replace it.
    // This is generally safe and ensures all meta tags, links, and scripts are correctly updated.
    if (newDoc.head && newDoc.head.innerHTML.trim() && doc.head.innerHTML !== newDoc.head.innerHTML) {
        doc.head.innerHTML = newDoc.head.innerHTML;
    }

    // 2. Update Body Attributes
    // This preserves the body element itself, reducing flicker.
    if (newDoc.body) {
        for (const { name, value } of newDoc.body.attributes) {
            if (doc.body.getAttribute(name) !== value) {
                doc.body.setAttribute(name, value);
            }
        }
    }

    // 3. Update Body Content
    if (newDoc.body && doc.body.innerHTML !== newDoc.body.innerHTML) {
        doc.body.innerHTML = newDoc.body.innerHTML;
    }

    // 4. Update or create style tag for AI-generated CSS
    let styleTag = doc.getElementById('netsim-injected-css');
    if (!styleTag && doc.head) { // Ensure head exists before appending
        styleTag = doc.createElement('style');
        styleTag.id = 'netsim-injected-css';
        doc.head.appendChild(styleTag);
    }
    if (styleTag && styleTag.textContent !== css) {
        styleTag.textContent = css;
    }

    // 5. Update or create script tag for AI-generated JS. We replace the node to force re-execution.
    const oldScriptTag = doc.getElementById('netsim-injected-js');
    if (oldScriptTag) {
        oldScriptTag.remove();
    }
    
    if(js && doc.body) { // Ensure body exists before appending
        const scriptTag = doc.createElement('script');
        scriptTag.id = 'netsim-injected-js';
        scriptTag.textContent = js;
        // Append to body to ensure DOM is ready for the script
        doc.body.appendChild(scriptTag);
    }
}



function renderSidebarContent() {
    updateTabUI();
    
    if(sidebarView === 'projects') {
        renderProjectsList();
    } else if(sidebarView === 'versions') {
        renderVersionsList();
    } else if(sidebarView === 'files') {
        renderFilesList();
    } else if(sidebarView === 'social') {
        renderSocialView();
    }
}

function updateTabUI() {
    const tabs = [
        { id: 'tab-projects', view: 'projects' },
        { id: 'tab-versions', view: 'versions' },
        { id: 'tab-files', view: 'files' },
        { id: 'tab-social', view: 'social' }
    ];

    tabs.forEach(t => {
        const el = document.getElementById(t.id);
        if (!el) return;
        if (sidebarView === t.view) {
            el.className = 'flex-1 text-xs font-medium py-1.5 rounded bg-zinc-800 text-zinc-200 transition-colors';
        } else {
            el.className = 'flex-1 text-xs font-medium py-1.5 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors';
        }
    });
}

function renderProjectsList() {
    if (!sidebarContent) return;
    
    sidebarContent.innerHTML = '';
    const sortedProjects = Object.values(projects).sort((a, b) => b.id - a.id);

    if (sortedProjects.length === 0) {
        sidebarContent.innerHTML = `<div class="p-4 text-sm text-zinc-500 text-center flex flex-col items-center justify-center h-full"><i data-lucide="folder-open" class="h-8 w-8 mb-2 opacity-50"></i>No projects found.</div>`;
        lucide.createIcons();
        return;
    }

    const list = document.createElement('div');
    list.className = 'space-y-1';

    sortedProjects.forEach(project => {
        const item = document.createElement('button');
        item.className = 'w-full text-left p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all group relative';
        if (currentProjectId === project.id) {
            item.classList.add('bg-zinc-800', 'border-zinc-700/50');
        }

        item.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-2 truncate">
                    <i data-lucide="layout" class="h-4 w-4 text-zinc-500 group-hover:text-blue-400 transition-colors"></i>
                    <span class="text-sm font-medium text-zinc-200 truncate">${project.title}</span>
                </div>
            </div>
            <div class="text-[10px] text-zinc-500 mt-1 pl-6 line-clamp-2">${project.description || 'No description'}</div>
            
            <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-zinc-900/80 rounded pl-1">
                <div class="p-1 hover:text-white cursor-pointer" title="Edit" data-action="edit"><i data-lucide="edit-2" class="h-3 w-3"></i></div>
                <div class="p-1 hover:text-blue-400 cursor-pointer" title="Download ZIP" data-action="download"><i data-lucide="download" class="h-3 w-3"></i></div>
                <div class="p-1 hover:text-red-400 cursor-pointer" title="Delete" data-action="delete"><i data-lucide="trash" class="h-3 w-3"></i></div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'edit') {
                openEditProjectModal(project.id);
            } else if (action === 'delete') {
                deleteProject(project.id);
            } else if (action === 'download') {
                // Download the project as a ZIP using existing backend endpoint
                downloadProjectById(project);
            } else {
                navigateTo(`/@${discordUsername}/${project.slug}`);
                sidebarView = 'versions'; // Switch to versions view after selecting
                renderSidebarContent();
            }
        });

        list.appendChild(item);
    });
    
    sidebarContent.appendChild(list);
    lucide.createIcons();
}

async function renderSocialView() {
    if (!sidebarContent) return;
    sidebarContent.innerHTML = '';

    if (!currentView.username || !currentView.slug || currentView.username === 'guest') {
        sidebarContent.innerHTML = `
            <div class="p-8 text-sm text-zinc-500 text-center flex flex-col items-center justify-center h-full space-y-3">
                <i data-lucide="shield-alert" class="h-10 w-10 opacity-20"></i>
                <p>Social features are only available for synced projects.</p>
                <button id="social-auth-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-md transition-all">Log in or Sign up</button>
            </div>`;
        lucide.createIcons();
        document.getElementById('social-auth-btn')?.addEventListener('click', () => openAuthModal());
        return;
    }

    const loadingEl = document.createElement('div');
    loadingEl.className = 'p-8 flex items-center justify-center';
    loadingEl.innerHTML = '<div class="auth-spinner h-6 w-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>';
    sidebarContent.appendChild(loadingEl);

    try {
        // Fetch in parallel for better performance and resilience
        const [commentsRes, socialRes] = await Promise.all([
            apiRequest(`/p/${currentView.username}/${currentView.slug}/comments`).catch(e => ({ success: false, comments: [] })),
            apiRequest(`/p/${currentView.username}/${currentView.slug}/social`).catch(e => ({ success: false, likes: 0, liked_by_user: false }))
        ]);
        
        const data = commentsRes;
        const socialInfo = socialRes;
        
        sidebarContent.innerHTML = '';
        
        // Like Section
        const likeSection = document.createElement('div');
        likeSection.className = 'flex items-center justify-between p-3 mb-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50';
        likeSection.innerHTML = `
            <div class="flex items-center gap-3">
                <button id="social-like-btn" class="h-9 w-9 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center border border-zinc-700 transition-all active:scale-90">
                    <i data-lucide="heart" class="h-4 w-4"></i>
                </button>
                <div class="flex flex-col">
                    <span id="social-like-count" class="text-sm font-bold text-zinc-100">${socialInfo.likes} likes</span>
                    <span class="text-[10px] text-zinc-500 font-medium">Community Love</span>
                </div>
            </div>
            <div class="text-[10px] text-zinc-600 uppercase tracking-widest font-bold pr-2">Social</div>
        `;
        sidebarContent.appendChild(likeSection);
        
        const socialLikeBtn = likeSection.querySelector('#social-like-btn');
        socialLikeBtn.addEventListener('click', () => likeBtn.click());
        
        // Re-run initial UI update for the new like button
        updateLikeButtonUI(socialInfo.liked_by_user, socialInfo.likes);

        // Comment Input (Matches Prompt Input style)
        const inputContainer = document.createElement('div');
        inputContainer.className = 'mb-6';
        inputContainer.innerHTML = `
            <div class="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all shadow-sm group">
                <textarea id="comment-textarea" rows="3" class="w-full bg-transparent text-zinc-200 text-sm p-3 focus:outline-none placeholder:text-zinc-600 resize-none block" placeholder="${isLoggedIn ? 'Write a comment...' : 'Log in to comment'}" ${isLoggedIn ? '' : 'disabled'}></textarea>
                <div class="flex items-center justify-end px-3 pb-3">
                    <button id="post-comment-btn" class="h-8 w-8 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-90 flex items-center justify-center group/btn" ${isLoggedIn ? '' : 'disabled'}>
                        <i data-lucide="send" class="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform"></i>
                    </button>
                </div>
            </div>
        `;
        sidebarContent.appendChild(inputContainer);

        const textarea = inputContainer.querySelector('#comment-textarea');
        const postBtn = inputContainer.querySelector('#post-comment-btn');

        // Allow Enter to submit, Shift+Enter for new line
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && isLoggedIn) {
                e.preventDefault();
                postBtn.click();
            }
        });

        postBtn.addEventListener('click', async () => {
            const content = textarea.value.trim();
            if (!content) return;
            postBtn.disabled = true;
            try {
                const res = await apiRequest(`/p/${currentView.username}/${currentView.slug}/comments`, 'POST', { content });
                if (res.success) {
                    textarea.value = '';
                    // If the posted content contains mentions, briefly highlight the mentions in the UI and show a quick ping notice
                    const mentions = Array.from((content.match(/@([a-zA-Z0-9_-]{1,30})/g) || []).map(m => m.replace('@','')));
                    if (mentions.length > 0) {
                        // Show a quick non-blocking confirmation toast inside sidebarContent
                        const toast = document.createElement('div');
                        toast.className = 'p-2 text-sm text-zinc-100 bg-blue-600 rounded-md mb-3';
                        toast.textContent = `Pinged: ${mentions.map(m => '@'+m).join(', ')}`;
                        sidebarContent.insertBefore(toast, sidebarContent.firstChild);
                        setTimeout(() => toast.remove(), 3000);
                        
                        // Re-render comments then briefly add `.ping` animation class to matched mention anchors
                        await renderSocialView();
                        setTimeout(() => {
                            mentions.forEach(u => {
                                sidebarContent.querySelectorAll(`a[data-mention="${u}"]`).forEach(el => {
                                    el.classList.add('ping');
                                    setTimeout(() => el.classList.remove('ping'), 1200);
                                });
                            });
                        }, 350);
                    } else {
                        renderSocialView(); // Refresh list
                    }
                }
            } catch (e) {
                showErrorModal('Error', 'Failed to post comment.');
                postBtn.disabled = false;
            }
        });

        // Comments List
        if (data.comments && data.comments.length > 0) {
            const list = document.createElement('div');
            list.className = 'space-y-4';
            data.comments.forEach(comment => {
                const item = document.createElement('div');
                item.className = 'flex gap-3';
                item.innerHTML = `
                    <img src="${comment.avatar_url || '/default.webp'}" class="h-8 w-8 rounded-full object-cover border border-zinc-800 shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-xs font-bold text-zinc-200">@${comment.username}</span>
                            <span class="text-[10px] text-zinc-600">${formatTimeAgo(new Date(comment.created_at + 'Z'))}</span>
                        </div>
                        <p class="text-sm text-zinc-400 break-words leading-relaxed">${mentionify(comment.content)}</p>
                    </div>
                `;
                list.appendChild(item);
            });
            sidebarContent.appendChild(list);
        } else {
            const empty = document.createElement('div');
            empty.className = 'py-8 text-center text-xs text-zinc-600';
            empty.textContent = 'No comments yet. Be the first to share your thoughts!';
            sidebarContent.appendChild(empty);
        }
    } catch (e) {
        sidebarContent.innerHTML = `<div class="p-4 text-xs text-red-400 text-center">Failed to load comments.</div>`;
    }
    lucide.createIcons();
}

function renderFilesList() {
    if (!sidebarContent) return;
    sidebarContent.innerHTML = '';

    const project = projects[currentProjectId];
    if (!project || !project.versions[project.currentVersionId]) {
        sidebarContent.innerHTML = `<div class="p-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center h-full"><i data-lucide="file-x" class="h-10 w-10 mb-2 opacity-20"></i>No files available yet.</div>`;
        lucide.createIcons();
        return;
    }

    const version = project.versions[project.currentVersionId];
    const files = version.files || {
        'index.html': version.html || '',
        'style.css': version.css || '',
        'script.js': version.js || ''
    };

    if (currentOpenFile && files[currentOpenFile] !== undefined) {
        renderFileEditor(currentOpenFile, files[currentOpenFile]);
    } else {
        // Render file list view and enable drag-and-drop uploading onto the files area.
        renderFileListView(files);

        // Add a drop overlay and handlers so users can drop files to upload
        const dropOverlayId = 'files-drop-overlay';
        let overlay = document.getElementById(dropOverlayId);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = dropOverlayId;
            overlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';
            overlay.style.transition = 'opacity 0.15s ease';
            overlay.style.opacity = '0';
            overlay.innerHTML = `<div class="px-4 py-2 rounded-md bg-blue-600/80 text-white text-sm font-medium pointer-events-none">Drop files to upload</div>`;
            // Ensure the overlay is positioned within the sidebar content container
            sidebarContent.style.position = 'relative';
            sidebarContent.appendChild(overlay);
        }

        const showOverlay = () => { overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto'; };
        const hideOverlay = () => { overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none'; };

        // Prevent default page handling for drag events
        const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            sidebarContent.addEventListener(evt, preventDefaults, { passive: false });
        });

        sidebarContent.addEventListener('dragenter', (e) => {
            showOverlay();
        });

        sidebarContent.addEventListener('dragover', (e) => {
            showOverlay();
        });

        sidebarContent.addEventListener('dragleave', (e) => {
            // If leaving the sidebar entirely, hide overlay
            // Use relatedTarget to determine if left to a child; fallback to timeout check
            const rect = sidebarContent.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                hideOverlay();
            } else {
                // small delay to avoid flicker when moving between child elements
                setTimeout(() => {
                    const r = sidebarContent.getBoundingClientRect();
                    if (window.event && (window.event.clientX < r.left || window.event.clientX > r.right || window.event.clientY < r.top || window.event.clientY > r.bottom)) {
                        hideOverlay();
                    }
                }, 60);
            }
        });

        sidebarContent.addEventListener('drop', async (e) => {
            hideOverlay();
            const dt = e.dataTransfer;
            if (!dt) return;
            const droppedFiles = Array.from(dt.files || []);
            if (droppedFiles.length === 0) return;

            if (!currentProjectId || !projects[currentProjectId]) {
                showErrorModal('No Project Selected', 'Select a project to upload files into.');
                return;
            }

            // Enforce same per-file limit as server (300KB)
            const maxSize = 300 * 1024;
            for (const f of droppedFiles) {
                if (f.size > maxSize) {
                    showErrorModal('Upload Failed', `File ${f.name} exceeds the 300KB per-file upload limit.`);
                    return;
                }
            }

            // Build FormData and upload to the same endpoint as the upload button
            const form = new FormData();
            droppedFiles.forEach(f => form.append('files', f, f.name));

            try {
                setLoading(true);
                showIframeLoadingAnimation();
                const resp = await fetch(`/api/v1/projects/${projects[currentProjectId].id}/upload`, {
                    method: 'POST',
                    body: form
                });
                const data = await resp.json().catch(() => ({ success: false, message: 'Unexpected server response' }));
                if (!resp.ok) {
                    throw new Error(data.message || `HTTP ${resp.status}`);
                }

                if (data.success && data.project) {
                    // Replace local project with updated returned project and re-render
                    projects[data.project.id || projects[currentProjectId].id] = data.project;
                    saveProjectsToLocalStorage();
                    currentProjectId = data.project.id || currentProjectId;
                    renderProjectState();
                } else {
                    showErrorModal('Upload Failed', data.message || 'Upload did not return a valid project.');
                }
            } catch (err) {
                logger.error('Upload error (drag-drop)', err);
                showErrorModal('Upload Failed', err.message || 'An error occurred while uploading files.');
            } finally {
                setLoading(false);
            }
        });
    }
}

function renderFileListView(files) {
    const list = document.createElement('div');
    list.className = 'space-y-1';

    // Normalize entries to an array of {name, value}
    const entries = Object.entries(files)
        // Show all files, including database files (.db, .sqlite) and uploaded DB files.
        .filter(([name, value]) => {
            // Keep entries as-is; do not hide database or uploads/dbs files.
            return true;
        });

    if (entries.length === 0) {
        sidebarContent.innerHTML = `<div class="p-4 text-sm text-zinc-500 text-center flex flex-col items-center justify-center h-full"><i data-lucide="file-x" class="h-10 w-10 mb-2 opacity-20"></i>No accessible files available.</div>`;
        lucide.createIcons();
        return;
    }

    // Create UI rows and asynchronously fill sizes for remote/binary files
    entries.forEach(([path, content]) => {
        const fileExt = (path || '').split('.').pop();
        const iconColor = fileExt === 'html' ? 'text-orange-400' : fileExt === 'css' ? 'text-blue-400' : fileExt === 'js' ? 'text-yellow-400' : 'text-zinc-400';
        const fileIcon = fileExt === 'html' ? 'file-code' : fileExt === 'css' ? 'file-text' : fileExt === 'js' ? 'scroll' : 'file';

        const item = document.createElement('button');
        item.className = 'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group text-left';
        item.innerHTML = `
            <i data-lucide="${fileIcon}" class="h-4 w-4 ${iconColor} shrink-0"></i>
            <div class="flex-1 truncate">
                <div class="text-sm font-medium text-zinc-300 truncate file-name">${path}</div>
                <div class="text-[10px] text-zinc-600 truncate file-size">Calculating...</div>
            </div>
            <i data-lucide="chevron-right" class="h-4 w-4 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"></i>
        `;

        item.addEventListener('click', () => {
            currentOpenFile = path;
            renderFilesList();
        });

        list.appendChild(item);

        // Determine size: if value is a textual string (not a server path), compute via Blob
        const sizeEl = item.querySelector('.file-size');
        try {
            if (typeof content === 'string' && !content.startsWith('/uploads/')) {
                // Treat as text stored in DB (show actual bytes)
                const size = new Blob([content]).size;
                sizeEl.textContent = bytesToKb(size);
            } else if (typeof content === 'string' && content.startsWith('/uploads/')) {
                // For uploaded/binary files served from /uploads/... attempt HEAD request to get Content-Length
                (async () => {
                    try {
                        const headResp = await fetch(content, { method: 'HEAD' });
                        if (headResp.ok) {
                            const len = headResp.headers.get('content-length');
                            if (len) {
                                sizeEl.textContent = bytesToKb(parseInt(len, 10));
                                return;
                            }
                        }
                        // Fallback: display a friendly label
                        sizeEl.textContent = 'Binary file';
                    } catch (e) {
                        sizeEl.textContent = 'Binary file';
                    }
                })();
            } else {
                // Unknown type: show generic info
                sizeEl.textContent = 'Unknown';
            }
        } catch (e) {
            sizeEl.textContent = '—';
        }
    });

    sidebarContent.appendChild(list);
    lucide.createIcons();
}

function renderFileEditor(path, content) {
    const fileExt = (path.split('.').pop() || '').toLowerCase();
    const isImage = ['png','jpg','jpeg','webp','gif','svg'].includes(fileExt);
    const iconColor = fileExt === 'html' ? 'text-orange-400' : fileExt === 'css' ? 'text-blue-400' : fileExt === 'js' ? 'text-yellow-400' : 'text-zinc-400';
    const fileIcon = fileExt === 'html' ? 'file-code' : fileExt === 'css' ? 'file-text' : fileExt === 'js' ? 'scroll' : 'file';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 mb-4 sticky top-0 bg-zinc-900 z-10 py-1';
    header.innerHTML = `
        <button id="file-editor-back" class="h-7 w-7 rounded-md grid place-items-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>
        </button>
        <i data-lucide="${fileIcon}" class="h-4 w-4 ${iconColor} ml-1"></i>
        <span id="file-editor-name" class="text-xs font-bold text-zinc-300 truncate flex-1">${path}</span>

        <div class="flex items-center gap-1">
            <button id="file-editor-rename" class="h-7 w-7 rounded-md grid place-items-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition" title="Rename file">
                <i data-lucide="edit-3" class="h-3.5 w-3.5"></i>
            </button>
            <button id="file-editor-delete" class="h-7 w-7 rounded-md grid place-items-center hover:bg-red-600/10 text-zinc-400 hover:text-red-400 transition" title="Delete file">
                <i data-lucide="trash" class="h-3.5 w-3.5"></i>
            </button>
            <button id="file-editor-copy" class="h-7 w-7 rounded-md grid place-items-center hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition" title="${isImage ? 'Download' : 'Copy All'}">
                <i data-lucide="${isImage ? 'download' : 'copy'}" class="h-3.5 w-3.5"></i>
            </button>
        </div>
    `;

    const editorContainer = document.createElement('div');
    editorContainer.className = 'flex-1 flex flex-col min-h-0 h-full';
    
    if (isImage) {
        // Show a centered image preview for images
        const wrapper = document.createElement('div');
        wrapper.className = 'flex-1 flex items-center justify-center p-4';
        const img = document.createElement('img');
        img.alt = path;
        img.className = 'max-w-full max-h-[60vh] rounded border border-zinc-700 object-contain';
        // Determine src: if content is an uploads path or data URL or an inline value, use it
        if (typeof content === 'string') {
            if (content.startsWith('/uploads/')) {
                img.src = content;
            } else if (content.startsWith('data:image')) {
                img.src = content;
            } else if (content.startsWith('http')) {
                img.src = content;
            } else {
                // If textual, perhaps the DB stored an SVG or inline image string — try to use as data URI for svg
                if (fileExt === 'svg') {
                    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
                } else {
                    // fallback: try using blob URL when possible
                    try {
                        const blob = new Blob([content], { type: `image/${fileExt}` });
                        img.src = URL.createObjectURL(blob);
                    } catch (e) {
                        img.alt = 'Preview not available';
                    }
                }
            }
        }

        wrapper.appendChild(img);
        editorContainer.appendChild(header);
        editorContainer.appendChild(wrapper);
    } else {
        // We use a syntax-highlighted pre block or a textarea for textual files.
        const pre = document.createElement('pre');
        pre.className = 'flex-1 p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-lg overflow-auto thin-scroll text-[11px] font-mono leading-relaxed text-zinc-400 select-text';
        const code = document.createElement('code');
        code.textContent = content;
        pre.appendChild(code);
        editorContainer.appendChild(header);
        editorContainer.appendChild(pre);
    }
    
    sidebarContent.appendChild(editorContainer);
    lucide.createIcons();

    // Back button
    header.querySelector('#file-editor-back').addEventListener('click', () => {
        currentOpenFile = null;
        renderFilesList();
    });

    // Copy / download handler (unchanged)
    header.querySelector('#file-editor-copy').addEventListener('click', async () => {
        if (isImage) {
            try {
                let url = '';
                if (typeof content === 'string' && content.startsWith('/uploads/')) {
                    url = content;
                } else if (typeof content === 'string' && content.startsWith('data:image')) {
                    url = content;
                } else if (typeof content === 'string' && content.startsWith('http')) {
                    url = content;
                } else if (typeof content === 'string' && fileExt === 'svg') {
                    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
                    url = dataUrl;
                } else {
                    try {
                        const blob = new Blob([content], { type: `image/${fileExt}` });
                        url = URL.createObjectURL(blob);
                    } catch (e) {
                        url = '';
                    }
                }
                if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = path;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
                } else {
                    showErrorModal('Download Failed', 'Could not determine image source for download.');
                }
            } catch (e) {
                showErrorModal('Download Failed', e.message || 'An error occurred while trying to download the image.');
            }
        } else {
            navigator.clipboard.writeText(content);
            const icon = header.querySelector('#file-editor-copy i');
            icon.dataset.lucide = 'check';
            lucide.createIcons();
            setTimeout(() => { icon.dataset.lucide = 'copy'; lucide.createIcons(); }, 2000);
        }
    });

    // Rename handler: open the rename modal (file rename uses fileRenameTarget)
    header.querySelector('#file-editor-rename').addEventListener('click', async () => {
        if (!currentProjectId || !projects[currentProjectId]) {
            showErrorModal('No Project', 'Cannot rename file without an active project.');
            return;
        }
        // Use the existing rename modal but mark this as a file-rename operation.
        // fileRenameTarget holds { projectId, oldPath }
        window.fileRenameTarget = { projectId: currentProjectId, oldPath: path };

        // Reuse rename modal UI
        renameProjectId = null; // ensure project-rename path is not used
        renameInput.value = path;
        renameModalTitle.textContent = 'Rename File';
        renameModal.classList.remove('pointer-events-none');
        requestAnimationFrame(() => {
            renameModal.classList.remove('opacity-0');
            renameModalContent.classList.remove('scale-95', 'opacity-0');
            renameInput.focus();
            renameInput.select();
        });
    });

    // Delete handler: confirm and create new version without the file
    header.querySelector('#file-editor-delete').addEventListener('click', async () => {
        if (!currentProjectId || !projects[currentProjectId]) {
            showErrorModal('No Project', 'Cannot delete file without an active project.');
            return;
        }
        const project = projects[currentProjectId];
        const ver = project.versions[project.currentVersionId] || {};
        const files = ver.files ? { ...ver.files } : {
            'index.html': ver.html || '',
            'style.css': ver.css || '',
            'script.js': ver.js || ''
        };

        showConfirmationModal(
            'Delete File',
            `Are you sure you want to delete <strong>${path}</strong>? This will create a new revision.`,
            async () => {
                if (!(path in files)) {
                    showErrorModal('Delete Failed', 'File not found in current version.');
                    return;
                }

                delete files[path];

                const newVersionId = `v_${Date.now()}`;
                project.versions[newVersionId] = {
                    id: newVersionId,
                    prompt: `Deleted file ${path}`,
                    files,
                    model: ver.model || 'uploaded',
                    html: files['index.html'] || '',
                    css: files['style.css'] || '',
                    js: files['script.js'] || ''
                };
                project.currentVersionId = newVersionId;

                try {
                    await saveProject(project);
                    currentOpenFile = null;
                    renderProjectState();
                } catch (e) {
                    showErrorModal('Delete Failed', e.message || 'Could not save after deleting file.');
                }
            }
        );
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Turn @mentions into styled links; returns safe HTML string.
// It escapes content first, then converts @username patterns to anchor tags that point to the user's profile.
// Example: "Hello @kmas!" -> "Hello <a class='mention' href='/@kmas'>@kmas</a>!"
function mentionify(text) {
    if (!text) return '';
    // Escape first
    let escaped = escapeHtml(text);
    // Replace @username (alphanumeric, underscore, hyphen) with a styled anchor
    // We allow word boundary or line start before @ to avoid matching emails.
    escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9_-]{1,30})/g, (match, prefix, uname) => {
        const href = `/@${uname}`;
        // `data-mention` attribute included for potential JS hooks (e.g., ping animation)
        return `${prefix}<a class="mention" href="${href}" data-mention="${uname}">@${uname}</a>`;
    });
    return escaped;
}

function renderVersionsList() {
    if (!sidebarContent) return;
    sidebarContent.innerHTML = '';

    if (!currentProjectId || !projects[currentProjectId]) {
        sidebarContent.innerHTML = `<div class="p-4 text-sm text-zinc-500 text-center flex flex-col items-center justify-center h-full"><i data-lucide="box" class="h-8 w-8 mb-2 opacity-50"></i>Select a project.</div>`;
        lucide.createIcons();
        return;
    }

    const project = projects[currentProjectId];
    const sortedVersions = Object.values(project.versions).sort((a, b) => b.id.localeCompare(a.id));
    const totalVersions = sortedVersions.length;

    const list = document.createElement('div');
    list.className = 'space-y-2';

    sortedVersions.forEach((version, index) => {
        const versionNumber = totalVersions - index;
        const isActive = project.currentVersionId === version.id;
        const isPinned = project.pinnedVersionId === version.id;
        
        const card = document.createElement('div');
        // Dark card styling from image
        card.className = `group relative p-3 rounded-lg border transition-all ${isActive ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'}`;
        
        // Version Tag (Blue)
        const versionTag = `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">v${versionNumber}</span>`;
        
        // Prompt Text
        const promptText = version.prompt || 'Initial version';

        // Metadata
        const modelUsed = version.model || 'GPT-5 Nano';
        const versionDate = new Date(parseInt(version.id.split('_')[1]));
        const timeAgo = formatTimeAgo(versionDate);

        card.innerHTML = `
            <div class="flex flex-col gap-2 cursor-pointer w-full">
                <div class="flex items-start gap-2">
                    <div class="shrink-0 mt-0.5 flex items-center gap-1.5">
                        ${versionTag}
                        ${isPinned ? '<i data-lucide="pin" class="h-3 w-3 text-blue-400 fill-blue-400"></i>' : ''}
                    </div>
                    <div class="text-xs text-zinc-300 leading-snug break-words line-clamp-3 opacity-90 flex-1">
                        ${escapeHtml(promptText)}
                    </div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-zinc-600 mt-1 pl-1">
                    <div class="flex items-center gap-2">
                        <span class="font-medium">${escapeHtml(modelUsed)}</span>
                        <span>•</span>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            </div>
            
            <div class="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all bg-zinc-900/80 rounded pl-1">
                <button class="pin-btn p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors" title="${isPinned ? 'Unpin version' : 'Pin this version'}">
                    <i data-lucide="${isPinned ? 'pin-off' : 'pin'}" class="h-3.5 w-3.5"></i>
                </button>
                <button class="delete-btn p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-zinc-600 transition-colors" title="Delete version">
                    <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
                </button>
            </div>
        `;

        // Click handler for card body (switch version)
        card.querySelector('.flex').addEventListener('click', () => {
            project.currentVersionId = version.id;
            saveProject(project);
            const versionNumberParam = getVersionNumber(project, version.id);
            navigateTo(`/@${discordUsername}/${project.slug}?v=${versionNumberParam}`);
        });

        // Click handler for delete button
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVersion(project.id, version.id);
        });

        // Click handler for pin button
        card.querySelector('.pin-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinVersion(project.id, version.id);
        });

        list.appendChild(card);
    });

    sidebarContent.appendChild(list);
    lucide.createIcons();
}

function getVersionNumber(project, versionId) {
    if (!project || !versionId) return null;
    const sortedVersionIds = Object.keys(project.versions).sort((a, b) => b.localeCompare(a));
    const index = sortedVersionIds.indexOf(versionId);
    return index !== -1 ? sortedVersionIds.length - index : null;
}

function getVersionIdByNumber(project, versionNumber) {
    if (!project || !versionNumber) return null;
    const sortedVersionIds = Object.keys(project.versions).sort((a, b) => b.localeCompare(a));
    const index = sortedVersionIds.length - versionNumber;
    return (index >= 0 && index < sortedVersionIds.length) ? sortedVersionIds[index] : null;
}


function togglePinVersion(projectId, versionId) {
    const project = projects[projectId];
    if (!project) return;

    if (project.pinnedVersionId === versionId) {
        // Unpin
        project.pinnedVersionId = null;
    } else {
        // Pin
        project.pinnedVersionId = versionId;
    }

    saveProject(project);
    renderSidebarContent(); // Re-render to show pin status change
}

function deleteVersion(projectId, versionId) {
    const project = projects[projectId];
    if (!project) return;

    if (Object.keys(project.versions).length <= 1) {
        showErrorModal('Cannot Delete', 'You cannot delete the only version of a project.');
        return;
    }

    showConfirmationModal(
        'Delete Version',
        'Are you sure you want to delete this version? This action cannot be undone.',
        () => {
            delete project.versions[versionId];

            // If we deleted the active version, switch to the newest remaining one
            if (project.currentVersionId === versionId) {
                const remainingVersionIds = Object.keys(project.versions).sort((a, b) => b.localeCompare(a));
                project.currentVersionId = remainingVersionIds[0];
            }

            // If we deleted the pinned version, unpin it
            if (project.pinnedVersionId === versionId) {
                project.pinnedVersionId = null;
            }

            saveProject(project);
            renderProjectState(); // This will re-render everything correctly
        }
    );
}

function deleteProject(projectId) {
    showConfirmationModal(
        'Delete Project',
        'Are you sure you want to delete this project? This action cannot be undone.',
        async () => {
            const projectToDelete = projects[projectId];
            
            // Optimistically delete from UI
            delete projects[projectId];

            if (isLoggedIn) {
                try {
                    await apiRequest(`/projects/${projectToDelete.id}`, 'DELETE');
                } catch (error) {
                    showErrorModal('Delete Failed', `Could not delete project from server. ${error.message}`);
                    projects[projectId] = projectToDelete; // Rollback
                }
            }
            
            saveProjectsToLocalStorage();

            if (currentProjectId === projectId) {
                const remainingProjectIds = Object.keys(projects).sort((a, b) => b - a);
                if (remainingProjectIds.length > 0) {
                    currentProjectId = remainingProjectIds[0];
                } else {
                    currentProjectId = null;
                }
                sidebarView = 'projects';
            }
            renderProjectState();
        }
    );
}

// Download a project ZIP via the backend API and prompt a download
async function downloadProjectById(project) {
    if (!project) {
        showErrorModal('Download Failed', 'Project not found.');
        return;
    }

    // If viewing someone else's project, require fork first (server rule)
    if (!isLoggedIn) {
        openAuthModal();
        return;
    }

    // Ensure ownership check mirrors server-side rules
    // If project belongs to current user (we store them locally), proceed; otherwise show message
    // For simplicity we check project id presence in local projects (owned)
    if (!projects[project.id]) {
        showErrorModal('Download Not Allowed', 'To download someone else\'s project, fork it into your account first.');
        return;
    }

    try {
        setLoading(true);
        const resp = await fetch(`/api/v1/projects/${project.id}/download`, { method: 'GET' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ message: 'Failed to download' }));
            throw new Error(err.message || `HTTP ${resp.status}`);
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.slug || project.id}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        showErrorModal('Download Failed', e.message || 'An error occurred while downloading the ZIP.');
    } finally {
        setLoading(false);
    }
}

async function forkProject(username, slug) {
    if (!isLoggedIn) {
        openAuthModal();
        return;
    }
    try {
        setLoading(true);
        const res = await apiRequest(`/p/${username}/${slug}/fork`, 'POST', {});
        if (res.success && res.project) {
            // Add project locally and navigate to it
            const proj = res.project;
            projects[proj.id] = proj;
            saveProjectsToLocalStorage();
            // Ensure slug is set
            const newSlug = proj.slug;
            currentProjectId = proj.id;
            sidebarView = 'versions';
            renderProjectState();
            navigateTo(`/@${res.owner}/${newSlug}`);
        } else {
            showErrorModal('Fork Failed', res.message || 'Could not fork project');
        }
    } catch (e) {
        showErrorModal('Fork Failed', e.message || 'Could not fork project');
    } finally {
        setLoading(false);
    }
}

function clearAllProjects() {
    showConfirmationModal(
        'Clear All Projects',
        'Are you sure you want to delete ALL projects? This action cannot be undone.',
        async () => {
            const oldProjects = { ...projects };
            projects = {};
            currentProjectId = null;
            sidebarView = 'projects';
            saveProjectsToLocalStorage();
            renderProjectState();

            if(isLoggedIn){
                // Delete all projects on server one by one
                for (const project of Object.values(oldProjects)) {
                    try {
                        await apiRequest(`/projects/${project.id}`, 'DELETE');
                    } catch(e) {
                        console.error(`Failed to delete project ${project.slug} from server.`);
                        // If it fails, we don't currently roll back the UI, but we could.
                    }
                }
            }
        }
    );
}

async function handleGenerationRequest() {
    if (!currentProjectId) return;
    
    let userPrompt = promptInput.value.trim();
    if (!userPrompt && selectedImages.length === 0) return;

    setLoading(true);
    showIframeLoadingAnimation();

    try {
        // Get custom API key (Pollinations / BYOP) if present
        const customApiKey = localStorage.getItem('customApiKey') || localStorage.getItem('pollenApiKey');

        const data = await apiRequest('/generate', 'POST', {
            projectId: currentProjectId,
            prompt: userPrompt,
            model: selectedModel,
            abilities: selectedAbilities,
            apiKey: customApiKey,
            images: selectedImages
        });

        if (data.success) {
            projects[currentProjectId] = data.project;
            saveProjectsToLocalStorage();
            clearSelectedImages();
            renderProjectState();
            // Play success sound (best-effort; may be blocked until user interacts with page)
            try { successSound.currentTime = 0; successSound.play().catch(()=>{}); } catch(e){ /* ignore */ }
        } else {
            showErrorModal('Generation Failed', data.message);
            try { errorSound.currentTime = 0; errorSound.play().catch(()=>{}); } catch(e){ /* ignore */ }
        }

    } catch (error) {
        logger.error("Error handling generation request:", error);
        showErrorModal('Generation Error', 'An unexpected error occurred during generation.');
        try { errorSound.currentTime = 0; errorSound.play().catch(()=>{}); } catch(e){ /* ignore */ }
    } finally {
        setLoading(false);
    }
}

// Events
promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
        openAuthModal();
        return;
    }
    if (abortController) { // If generating, stop it
        abortController.abort();
        setLoading(false);
    } else { // Otherwise, start generation
        handleGenerationRequest();
    }
});



newProjectBtn.addEventListener('click', openNewProjectModal);
welcomeNewProjectBtn.addEventListener('click', openNewProjectModal);

fullscreenBtn.addEventListener('click', () => {
    browserContainer.classList.toggle('fullscreen');
});

shareBtn.addEventListener('click', () => {
    if (currentView.type === 'project' && currentView.isViewing) {
        navigateTo('/'); // Go back to user's own projects
    } else {
        openShareModal();
    }
});

if (forkBtn) {
    forkBtn.addEventListener('click', async () => {
        // Only show fork action when viewing someone else's project
        if (currentView.type === 'project' && currentView.isViewing && currentView.username && currentView.slug) {
            await forkProject(currentView.username, currentView.slug);
        } else if (currentProjectId && projects[currentProjectId]) {
            // If it's your own project, duplicate it as a quick copy
            const project = projects[currentProjectId];
            const copyTitle = project.title + ' (Copy)';
            const copySlug = slugify(copyTitle) || `${project.slug}-copy`;
            const newId = await createNewProject(copyTitle, copySlug, project.description || '', project.visibility || 'unlisted');
            // Copy versions
            const original = JSON.parse(JSON.stringify(project));
            const newProject = projects[newId];
            newProject.versions = original.versions;
            newProject.currentVersionId = original.currentVersionId;
            saveProject(newProject).then(() => {
                navigateTo(`/@${discordUsername}/${newProject.slug}`);
            }).catch(() => {
                navigateTo(`/@${discordUsername}/${newProject.slug}`);
            });
        } else {
            showErrorModal('Cannot fork', 'Nothing to fork.');
        }
    });
}

 // --- Download project as ZIP & Upload files (UI hookup) ---
const downloadBtn = document.getElementById('download-btn');
const uploadBtn = document.getElementById('upload-btn');
const uploadInput = document.getElementById('uploadInput');

// Download handler (unchanged)
if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
        if (!isLoggedIn) {
            openAuthModal();
            return;
        }

        if (currentView.type === 'project' && currentView.isViewing && currentView.username && currentView.username !== discordUsername) {
            showErrorModal('Download Not Allowed', 'To download someone else\'s project, fork it into your account first.');
            return;
        }

        const project = currentProjectId ? projects[currentProjectId] : null;
        if (!project) {
            showErrorModal('No Project Selected', 'Select one of your projects to download.');
            return;
        }

        try {
            setLoading(true);
            const resp = await fetch(`/api/v1/projects/${project.id}/download`, { method: 'GET' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ message: 'Failed to download' }));
                throw new Error(err.message || `HTTP ${resp.status}`);
            }

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project.slug || project.id}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            showErrorModal('Download Failed', e.message || 'An error occurred while downloading the ZIP.');
        } finally {
            setLoading(false);
        }
    });
}

// Upload handler: selecting files triggers hidden input; submit files as multipart to create a new revision
if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isLoggedIn) {
            openAuthModal();
            return;
        }
        if (!currentProjectId || !projects[currentProjectId]) {
            showErrorModal('No Project Selected', 'Select a project to upload files into.');
            return;
        }
        uploadInput.click();
    });

    uploadInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const project = projects[currentProjectId];
        if (!project) {
            showErrorModal('No Project Selected', 'Select a project to upload files into.');
            uploadInput.value = '';
            return;
        }

        const form = new FormData();
        files.forEach(f => form.append('files', f, f.name));

        try {
            setLoading(true);
            showIframeLoadingAnimation();
            const resp = await fetch(`/api/v1/projects/${project.id}/upload`, {
                method: 'POST',
                body: form
            });
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            if (data.success && data.project) {
                // Replace local project with updated returned project and re-render
                projects[project.id] = data.project;
                saveProjectsToLocalStorage();
                currentProjectId = project.id;
                renderProjectState();
            } else {
                showErrorModal('Upload Failed', data.message || 'Upload did not return a valid project.');
            }
        } catch (err) {
            logger.error('Upload error', err);
            showErrorModal('Upload Failed', err.message || 'An error occurred while uploading files.');
        } finally {
            setLoading(false);
            uploadInput.value = '';
        }
    });
}

// Clean up old sidebar event listeners

// Toggle Logic
let sidebarCollapsed = false;

function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    
    // Enable transitions for the toggle animation
    sidebarPanel.style.transition = 'width 0.3s cubic-bezier(.22,.61,.36,1), opacity 0.2s ease-in-out';
    
    if (sidebarCollapsed) {
        sidebarPanel.style.width = '0px';
        sidebarPanel.style.opacity = '0';
        sidebarResizer.classList.add('hidden');
        sidebarToggleBtn.innerHTML = '<i data-lucide="panel-left" class="h-5 w-5"></i>';
    } else {
        const savedWidth = localStorage.getItem('sidebarWidth') || '320';
        sidebarPanel.style.width = `${savedWidth}px`;
        sidebarPanel.style.opacity = '1';
        sidebarResizer.classList.remove('hidden');
        sidebarToggleBtn.innerHTML = '<i data-lucide="panel-right" class="h-5 w-5"></i>';
    }
    lucide.createIcons();
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
}

sidebarToggleBtn.addEventListener('click', toggleSidebar);

// Sidebar Resizing Logic
let isResizing = false;
sidebarResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    sidebarPanel.style.transition = 'none'; // Disable transition during manual drag
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const containerWidth = browserContainer.offsetWidth;
    const railWidth = 48; // Fixed width of the right rail
    const minWidth = 320; // 20rem
    const maxWidth = containerWidth * 0.6; // Max 60% of viewport
    
    // Calculate new width: mouse position is relative to viewport, 
    // sidebar is on the right, so width is window.width - e.clientX - railWidth
    const viewportWidth = window.innerWidth;
    const browserRect = browserContainer.getBoundingClientRect();
    const relativeX = e.clientX - browserRect.left;
    
    let newWidth = browserRect.width - relativeX - railWidth;
    
    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    
    sidebarPanel.style.width = `${newWidth}px`;
    localStorage.setItem('sidebarWidth', newWidth);
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        sidebarPanel.style.transition = 'width 0.3s cubic-bezier(.22,.61,.36,1)'; // Re-enable for collapses
    }
});

// Load saved sidebar width
const savedWidth = localStorage.getItem('sidebarWidth');
if (savedWidth && !sidebarCollapsed) {
    sidebarPanel.style.width = `${savedWidth}px`;
} else if (sidebarCollapsed) {
    sidebarPanel.style.width = '0px';
    sidebarPanel.style.opacity = '0';
    sidebarResizer.classList.add('hidden');
}

// Rail Button Listeners
tabVersions.addEventListener('click', () => { sidebarView = 'versions'; renderSidebarContent(); });
tabProjects.addEventListener('click', () => { sidebarView = 'projects'; renderSidebarContent(); });
tabSocial.addEventListener('click', () => { sidebarView = 'social'; renderSidebarContent(); });

tabFiles.addEventListener('click', () => { 
    sidebarView = 'files'; 
    currentOpenFile = null; // Reset editor view when clicking tab
    renderSidebarContent(); 
});

railVersionsBtn.addEventListener('click', () => { 
    if (sidebarCollapsed) toggleSidebar();
    sidebarView = 'versions'; 
    renderSidebarContent(); 
});
railProjectsBtn.addEventListener('click', () => { 
    if (sidebarCollapsed) toggleSidebar();
    sidebarView = 'projects'; 
    renderSidebarContent(); 
});
railSocialBtn.addEventListener('click', () => { 
    if (sidebarCollapsed) toggleSidebar();
    sidebarView = 'social'; 
    renderSidebarContent(); 
});

// Initial Sidebar State
const savedCollapsed = localStorage.getItem('sidebarCollapsed');
if (savedCollapsed === 'true') {
    sidebarCollapsed = false; // set to false so toggle flips it to true
    toggleSidebar();
}

userProfileButton.addEventListener('click', openSettingsModal);

// Image Handling Logic
function addImage(base64) {
    const config = modelConfig[selectedModel];
    if (!config || !config.supportsVision) {
        showErrorModal("Vision Not Supported", `The model <strong>${selectedModel}</strong> does not support vision capabilities. Please switch to a vision-enabled model (e.g., GPT-5 or Claude) to upload images.`);
        return;
    }

    if (selectedImages.length >= 5) {
        showErrorModal("Limit Reached", "You can only upload up to 5 images per request.");
        return;
    }

    selectedImages.push(base64);
    renderImagePreviews();
}

function renderImagePreviews() {
    if (selectedImages.length > 0) {
        imagePreviewContainer.classList.remove('hidden');
        imagePreviewContainer.innerHTML = '';
        selectedImages.forEach((img, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative group w-12 h-12';
            wrapper.innerHTML = `
                <img src="${img}" class="w-full h-full object-cover rounded-lg border border-zinc-700">
                <button type="button" class="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" data-index="${index}">
                    <i data-lucide="x" class="h-2.5 w-2.5"></i>
                </button>
            `;
            wrapper.querySelector('button').addEventListener('click', (e) => {
                e.preventDefault();
                selectedImages.splice(index, 1);
                renderImagePreviews();
            });
            imagePreviewContainer.appendChild(wrapper);
        });
        lucide.createIcons();
    } else {
        imagePreviewContainer.classList.add('hidden');
    }
}

function clearSelectedImages() {
    selectedImages = [];
    renderImagePreviews();
}

// Prompt Input Logic
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        promptForm.requestSubmit();
    }
});

promptInput.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => addImage(event.target.result);
            reader.readAsDataURL(blob);
        }
    }
});

promptInput.addEventListener('dragover', (e) => {
    e.preventDefault();
    promptInput.classList.add('bg-blue-500/5');
});

promptInput.addEventListener('dragleave', () => {
    promptInput.classList.remove('bg-blue-500/5');
});

promptInput.addEventListener('drop', (e) => {
    e.preventDefault();
    promptInput.classList.remove('bg-blue-500/5');
    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
        if (files[i].type.indexOf('image') !== -1) {
            const reader = new FileReader();
            reader.onload = (event) => addImage(event.target.result);
            reader.readAsDataURL(files[i]);
        }
    }
});

promptInput.addEventListener('focus', () => {
    // Optional: Enhance focus state if needed
});

promptInput.addEventListener('input', updateProjectInfoPanel);

// Model Selector Logic
if (modelSelectorBtn) {
    modelSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = modelDropdown.classList.contains('visible-state');
        
        // Close others
        experimentalDropdown.classList.remove('visible-state');
        experimentalDropdown.classList.add('hidden-state');
        
        if (isOpen) {
            modelDropdown.classList.remove('visible-state');
            modelDropdown.classList.add('hidden-state');
        } else {
            modelDropdown.classList.remove('hidden-state');
            modelDropdown.classList.add('visible-state');
        }
    });
}

function updateModelUI(modelName) {
    selectedModel = modelName;
    localStorage.setItem('selectedModel', selectedModel);
    
    const config = modelConfig[selectedModel];
    if (!config) return;

    if (selectedModelIconContainer) {
        selectedModelIconContainer.innerHTML = `<img src="${config.icon}" alt="${selectedModel}" class="h-3 w-3 rounded-sm">`;
        const labelSpan = modelSelectorBtn.querySelector('span:not(#selectedModelIconContainer)');
        if (labelSpan) labelSpan.textContent = selectedModel;
        lucide.createIcons();
    }
    updateProjectInfoPanel();
}

document.querySelectorAll('.model-option').forEach(option => {
    // Ensure the option has a small inline info badge after the label
    const modelName = option.dataset.model;
    const cfg = modelConfig[modelName];
    if (cfg) {
        // create info badge if not present
        if (!option.querySelector('.model-info-badge')) {
            const infoBtn = document.createElement('button');
            infoBtn.type = 'button';
            // place the badge tightly next to the model name
            infoBtn.className = 'model-info-badge ml-0 text-[11px] px-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 transition-colors';
            infoBtn.setAttribute('aria-label', `Info about ${modelName}`);
            infoBtn.innerHTML = `<i data-lucide="info" class="h-3 w-3"></i>`;
            // attach data for tooltip
            infoBtn.dataset.model = modelName;
            // Append inline at the end of the option (it is a flex row)
            const rightArea = option.querySelector('div') || option;
            rightArea.appendChild(infoBtn);
        }
    }

    option.addEventListener('click', (e) => {
        // If clicking the info badge, do not select the model
        if (e.target.closest('.model-info-badge')) return;
        updateModelUI(e.currentTarget.dataset.model);
        if (modelDropdown) {
           modelDropdown.classList.remove('visible-state');
           modelDropdown.classList.add('hidden-state');
        }
    });
});

 // Lightweight tooltip for model info badges
function createModelTooltips() {
    document.querySelectorAll('.model-info-badge').forEach(btn => {
        const modelName = btn.dataset.model;
        const cfg = modelConfig[modelName];
        if (!cfg) return;

        let tipEl = null;
        const showTip = () => {
            if (tipEl) return;

            tipEl = document.createElement('div');
            tipEl.className = 'model-info-tooltip z-[70] max-w-xs text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-md p-2 shadow-lg flex gap-2 items-start';
            tipEl.style.position = 'absolute';
            tipEl.style.transform = 'translateY(-8px)';
            tipEl.style.pointerEvents = 'none';

            // Build inner content with icon + title + short info + pollen/paid indicator
            const iconHtml = cfg.icon ? `<img src="${cfg.icon}" alt="${modelName}" class="h-5 w-5 rounded-sm flex-shrink-0">` : `<div class="h-5 w-5 rounded-sm bg-zinc-800 flex-shrink-0"></div>`;
            const pollenBadge = cfg.requiresPollen ? `<div class="text-[11px] text-amber-400 font-semibold mt-0.5">Requires purchased pollen</div>` : `<div class="text-[11px] text-zinc-500 mt-0.5">Free</div>`;
            const infoText = escapeHtml(cfg.info || 'No additional info.');
            const visionBadge = cfg.supportsVision ? `<div class="text-[11px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1"><i data-lucide="image" class="h-3 w-3"></i>Vision</div>` : '';

            tipEl.innerHTML = `
                <div class="flex-none">${iconHtml}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <div class="font-medium text-[12px] text-zinc-100 truncate">${modelName}</div>
                    </div>
                    <div class="text-[11px] text-zinc-300 mt-1 leading-snug break-words">${infoText}</div>
                    <div class="mt-1 flex flex-col gap-1">
                        ${pollenBadge}
                        ${visionBadge}
                    </div>
                </div>
            `;
            document.body.appendChild(tipEl);

            // Position tooltip above the button, center aligned relative to the button
            const rect = btn.getBoundingClientRect();
            const tipRect = tipEl.getBoundingClientRect();
            let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
            // Clamp to viewport
            left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
            const top = rect.top + window.scrollY - tipRect.height - 10;
            tipEl.style.left = `${left + window.scrollX}px`;
            tipEl.style.top = `${top}px`;

            // Ensure lucide icons inside tooltip render
            lucide.createIcons();
        };

        const hideTip = () => {
            if (tipEl) {
                tipEl.remove();
                tipEl = null;
            }
        };

        btn.addEventListener('mouseenter', showTip);
        btn.addEventListener('focus', showTip);
        btn.addEventListener('mouseleave', hideTip);
        btn.addEventListener('blur', hideTip);
    });
}

// Call once to create badges/tooltips for the current DOM
createModelTooltips();

document.addEventListener('click', (e) => {
    // Prevent hash-only links or same-origin anchors that point to netsim.us.to from performing a full navigation.
    // This keeps in-app routing intact (anchors like "#" or links pointing back to netsim.us.to won't reload the shell).
    const anchor = e.target.closest('a[href]');
    if (anchor) {
        try {
            const href = anchor.getAttribute('href') || '';
            // If it's a hash-only link (e.g., "#section") do nothing.
            if (href.startsWith('#')) {
                e.preventDefault();
                return;
            }
            // If link points to netsim.us.to (any scheme) or same-origin with a hash fragment,
            // prevent default full navigation and let client router handle it.
            const linkUrl = new URL(href, window.location.href);
            const isSameHost = linkUrl.host === window.location.host || linkUrl.host === 'netsim.us.to';
            if (isSameHost && (linkUrl.pathname === window.location.pathname || linkUrl.pathname === '/')) {
                // For same-page anchors or links back to root shell, prevent reload.
                if (linkUrl.hash || linkUrl.pathname === '/' || linkUrl.origin.includes('netsim.us.to')) {
                    e.preventDefault();
                    // If it points to a project path we want to route to, use navigateTo for SPA routing.
                    const projectMatch = linkUrl.pathname.match(/^\/@([\w-]+)\/([\w-]+)/);
                    if (projectMatch) {
                        const [, u, s] = projectMatch;
                        const v = linkUrl.searchParams.get('v');
                        const path = v ? `/@${u}/${s}?v=${v}` : `/@${u}/${s}`;
                        navigateTo(path);
                    } else if (linkUrl.pathname === '/' || linkUrl.pathname === '') {
                        navigateTo('/');
                    }
                    return;
                }
            }
        } catch (err) {
            // If URL parsing fails, fall back to default behavior.
        }
    }

    const dropdowns = [
        { btn: modelSelectorBtn, menu: modelDropdown },
        { btn: experimentalBtn, menu: experimentalDropdown },
        { btn: projectVisibilityBtn, menu: projectVisibilityDropdown },
        { btn: editProjectVisibilityBtn, menu: editProjectVisibilityDropdown },
        { btn: profileProjectBtn, menu: profileProjectDropdown }
    ];

    dropdowns.forEach(({ btn, menu }) => {
        if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove('visible-state');
            menu.classList.add('hidden-state');
        }
    });
});

// Dropdown Toggles
[
    { btn: projectVisibilityBtn, menu: projectVisibilityDropdown },
    { btn: editProjectVisibilityBtn, menu: editProjectVisibilityDropdown },
    { btn: profileProjectBtn, menu: profileProjectDropdown }
].forEach(({ btn, menu }) => {
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('visible-state');
            
            // Close all first
            document.querySelectorAll('.dropdown-content').forEach(d => {
                d.classList.remove('visible-state');
                d.classList.add('hidden-state');
            });

            if (!isOpen) {
                menu.classList.remove('hidden-state');
                menu.classList.add('visible-state');
            }
        });
    }
});

// Visibility Selection
document.addEventListener('click', (e) => {
    const newVisOpt = e.target.closest('.new-visibility-option');
    if (newVisOpt) {
        currentNewProjectVisibility = newVisOpt.dataset.value;
        projectVisibilityLabel.textContent = newVisOpt.textContent;
        projectVisibilityDropdown.classList.remove('visible-state');
        projectVisibilityDropdown.classList.add('hidden-state');
    }

    const editVisOpt = e.target.closest('.edit-visibility-option');
    if (editVisOpt) {
        currentEditProjectVisibility = editVisOpt.dataset.value;
        editProjectVisibilityLabel.textContent = editVisOpt.textContent;
        editProjectVisibilityDropdown.classList.remove('visible-state');
        editProjectVisibilityDropdown.classList.add('hidden-state');
    }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    toggleSidebar();
  }
});

// --- Settings Modal Logic ---
function openSettingsModal() {
    settingsModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        settingsModal.classList.remove('opacity-0');
        settingsModalContent.classList.remove('scale-95', 'opacity-0');
    });
    populateProfileProjectSelector();
    populateHomepageProjectSetting();
    populateAISettings();
    // Show the profile section by default
    showSettingsSection('profile');
    
    // Ensure icons in danger zone etc are rendered
    setTimeout(() => lucide.createIcons(), 0);
}

function closeSettingsModal() {
    settingsModal.classList.add('opacity-0');
    settingsModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        settingsModal.classList.add('pointer-events-none');
    }, 200); // Match animation duration
}

function showSettingsSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.settings-section').forEach(section => {
        section.classList.add('hidden');
    });
    // Deactivate all nav buttons
    document.querySelectorAll('.settings-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show the target section
    const sectionToShow = document.getElementById(`settings-section-${sectionId}`);
    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
    // Activate the target nav button
    const btnToActivate = document.querySelector(`.settings-nav-btn[data-section="${sectionId}"]`);
    if (btnToActivate) {
        btnToActivate.classList.add('active');
    }
}

function setInitialTheme() {
    document.documentElement.classList.add('dark');
}

settingsBtn.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettingsModal();
    }
});
clearHistoryBtn.addEventListener('click', clearAllProjects);

deleteAccountBtn?.addEventListener('click', () => {
    if (!isLoggedIn) return;
    showConfirmationModal(
        'Delete Account',
        'Are you sure you want to delete your account? This will permanently erase your profile, all your projects, and all your data. This action is irreversible.',
        async () => {
            try {
                const data = await apiRequest('/me', 'DELETE');
                if (data.success) {
                    // Clear local state
                    projects = {};
                    saveProjectsToLocalStorage();
                    isLoggedIn = false;
                    discordUsername = 'guest';
                    // Refresh and go home
                    window.location.href = '/';
                }
            } catch (error) {
                showErrorModal('Deletion Failed', error.message);
            }
        }
    );
});

document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        showSettingsSection(section);
    });
});



async function populateProfileProjectSelector() {
    if (!isLoggedIn || !profileProjectDropdown) return;

    try {
        const profileData = await apiRequest(`/users/${discordUsername}/profile`);
        const currentProfileSlug = profileData.profile_slug;
        currentProfileProjectSlug = currentProfileSlug;
        settingsBio.value = profileData.bio || '';

        profileProjectDropdown.innerHTML = ''; // Clear existing options
        
        const sortedProjects = Object.values(projects).sort((a,b) => a.title.localeCompare(b.title));

        const projectsList = [...sortedProjects];
        // Ensure 'profile' project is an option even if deleted
        if (!projectsList.some(p => p.slug === 'profile')) {
            projectsList.unshift({ slug: 'profile', title: 'Default Profile' });
        }

        projectsList.forEach(project => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'profile-project-option menu-item w-full text-left';
            btn.dataset.value = project.slug;
            btn.textContent = project.title;
            
            if (project.slug === currentProfileSlug) {
                profileProjectLabel.textContent = project.title;
            }

            btn.addEventListener('click', async () => {
                const newSlug = project.slug;
                try {
                    await apiRequest('/me/profile', 'PUT', { slug: newSlug });
                    currentProfileProjectSlug = newSlug;
                    profileProjectLabel.textContent = project.title;
                    profileProjectDropdown.classList.remove('visible-state');
                    profileProjectDropdown.classList.add('hidden-state');
                } catch (error) {
                    showErrorModal('Update Failed', `Could not set profile project: ${error.message}`);
                }
            });

            profileProjectDropdown.appendChild(btn);
        });
    } catch(error) {
        logger.error("Failed to populate profile selector:", error);
    }
}

async function populateHomepageProjectSetting() {
    if (!homepageProjectInput) return;
    try {
        const homepageData = await apiRequest('/me/homepage');
        homepageProjectInput.value = homepageData.path || '';
    } catch(error) {
        logger.error("Failed to populate homepage setting:", error);
        homepageProjectInput.value = '';
    }
}

async function populateAISettings() {
    if (!customInstructionsInput) return;
    try {
        const data = await apiRequest('/me/ai_settings');
        if (data.success) {
            customInstructionsInput.value = data.custom_instructions || '';
        }
    } catch (error) {
        logger.error("Failed to populate AI settings:", error);
        customInstructionsInput.value = '';
    }
}



resetProfileBtn.addEventListener('click', async () => {
    try {
        await apiRequest('/me/profile', 'PUT', { slug: 'profile' });
        populateProfileProjectSelector();
    } catch (error) {
        showErrorModal('Update Failed', `Could not reset profile project: ${error.message}`);
    }
});

homepageProjectInput.addEventListener('change', async (e) => {
    const newPath = e.target.value.trim();
    try {
        await apiRequest('/me/homepage', 'PUT', { path: newPath || null });
    } catch (error) {
        showErrorModal('Update Failed', `Could not set homepage project: ${error.message}`);
        // Re-populate to revert UI change
        populateHomepageProjectSetting();
    }
});

resetHomepageBtn.addEventListener('click', async () => {
    try {
        await apiRequest('/me/homepage', 'PUT', { path: null });
        populateHomepageProjectSetting();
    } catch (error) {
        showErrorModal('Update Failed', `Could not reset homepage: ${error.message}`);
    }
});

// --- Auth Modal Logic ---
let isLoginMode = true;

function openAuthModal(startInLoginMode = true) {
    isLoginMode = startInLoginMode;
    updateAuthModalUI();
    authErrorMessage.classList.add('hidden');
    authForm.reset();

    authModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        authModal.classList.remove('opacity-0');
        authModalContent.classList.remove('scale-95', 'opacity-0');
        authUsername.focus();
    });
}

function closeAuthModal() {
    authModal.classList.add('opacity-0');
    authModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        authModal.classList.add('pointer-events-none');
    }, 200);
}

function updateAuthModalUI() {
    if (isLoginMode) {
        authModalTitle.textContent = 'Welcome back';
        authModalSubtitle.textContent = 'Enter your credentials to continue.';
        authSubmitBtn.querySelector('span').textContent = 'Login';
        authToggleLink.innerHTML = "Don't have an account? <strong>Sign up</strong>";
    } else {
        authModalTitle.textContent = 'Create an Account';
        authModalSubtitle.textContent = 'Get started with netsim to save and share your projects.';
        authSubmitBtn.querySelector('span').textContent = 'Create Account';
        authToggleLink.innerHTML = "Already have an account? <strong>Login</strong>";
    }
}

authToggleLink.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthModalUI();
    authErrorMessage.classList.add('hidden');
    authForm.reset();
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = authUsername.value;
    const password = authPassword.value;
    const endpoint = isLoginMode ? '/login' : '/signup';

    // Show loading state
    authSubmitBtn.disabled = true;
    authSubmitBtn.querySelector('.btn-text').classList.add('opacity-0');
    authSubmitBtn.querySelector('.btn-spinner').classList.remove('opacity-0');
    authErrorMessage.classList.add('hidden');

    try {
        const data = await apiRequest(endpoint, 'POST', { username, password });
        if (data.success) {
            closeAuthModal();
            closeSettingsModal();
            await checkUserStatus();
        } else {
            // This case should be caught by the error handler, but as a fallback
            authErrorMessage.textContent = data.message || 'An unexpected error occurred.';
            authErrorMessage.classList.remove('hidden');
        }
    } catch (error) {
        authErrorMessage.textContent = error.message;
        authErrorMessage.classList.remove('hidden');
    } finally {
        // Hide loading state
        authSubmitBtn.disabled = false;
        authSubmitBtn.querySelector('.btn-text').classList.remove('opacity-0');
        authSubmitBtn.querySelector('.btn-spinner').classList.add('opacity-0');
    }
});

closeAuthModalBtn.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
});

welcomeLoginBtn.addEventListener('click', () => {
    closeWelcomeModal();
    openAuthModal();
});

settingsLoginBtn.addEventListener('click', () => {
    openAuthModal();
});

saveUsernameBtn?.addEventListener('click', async () => {
    const newUsername = changeUsernameInput.value.trim();
    if (!newUsername || newUsername === discordUsername) return;

    saveUsernameBtn.disabled = true;
    try {
        const data = await apiRequest('/me/username', 'PUT', { username: newUsername });
        if (data.success) {
            discordUsername = newUsername;
            updateLoggedInUI(newUsername, sidebarAvatar.src);
            showErrorModal('Success', 'Username updated successfully.');
        }
    } catch (error) {
        showErrorModal('Update Failed', error.message);
    } finally {
        saveUsernameBtn.disabled = false;
    }
});

discordLoginBtn?.addEventListener('click', () => {
    // Redirect to Discord OAuth endpoint
    window.location.href = '/api/v1/auth/discord';
});

logoutBtn?.addEventListener('click', async () => {
    try {
        await apiRequest('/logout', 'POST');
        updateLoggedOutUI();
        // Optionally, close settings modal on logout
        closeSettingsModal();
    } catch (error) {
        showErrorModal('Logout Failed', error.message);
    }
});

avatarUploadBtn.addEventListener('click', () => {
    avatarUploadInput.click();
});

avatarUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        showErrorModal('Upload Failed', 'File size cannot exceed 2MB.');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch('/api/v1/me/avatar', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload failed');
        }

        const data = await response.json();
        if (data.success && data.avatar_url) {
            // Update UI with new avatar
            sidebarAvatar.src = data.avatar_url;
            settingsAvatarPreview.src = data.avatar_url;
        } else {
            throw new Error(data.message || 'Server did not return a valid URL.');
        }

    } catch (error) {
        showErrorModal('Upload Failed', error.message);
    } finally {
        // Reset file input to allow re-uploading the same file
        avatarUploadInput.value = '';
    }
});

settingsBio.addEventListener('change', async (e) => {
    const newBio = e.target.value;
    try {
        await apiRequest('/me/bio', 'PUT', { bio: newBio });
    } catch (error) {
        showErrorModal('Update Failed', `Could not update bio: ${error.message}`);
    }
});

customInstructionsInput?.addEventListener('change', async (e) => {
    const val = e.target.value;
    try {
        await apiRequest('/me/ai_settings', 'PUT', { custom_instructions: val });
    } catch (error) {
        showErrorModal('Update Failed', `Could not update AI settings: ${error.message}`);
    }
});


// --- Welcome Modal Logic ---
function openWelcomeModal() {
    welcomeModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        welcomeModal.classList.remove('opacity-0');
        welcomeModalContent.classList.remove('scale-95', 'opacity-0');
    });
}

function closeWelcomeModal() {
    welcomeModal.classList.add('opacity-0');
    welcomeModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        welcomeModal.classList.add('pointer-events-none');
    }, 200); // Match animation duration
    localStorage.setItem('hasSeenWelcomeModal', 'true');
}

welcomeModalContinue.addEventListener('click', closeWelcomeModal);

// --- Confirmation Modal Logic ---
let confirmCallback = null;

function showConfirmationModal(title, message, onConfirm) {
    confirmationModalTitle.textContent = title;
    // Allow HTML in the confirmation message so callers can include emphasis/strong tags.
    confirmationModalMessage.innerHTML = message;
    confirmCallback = onConfirm;

    confirmationModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        confirmationModal.classList.remove('opacity-0');
        confirmationModalContent.classList.remove('scale-95', 'opacity-0');
    });
}

function hideConfirmationModal() {
    confirmationModal.classList.add('opacity-0');
    confirmationModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        confirmationModal.classList.add('pointer-events-none');
        confirmCallback = null; // Clear callback
    }, 200); // Match animation duration
}

confirmationModalConfirm.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') {
        confirmCallback();
    }
    hideConfirmationModal();
});

confirmationModalCancel.addEventListener('click', hideConfirmationModal);

confirmationModal.addEventListener('click', (e) => {
    if (e.target === confirmationModal) {
        hideConfirmationModal();
    }
});

// --- Server Error Modal ---
let retryCallback = null;

function showErrorModal(title, message, onRetry) {
    errorModalTitle.textContent = title;
    errorModalMessage.innerHTML = message;

    if (typeof onRetry === 'function') {
        errorModalRetry.classList.remove('hidden');
        retryCallback = onRetry;
    } else {
        errorModalRetry.classList.add('hidden');
        retryCallback = null;
    }

    errorModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        errorModal.classList.remove('opacity-0');
        errorModalContent.classList.remove('scale-95', 'opacity-0');
    });
}

function hideErrorModal() {
    errorModal.classList.add('opacity-0');
    errorModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        errorModal.classList.add('pointer-events-none');
        retryCallback = null;
    }, 200);
}

errorModalClose.addEventListener('click', hideErrorModal);
errorModalRetry.addEventListener('click', () => {
    if (typeof retryCallback === 'function') {
        hideErrorModal();
        setTimeout(retryCallback, 250);
    }
});
errorModal.addEventListener('click', (e) => {
    if (e.target === errorModal) {
        hideErrorModal();
    }
});

// --- Rename Modal Logic ---
function renameProject(projectId) {
    renameProjectId = projectId;
    renameInput.value = projects[renameProjectId].title;

    renameModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        renameModal.classList.remove('opacity-0');
        renameModalContent.classList.remove('scale-95', 'opacity-0');
        renameInput.focus();
        renameInput.select();
    });
}

function hideRenameModal() {
    renameModal.classList.add('opacity-0');
    renameModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        renameModal.classList.add('pointer-events-none');
        renameProjectId = null;
    }, 200);
}

renameModalSave.addEventListener('click', async () => {
    // If fileRenameTarget is set, perform a file rename; otherwise treat as project rename
    if (window.fileRenameTarget && window.fileRenameTarget.projectId) {
        const target = window.fileRenameTarget;
        const project = projects[target.projectId];
        const ver = project.versions[project.currentVersionId] || {};
        const files = ver.files ? { ...ver.files } : {
            'index.html': ver.html || '',
            'style.css': ver.css || '',
            'script.js': ver.js || ''
        };

        const oldPath = target.oldPath;
        const newName = renameInput.value.trim();
        // Clear the temporary marker immediately to avoid double-actions
        window.fileRenameTarget = null;
        renameModalTitle.textContent = 'Rename Project';

        if (!newName || newName === oldPath) {
            hideRenameModal();
            return;
        }
        if (files[newName]) {
            showErrorModal('Rename Failed', 'A file with that name already exists.');
            hideRenameModal();
            return;
        }

        // Perform rename in the file map
        files[newName] = files[oldPath];
        delete files[oldPath];

        // Create new version with updated files
        const newVersionId = `v_${Date.now()}`;
        project.versions[newVersionId] = {
            id: newVersionId,
            prompt: `Renamed file ${oldPath} → ${newName}`,
            files,
            model: ver.model || 'uploaded',
            html: files['index.html'] || '',
            css: files['style.css'] || '',
            js: files['script.js'] || ''
        };
        project.currentVersionId = newVersionId;

        try {
            await saveProject(project);
            currentOpenFile = newName;
            renderProjectState();
        } catch (e) {
            showErrorModal('Rename Failed', e.message || 'Could not save renamed file.');
        } finally {
            hideRenameModal();
        }
        return;
    }

    // Existing project rename behavior
    if (renameProjectId && projects[renameProjectId]) {
        const newTitle = renameInput.value.trim();
        if (newTitle && newTitle !== projects[renameProjectId].title) {
            const oldSlug = projects[renameProjectId].slug;
            projects[renameProjectId].title = newTitle;
            // Only update slug if title changes
            const newSlug = slugify(newTitle);
            if (newSlug) {
                projects[renameProjectId].slug = newSlug;
            }
            
            try {
                await saveProject(projects[renameProjectId]);
            } catch (e) {
                // If save fails, we keep UI optimistic but notify
                logger.error('Project rename save failed:', e);
            }
            
            // If we renamed the currently viewed project, update the URL
            if(window.location.pathname.endsWith(oldSlug)) {
                navigateTo(`/@${discordUsername}/${projects[renameProjectId].slug}`);
            } else {
                renderProjectState();
            }
        }
    }
    hideRenameModal();
});

renameModalCancel.addEventListener('click', hideRenameModal);

renameModal.addEventListener('click', (e) => {
    if (e.target === renameModal) {
        hideRenameModal();
    }
});

renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        renameModalSave.click();
    } else if (e.key === 'Escape') {
        hideRenameModal();
    }
});

// --- Edit Project Modal Logic ---
let editProjectId = null;

function openEditProjectModal(projectId) {
    editProjectId = projectId;
    const project = projects[editProjectId];
    if (!project) return;

    editProjectTitleInput.value = project.title;
    editProjectSlugInput.value = project.slug;
    editProjectDescriptionInput.value = project.description || '';
    
    currentEditProjectVisibility = project.visibility || 'unlisted';
    const visText = currentEditProjectVisibility === 'public' ? 'Public (Shows on home)' : 'Unlisted (Hidden from home)';
    editProjectVisibilityLabel.textContent = visText;

    editProjectModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        editProjectModal.classList.remove('opacity-0');
        editProjectModalContent.classList.remove('scale-95', 'opacity-0');
        editProjectTitleInput.focus();
        editProjectTitleInput.select();
    });
}

function hideEditProjectModal() {
    editProjectModal.classList.add('opacity-0');
    editProjectModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        editProjectModal.classList.add('pointer-events-none');
        editProjectId = null;
    }, 200);
}

editProjectModalSave.addEventListener('click', async () => {
    if (!editProjectId || !projects[editProjectId]) return;

    const project = projects[editProjectId];
    const oldSlug = project.slug;

    const newTitle = editProjectTitleInput.value.trim();
    const newSlug = editProjectSlugInput.value.trim();
    const newDescription = editProjectDescriptionInput.value.trim();
    const newVisibility = currentEditProjectVisibility;

    if (!newTitle || !newSlug) {
        showErrorModal("Invalid Input", "Project title and slug cannot be empty.");
        return;
    }

    // Create a temporary updated project object for the request
    const updatedProject = {
        ...project,
        title: newTitle,
        slug: newSlug,
        description: newDescription,
        visibility: newVisibility
    };
    
    // Optimistically update UI
    projects[editProjectId] = updatedProject;
    
    try {
        await saveProject(updatedProject);
        // If slug changed and we are on that page, navigate to new URL
        const currentPath = window.location.pathname;
        const expectedOldPath = `/@${discordUsername}/${oldSlug}`;
        if (currentPath === expectedOldPath) {
            navigateTo(`/@${discordUsername}/${newSlug}`);
        } else {
            renderProjectState(); // Re-render sidebar and title
        }
        hideEditProjectModal();
    } catch (error) {
        // Rollback on failure
        projects[editProjectId] = project;
        showErrorModal('Update Failed', error.message);
        renderProjectState();
    }
});

editProjectModalCancel.addEventListener('click', hideEditProjectModal);

editProjectTitleInput.addEventListener('input', () => {
    editProjectSlugInput.value = slugify(editProjectTitleInput.value);
});

editProjectSlugInput.addEventListener('input', () => {
    editProjectSlugInput.value = slugify(editProjectSlugInput.value);
});

// --- Share Modal Logic ---
function openShareModal() {
    const project = projects[currentProjectId];
    if (!project) {
        showErrorModal("Cannot Share", "You must have a project selected to share it.");
        return;
    };
    if (!isLoggedIn) {
        showErrorModal("Login Required", "You must be logged in to share projects.");
        return;
    }
    
    // The public share URL should always point to the root, which serves the pinned/latest version
    const url = `${window.location.origin}/@${discordUsername}/${project.slug}`;
    shareUrlInput.value = url;

    // Set thumbnail preview
    if (shareThumbnailPreview) {
        shareThumbnailPreview.src = `https://netsim-img.ext.io/@${discordUsername}/${project.slug}?t=${Date.now()}`;
    }

    if (project.pinnedVersionId) {
        const versionNumber = getVersionNumber(project, project.pinnedVersionId);
        pinnedVersionLabel.textContent = `Version ${versionNumber}`;
        sharePinnedVersionInfo.classList.remove('hidden');
    } else {
        sharePinnedVersionInfo.classList.add('hidden');
    }
    
    shareModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        shareModal.classList.remove('opacity-0');
        shareModalContent.classList.remove('scale-95', 'opacity-0');
    });
}

function closeShareModal() {
    shareModal.classList.add('opacity-0');
    shareModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        shareModal.classList.add('pointer-events-none');
    }, 200);
}

closeShareModalBtn.addEventListener('click', closeShareModal);
shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) closeShareModal();
});

copyShareUrlBtn.addEventListener('click', () => {
    shareUrlInput.select();
    navigator.clipboard.writeText(shareUrlInput.value).then(() => {
        copyShareUrlBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyShareUrlBtn.textContent = 'Copy';
        }, 1500);
    });
});

updateThumbnailBtn.addEventListener('click', () => {
    const project = projects[currentProjectId];
    if (!project) return;
    
    const icon = updateThumbnailBtn.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
    updateThumbnailBtn.disabled = true;

    const thumbnailUrl = `https://netsim-img.ext.io/@${discordUsername}/${project.slug}?force=true&t=${Date.now()}`;
    
    // Create a temporary image to check when it's done loading
    const img = new Image();
    img.onload = () => {
        if (shareThumbnailPreview) shareThumbnailPreview.src = thumbnailUrl;
        if (icon) icon.classList.remove('animate-spin');
        updateThumbnailBtn.disabled = false;
    };
    img.onerror = () => {
        if (icon) icon.classList.remove('animate-spin');
        updateThumbnailBtn.disabled = false;
        showErrorModal('Thumbnail Error', 'Failed to refresh thumbnail. The imaging service might be busy.');
    };
    img.src = thumbnailUrl;
});

// --- View Prompt Modal Logic ---
function openPromptModal(prompt) {
    promptModalText.textContent = prompt;
    promptModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        promptModal.classList.remove('opacity-0');
        promptModalContent.classList.remove('scale-95', 'opacity-0');
    });
}

function closePromptModal() {
    promptModal.classList.add('opacity-0');
    promptModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        promptModal.classList.add('pointer-events-none');
    }, 200);
}

closePromptModalBtn.addEventListener('click', closePromptModal);
promptModal.addEventListener('click', (e) => {
    if (e.target === promptModal) {
        closePromptModal();
    }
});

// --- New Project Modal Logic ---
const projectPlaceholders = [
    "e.g., My Awesome Portfolio",
    "e.g., Landing page for a SaaS",
    "e.g., A blog about space travel",
    "e.g., Online store for handmade goods",
    "e.g., An event page for a music festival",
    "e.g., Recipe collection website",
    "e.g., 'SynthWave' product launch page",
    "e.g., Photography showcase",
];

function openNewProjectModal() {
    if (!isLoggedIn) {
        openAuthModal();
        return;
    }

    projectTitleInput.value = '';
    projectSlugInput.value = '';
    
    currentNewProjectVisibility = 'unlisted';
    projectVisibilityLabel.textContent = 'Unlisted (Hidden from home)';
    
    // Set a random placeholder
    const randomIndex = Math.floor(Math.random() * projectPlaceholders.length);
    projectTitleInput.placeholder = projectPlaceholders[randomIndex];
    
    newProjectModal.classList.remove('pointer-events-none');
    requestAnimationFrame(() => {
        newProjectModal.classList.remove('opacity-0');
        newProjectModalContent.classList.remove('scale-95', 'opacity-0');
        projectTitleInput.focus();
    });
}

function hideNewProjectModal() {
    newProjectModal.classList.add('opacity-0');
    newProjectModalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        newProjectModal.classList.add('pointer-events-none');
    }, 200);
}

projectTitleInput.addEventListener('input', () => {
    projectSlugInput.value = slugify(projectTitleInput.value);
});

projectSlugInput.addEventListener('input', () => {
    projectSlugInput.value = slugify(projectSlugInput.value);
});

newProjectModalCreate.addEventListener('click', () => {
    const title = projectTitleInput.value.trim();
    const slug = projectSlugInput.value.trim();
    const description = projectDescriptionInput.value.trim();
    const visibility = currentNewProjectVisibility;
    if (title && slug) {
        createNewProject(title, slug, description, visibility);
        hideNewProjectModal();
    }
});

newProjectModalCancel.addEventListener('click', hideNewProjectModal);

async function saveProject(project) {
    if (!project || !project.id) return;
    projects[project.id] = project; // Optimistic UI update
    
    if (isLoggedIn) {
        try {
            await apiRequest(`/projects/${project.id}`, 'PUT', { project_data: project });
            saveProjectsToLocalStorage(); // Sync local only on success
        } catch (error) {
            logger.error('Sync Error', `Could not save project changes to the server. ${error.message}`);
            showErrorModal('Save Error', `Could not save project changes to the server. Your latest changes might not be persisted. ${error.message}`);
            // Note: We are not rolling back the optimistic UI update here,
            // as it might discard user's work. The user is notified via the modal.
            throw error;
        }
    } else {
       saveProjectsToLocalStorage();
    }
}

function saveProjectsToLocalStorage() {
    try {
        localStorage.setItem('projects', JSON.stringify(projects));
    } catch (e) {
        logger.error("Failed to save projects to localStorage:", e);
    }
}

function loadProjectsFromLocalStorage() {
    try {
        const savedProjects = localStorage.getItem('projects');
        if (savedProjects) {
            projects = JSON.parse(savedProjects);
            // Migration for old data structure
            Object.values(projects).forEach(p => {
                if (!p.versions) {
                    logger.info(`Migrating project ${p.id}...`);
                    p.versions = {
                        [`v_${p.id}`]: {
                            id: `v_${p.id}`,
                            prompt: p.prompt || "Initial prompt",
                            html: p.html || "",
                            css: p.css || "",
                            js: p.js || ""
                        }
                    };
                    p.currentVersionId = `v_${p.id}`;
                    delete p.prompt;
                    delete p.html;
                    delete p.css;
                    delete p.js;
                    delete p.history; // This was unused
                }
                if(!p.slug) { // Add slug to old projects
                    p.slug = slugify(p.title);
                }
                if(typeof p.pinnedVersionId === 'undefined') { // Add pinnedVersionId to old projects
                    p.pinnedVersionId = null;
                }
                if(typeof p.description === 'undefined') { // Add description to old projects
                    p.description = "A project created in netsim.";
                }
            });
            saveProjectsToLocalStorage();
        }
    } catch (e) {
        logger.error("Failed to load projects from localStorage:", e);
        projects = {};
    }
}

copyUrlBtn.addEventListener('click', () => {
    const project = projects[currentProjectId];
    if (!project) return;
    const url = `${window.location.origin}/@${discordUsername}/${project.slug}`;
    navigator.clipboard.writeText(url).then(() => {
        const icon = copyUrlBtn.querySelector('i');
        icon.dataset.lucide = 'check';
        lucide.createIcons();
        setTimeout(() => {
            icon.dataset.lucide = 'copy';
            lucide.createIcons();
        }, 1500);
    });
});

// --- Simple Frontend Router ---
async function router() {
    const path = window.location.pathname;
    const projectMatch = path.match(/^\/@([\w-]+)\/([\w-]+)/);
    const profileMatch = path.match(/^\/@([\w-]+)\/?$/);
    const shareMatch = path.match(/^\/s\/([\w-]+)/);

    if (projectMatch) {
        const [, username, slug] = projectMatch;
        const searchParams = new URLSearchParams(window.location.search);
        const versionNumber = searchParams.get('v');
        await loadProjectView(username, slug, versionNumber);
    } else if (profileMatch) {
        // This is handled by a server-side redirect, but as a fallback client-side...
        const [, username] = profileMatch;
        try {
            const profileData = await apiRequest(`/users/${username}/profile`);
            navigateTo(`/@${username}/${profileData.profile_slug}`);
        } catch(e) {
            showErrorModal('User Not Found', `Could not find a profile for @${username}`);
            navigateTo('/');
        }
    } else if (shareMatch) {
        welcomeEl.classList.add('hidden');
        previewFrame.src = path; // Load the raw share page in the iframe
        projectTitleDisplay.textContent = 'Viewing Shared Note';
        promptInput.value = `${window.location.origin}${path}`;
        promptInput.disabled = true;
    } else {
        // Home view
        await loadHomepage();
    }
}

function navigateTo(path) {
    const fullUrl = new URL(path, window.location.origin);
    if (window.location.href !== fullUrl.href) {
        history.pushState({ path }, '', path);
    }
    router();
}

async function loadHomepage() {
    currentView = { type: 'home' };
    currentProjectId = null;
    
    try {
        const data = await apiRequest('/me/homepage');
        if (data.success) {
            // This loads the homepage content as a "view-only" project
            await loadProjectView(data.username, data.slug);
        } else {
            // No default homepage exists, show the main welcome screen
            renderProjectState();
        }
    } catch(e) {
        // API error, also show the main welcome screen
        logger.error("Could not load homepage", e.message);
        renderProjectState();
    }
}

async function loadProjectView(username, slug, versionNumber = null) {
    welcomeEl.classList.add('hidden');
    const projectUrl = `netsim.us.to/@${username}/${slug}`;
    const urlWithVersion = versionNumber ? `${projectUrl}?v=${versionNumber}` : projectUrl;
    promptInput.value = urlWithVersion;

    if (isLoggedIn && username === discordUsername) {
        const project = Object.values(projects).find(p => p.slug === slug);
        if (project) {
            currentProjectId = project.id;
            
            // Set the current version based on the URL
            if (versionNumber) {
                const versionId = getVersionIdByNumber(project, parseInt(versionNumber));
                if (versionId && project.versions[versionId]) {
                    project.currentVersionId = versionId;
                } else {
                     showErrorModal('Version Not Found', `Version ${versionNumber} does not exist for this project.`);
                     // Fallback to latest
                     project.currentVersionId = Object.keys(project.versions).sort((a,b) => b.localeCompare(a))[0];
                }
            }
            // if no version number, it will just use the last viewed one which is fine.

            currentView = { type: 'project', username, slug, isViewing: false };
            sidebarView = 'versions';
            renderProjectState();
        } else {
            showErrorModal('Project Not Found', `You don't have a project named "${slug}". Redirecting to your dashboard.`);
            navigateTo('/');
        }
    } else {
        // View-only mode for other's projects or when logged out
        currentProjectId = null; // Not editing one of our own
        currentView = { type: 'project', username, slug, isViewing: true };
        projectTitleDisplay.textContent = 'Loading project...';
        renderProjectState(); // Renders the UI in a "viewing" state

        try {
            const data = await apiRequest(`/p/${username}/${slug}`);
            if (data.success) {
                const project = data.project;
                currentView.title = project.title;
                currentView.description = project.description;
                updatePageMeta(project.title, project.description);
                projectTitleDisplay.textContent = project.title;

                // Also fetch profile slug to show correct context in UI
                try {
                    const profileData = await apiRequest(`/users/${username}/profile`);
                    currentView.profileSlug = profileData.profile_slug;
                } catch(e) {
                    logger.warn(`Could not fetch profile slug for ${username}`);
                }
                renderProjectState(); // Re-render with profile slug

                let version;
                if (versionNumber) {
                    const versionId = getVersionIdByNumber(project, parseInt(versionNumber));
                     version = versionId ? project.versions[versionId] : null;
                } else if (project.pinnedVersionId) {
                    version = project.versions[project.pinnedVersionId];
                } else {
                    const latestVersionId = Object.keys(project.versions).sort((a, b) => b.localeCompare(a))[0];
                    version = project.versions[latestVersionId];
                }

                if (version) {
                    updatePreview(version.html, version.css, version.js);
                } else {
                    showErrorModal('Version Not Found', 'The requested version could not be found.');
                    updatePreview('', '', ''); // Show empty page
                }
            } else {
                showErrorModal('Project Not Found', data.message);
                updatePreview('', '', '');
            }
        } catch (error) {
            showErrorModal('Error', `Could not load project: ${error.message}`);
            updatePreview('', '', '');
        }
    }
}

window.addEventListener('popstate', router);

// --- Ability Selector Logic ---
function updateSelectedAbilityUI() {
    if (!experimentalBtn) return;
    const experimentalIcon = experimentalBtn.querySelector('i');
    const badge = document.getElementById('experimentalBadge');
    let count = 0;

    document.querySelectorAll('.ability-option').forEach(option => {
        const ability = option.dataset.ability;
        const checkbox = option.querySelector('input[type="checkbox"]');
        const active = !!(selectedAbilities && selectedAbilities[ability]);
        if (checkbox) checkbox.checked = active;
        if (active) count++;
    });

    // Update badge visibility and count
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // Visual ring and icon tint
    if (count > 0) {
        experimentalBtn.classList.add('abilities-active');
        if (experimentalIcon) experimentalIcon.classList.add('text-blue-400');
    } else {
        experimentalBtn.classList.remove('abilities-active');
        if (experimentalIcon) experimentalIcon.classList.remove('text-blue-400');
    }

    // Ensure stored state stays in sync
    try {
        localStorage.setItem('selectedAbilities', JSON.stringify(selectedAbilities || {}));
    } catch (e) {
        logger.warn('Could not persist selectedAbilities:', e);
    }
}

if (experimentalBtn) {
    experimentalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = experimentalDropdown.classList.contains('visible-state');
        
        // Close others
        modelDropdown.classList.remove('visible-state');
        modelDropdown.classList.add('hidden-state');
        
        if (isOpen) {
            experimentalDropdown.classList.remove('visible-state');
            experimentalDropdown.classList.add('hidden-state');
        } else {
            experimentalDropdown.classList.remove('hidden-state');
            experimentalDropdown.classList.add('visible-state');
        }
    });
}

document.querySelectorAll('.ability-option').forEach(option => {
    option.addEventListener('click', (e) => {
        // Prevent immediate dropdown close so multiple toggles are easy
        e.stopPropagation();

        const label = e.currentTarget;
        const ability = label.dataset.ability;
        const checkbox = label.querySelector('input[type="checkbox"]');

        if (!checkbox) return;

        // Toggle the checkbox programmatically for reliable state
        checkbox.checked = !checkbox.checked;

        // Update internal state
        if (!selectedAbilities) selectedAbilities = {};
        if (checkbox.checked) {
            selectedAbilities[ability] = true;
        } else {
            delete selectedAbilities[ability];
        }

        // Persist and update UI
        try {
            localStorage.setItem('selectedAbilities', JSON.stringify(selectedAbilities));
        } catch (e) {
            logger.warn('Could not persist selectedAbilities:', e);
        }
        updateSelectedAbilityUI();
    });
});

/* --- Pollinations BYOP: parse fragment and connect flow --- */
// Parse location.hash for an API key fragment like #api_key=sk_abc...
function parseFragmentForApiKey() {
    try {
        const hash = window.location.hash.substring(1); // remove '#'
        if (!hash) return null;
        const params = new URLSearchParams(hash);
        const key = params.get('api_key') || params.get('token') || params.get('pollen_api_key');
        if (key) {
            // Store under a clear key name
            localStorage.setItem('pollenApiKey', key);
            // Mirror to customApiKey storage used elsewhere for backward compatibility
            localStorage.setItem('customApiKey', key);
            // Remove fragment so it never gets sent again
            history.replaceState(null, '', window.location.pathname + window.location.search);
            return key;
        }
    } catch (e) {
        logger.warn('Failed to parse API key from URL fragment', e);
    }
    return null;
}

function buildPollinationsAuthUrl({ redirect = window.location.origin, permissions = 'profile,balance,usage' } = {}) {
    const base = 'https://enter.pollinations.ai/authorize';
    const params = new URLSearchParams({
        redirect_url: redirect,
        permissions
    });
    return `${base}?${params.toString()}`;
}

function connectWithPollinations() {
    const redirect = window.location.origin;
    const authUrl = buildPollinationsAuthUrl({ redirect });
    // Open in new tab so the fragment doesn't hit server logs; pollinations will redirect back with #api_key=...
    window.open(authUrl, '_blank', 'noopener');
}

// Convenience: clear stored pollen key
function clearPollenKey() {
    localStorage.removeItem('pollenApiKey');
    localStorage.removeItem('customApiKey');
    if (customApiKeyInput) customApiKeyInput.value = '';
    if (pollinationsApiKeyInput) pollinationsApiKeyInput.value = '';
}

// Wire up pollinations buttons after DOM is ready (listeners registered later in initialize)
const pollinationsApiKeyInput = document.getElementById('pollinationsApiKeyInput');


// Initial
async function initialize() {
    // Attempt to parse an API key returned in the URL fragment on load
    const found = parseFragmentForApiKey();
    if (found && pollinationsApiKeyInput) {
        pollinationsApiKeyInput.value = found;
    }

    setInitialTheme();
    loadProjectsFromLocalStorage();

    // Load user preferences
    selectedModel = localStorage.getItem('selectedModel') || 'GPT-5 Nano';
    // Ensure the selected model is valid, otherwise fallback to default
    if (!modelConfig[selectedModel]) {
        selectedModel = 'GPT-5 Nano';
    }
    
    try {
        const savedAbilities = localStorage.getItem('selectedAbilities');
        selectedAbilities = savedAbilities ? JSON.parse(savedAbilities) : {};
        if (!selectedAbilities) selectedAbilities = {};
    } catch (e) {
        selectedAbilities = {};
    }
    
    // Check login status
    await checkUserStatus();

    // Prefer pollen BYOP key if present
    const pollenKey = localStorage.getItem('pollenApiKey') || localStorage.getItem('customApiKey');
    if (pollenKey) {
        if (pollinationsApiKeyInput) pollinationsApiKeyInput.value = pollenKey;
        // Also ensure backwards-compatible storage key
        localStorage.setItem('customApiKey', pollenKey);
    }

    // Hook up Pollinations connect/clear buttons (if present)
    const pollinationsConnectBtn = document.getElementById('pollinationsConnectBtn');
    const pollinationsClearBtn = document.getElementById('pollinationsClearBtn');
    if (pollinationsConnectBtn) {
        pollinationsConnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            connectWithPollinations();
        });
    }
    if (pollinationsClearBtn) {
        pollinationsClearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            clearPollenKey();
        });
    }
    // Mirror manual input into pollen key storage when user types/pastes
    if (pollinationsApiKeyInput) {
        pollinationsApiKeyInput.addEventListener('change', (e) => {
            const key = e.target.value.trim();
            if (key) {
                localStorage.setItem('pollenApiKey', key);
                localStorage.setItem('customApiKey', key);
                customApiKeyInput.value = key;
            } else {
                clearPollenKey();
            }
        });
    }

    // Show welcome modal on first visit
    if (!localStorage.getItem('hasSeenWelcomeModal')) {
        openWelcomeModal();
    }

    // Router will handle selecting the initial project based on URL
    await router();
    
    // The rest of the logic is now handled by the router
    // Update model selector UI
    updateModelUI(selectedModel);
    
    // Update ability selector UI
    updateSelectedAbilityUI();

    lucide.createIcons();
}

initialize();