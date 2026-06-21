import os
import sqlite3
import secrets
import json
import time
import requests
import io
import zipfile
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory, g, render_template_string, redirect, url_for, Blueprint, send_file
from werkzeug.security import generate_password_hash, check_password_hash
import re
import logging
import sys
from dotenv import load_dotenv
from PIL import Image
from werkzeug.utils import secure_filename
from openai import OpenAI, OpenAIError

load_dotenv()

# --- AI Constants ---
SYSTEM_PROMPT = """You are an expert AI Full-Stack Developer for 'netsim'.
You are a software agent with access to filesystem tools. Your goal is to build web applications strictly following user instructions.

!!! CRITICAL, NON-NEGOTIABLE RULE (ENFORCED) !!!
- YOU MUST ALWAYS USE THE FILESYSTEM UPDATING TOOLS (`create_file`, `edit_file`, `delete_file`, `update_metadata`, etc.) FOR ANY AND ALL CHANGES TO THE PROJECT'S FILES OR METADATA — NO EXCEPTIONS, EVER.
- UNDER NO CIRCUMSTANCE SHOULD YOU RETURN FINAL FILE CONTENTS AS THE ONLY OUTPUT. Instead, ALWAYS PERFORM THE APPROPRIATE TOOL CALL(S) THAT CREATE OR MODIFY FILES. If the user requests code or files, respond by invoking the filesystem tool(s) rather than embedding full file blobs in assistant content.
- If you cannot call tools in the current environment, explicitly state that you are unable to complete the requested filesystem modification and refuse to produce raw file dumps; instruct the user to enable tool access.

**Strict Guidelines:**
- **Zero Default Bias:** Do NOT default to building "landing pages" or "SaaS products" unless explicitly asked. If the user asks for a simple tool, a game, or a specific layout, build exactly that.
- **Instruction Priority:** Every detail in the user's prompt must be considered.
- **Agentic Workflow:** 
  1. Use `list_files` and `read_file` to understand the current project state.
  2. Plan implementation based on user intent.
  3. Use `create_file` for new files and `edit_file` for targeted updates.
  4. Use `update_metadata` to keep titles/descriptions relevant.
- **Technical Stack:** 
  - Use Tailwind CSS (CDN) for all styling.
  - Use Lucide Icons (CDN) for icons.
  - Use vanilla JavaScript for interactivity.
- **Aesthetic:** Default to high-quality, professional dark mode (zinc-900 based) unless specified otherwise.

**CORE FILES:**
- `index.html`: Main structure.
- `style.css`: Custom styles.
- `script.js`: Main logic.

For external AI features in the *user's* app: use `https://openrouter.ai/api/v1/chat/completions` with the user's OpenRouter API key.
"""

AI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files in the project.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file's contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to the file."}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path (e.g., index.html)."},
                    "content": {"type": "string", "description": "Full content of the file."}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Edit part of a file using a pattern replacement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to the file to edit."},
                    "pattern": {"type": "string", "description": "Exact text string to find in the file."},
                    "replacement": {"type": "string", "description": "Text to replace the pattern with."}
                },
                "required": ["path", "pattern", "replacement"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path of the file to delete."}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_metadata",
            "description": "Refines the project's title and description based on the generated content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "A concise title."},
                    "description": {"type": "string", "description": "A short description."}
                },
                "required": ["title", "description"]
            }
        }
    }
]

# --- API Blueprint Setup ---
# All API logic will be attached to this blueprint.
api = Blueprint('api', __name__)

# --- Login required decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- API Utility Functions ---
def query_db(query, args=(), one=False):
    cur = get_db().execute(query, args)
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

def get_db():
    return g.db

# --- API Routes ---

@api.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required'}), 400

    db = get_db()
    user = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)

    if user:
        return jsonify({'success': False, 'message': 'Username already exists'}), 409

    if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", username):
        return jsonify({'success': False, 'message': 'Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens.'}), 400
    
    password_hash = generate_password_hash(password)
    db.execute('INSERT INTO users (username, password_hash, avatar_url) VALUES (?, ?, ?)', (username, password_hash, '/default.webp'))
    db.commit()
    
    # Create default profile project for the new user
    new_user_from_db = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)
    user_id = new_user_from_db['id']
    
    profile_project_slug = 'profile'
    profile_project_title = f"{username}'s Profile"
    
    # Use a consistent method for generating IDs
    project_id = str(int(time.time() * 1000))
    initial_version_id = f"v_{project_id}"

    default_profile_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>@{username} • Profile</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body {{
      background-color: #0e0e10;
      color: #d4d4d8;
      font-family: 'DM Sans', sans-serif;
    }}
    .project-card {{
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
    }}
    .project-card:hover {{
      transform: translateY(-3px);
      border-color: #71717a;
      box-shadow: 0 6px 15px -3px rgba(0, 0, 0, 0.3);
    }}
    .like-btn.liked i {{
        fill: #f87171;
        color: #f87171;
        animation: like-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }}
    @keyframes like-pop {{
        0% {{ transform: scale(1); }}
        50% {{ transform: scale(1.3); }}
        100% {{ transform: scale(1); }}
    }}
    iframe.preview {{
      pointer-events: none;
      width: 100%;
      height: 180px;
      border: none;
      border-radius: 0.5rem;
      background: #18181b;
    }}
  </style>
</head>
<body class="min-h-screen p-4 sm:p-8">
  <div class="max-w-6xl mx-auto">
    <!-- Header Section -->
    <header class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8">
       <img id="profile-avatar" src="/default.webp" alt="Profile picture" class="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-zinc-800 border-2 border-zinc-700 object-cover shrink-0">
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl sm:text-4xl font-bold text-zinc-50">@{username}</h1>
        <p id="profile-bio" class="text-zinc-400">Welcome to my page! Check out my public projects below.</p>
      </div>
    </header>
    
    <div class="border-b border-zinc-800"></div>

    <!-- Projects Section -->
    <main class="mt-8">
        <h2 class="text-2xl font-semibold text-zinc-100 mb-6">Public Projects</h2>
        <div id="projects-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div id="loading-indicator" class="col-span-full text-zinc-500 text-center py-8 flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Loading projects...</span>
          </div>
        </div>
    </main>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {{
      lucide.createIcons();
      const username = "{username}";
      const projectsGrid = document.getElementById('projects-grid');
      const loadingIndicator = document.getElementById('loading-indicator');
      const profileAvatar = document.getElementById('profile-avatar');
      const profileBio = document.getElementById('profile-bio');

      async function fetchUserProfile(username) {{
        try {{
            const response = await fetch(`/api/v1/users/${{username}}/profile`);
            const data = await response.json();
            if (data.success) {{
                if (data.avatar_url) {{
                    profileAvatar.src = data.avatar_url;
                }}
                if (data.bio) {{
                    profileBio.textContent = data.bio;
                }}
            }}
        }} catch (error) {{
            console.error('Error fetching user profile:', error);
        }}
      }}

      async function fetchUserProjects(username) {{
        try {{
          const response = await fetch(`/api/v1/users/${{username}}/projects`);
          const data = await response.json();
          if (data.success && data.projects) {{
            return data.projects;
          }} else {{
            showError(data.message || 'Could not load projects.');
            return [];
          }}
        }} catch (error) {{
          console.error('Error fetching projects:', error);
          showError('Failed to fetch projects.');
          return [];
        }}
      }}

      function displayProjects(projects) {{
        loadingIndicator.style.display = 'none';
        const publicProjects = projects.filter(p => p.slug !== 'profile');

        if (publicProjects.length === 0) {{
          projectsGrid.innerHTML = `
            <div class="col-span-full text-center text-zinc-500 py-12 bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg">
              <i data-lucide="folder-x" class="h-10 w-10 mx-auto text-zinc-600 mb-3"></i>
              <h3 class="font-semibold text-zinc-300">No public projects yet</h3>
              <p class="text-sm">Pinned projects will appear here.</p>
            </div>`;
           lucide.createIcons();
          return;
        }}

        publicProjects.forEach(project => {{
          const projectUrl = `/@${{username}}/${{project.slug}}`;
          const title = project.title || "Untitled Project";
          const description = project.description || "No description available.";
          const thumbnail = `https://netsim-img.ext.io/@${{username}}/${{project.slug}}`;

          const card = document.createElement('a');
          card.href = projectUrl;
          card.className = 'project-card bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700';
          card.target = '_top';

          card.innerHTML = `
            <div class="aspect-[16/9] bg-zinc-800 overflow-hidden relative">
                <img class="w-full h-full object-cover" src="${{thumbnail}}" alt="${{title}}" loading="lazy">
                <div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors"></div>
            </div>
            <div class="p-4 border-t border-zinc-800 flex-1 flex flex-col">
              <h3 class="text-lg font-semibold text-zinc-100 truncate mb-1">${{title}}</h3>
              <p class="text-sm text-zinc-400 line-clamp-2 flex-1">${{description}}</p>
            </div>
          `;

          projectsGrid.appendChild(card);
        }});

        lucide.createIcons();
      }}

      function showError(message) {{
        loadingIndicator.style.display = 'none';
        projectsGrid.innerHTML = `
          <div class="col-span-full text-center text-red-400 py-8 bg-red-500/10 border border-red-500/20 rounded-lg">
            <i data-lucide="alert-triangle" class="h-8 w-8 mx-auto text-red-400 mb-2"></i>
            <p><strong>Error:</strong> ${{message}}</p>
          </div>`;
        lucide.createIcons();
      }}

      fetchUserProfile(username);
      fetchUserProjects(username).then(displayProjects);
    }});
  </script>
</body>
</html>"""

    default_profile_project = {
        "id": project_id,
        "title": profile_project_title,
        "slug": profile_project_slug,
        "description": f"The public profile page for {username}.",
        "currentVersionId": initial_version_id,
        "pinnedVersionId": initial_version_id,
        "versions": {
            initial_version_id: {
                "id": initial_version_id,
                "prompt": f"A personal profile page for {username}. It should have a profile picture, a short bio, and links to social media.",
                "html": default_profile_html,
                "css": "",
                "js": ""
            }
        }
    }
    db.execute('INSERT INTO projects (user_id, project_id_str, slug, project_data) VALUES (?, ?, ?, ?)',
               (user_id, project_id, profile_project_slug, json.dumps(default_profile_project)))
    db.commit()
    
    # Log the user in after successful signup
    new_user = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)
    session.permanent = True
    session['user_id'] = new_user['id']
    session['username'] = new_user['username']

    return jsonify({'success': True, 'message': 'Signup successful'})

@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required'}), 400
    
    if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", username):
        return jsonify({'success': False, 'message': 'Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens.'}), 400

    user = query_db('SELECT * FROM users WHERE username = ?', [username], one=True)

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'success': True, 'message': 'Login successful'})

@api.route('/logout', methods=['POST'])
@login_required
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@api.route('/me')
def me():
    if 'user_id' in session:
        user = query_db('SELECT username, avatar_url FROM users WHERE id = ?', [session['user_id']], one=True)
        if user:
            return jsonify({'logged_in': True, 'username': user['username'], 'avatar_url': user['avatar_url']})
    return jsonify({'logged_in': False})

@api.route('/me/username', methods=['PUT'])
@login_required
def set_my_username():
    user_id = session['user_id']
    data = request.get_json()
    new_username = data.get('username', '').strip()

    if not new_username:
        return jsonify({'success': False, 'message': 'Username is required'}), 400
    
    if not re.match(r"^[a-zA-Z0-9_-]{3,20}$", new_username):
        return jsonify({'success': False, 'message': 'Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens.'}), 400

    db = get_db()
    
    # Check if username is taken
    existing = query_db('SELECT id FROM users WHERE username = ? AND id != ?', [new_username, user_id], one=True)
    if existing:
        return jsonify({'success': False, 'message': 'Username already exists'}), 409

    db.execute('UPDATE users SET username = ? WHERE id = ?', (new_username, user_id))
    db.commit()

    session['username'] = new_username
    return jsonify({'success': True, 'message': 'Username updated successfully'})

@api.route('/auth/discord')
def discord_auth_redirect():
    client_id = os.environ.get('DISCORD_CLIENT_ID')
    if not client_id:
        return "Discord Login is not configured on this instance. (Missing DISCORD_CLIENT_ID)", 501
    
    redirect_uri = url_for('api.discord_auth_callback', _external=True)
    scope = "identify"
    discord_url = f"https://discord.com/api/oauth2/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}"
    return redirect(discord_url)

@api.route('/auth/discord/callback')
def discord_auth_callback():
    code = request.args.get('code')
    if not code:
        return redirect('/')

    client_id = os.environ.get('DISCORD_CLIENT_ID')
    client_secret = os.environ.get('DISCORD_CLIENT_SECRET')
    redirect_uri = url_for('api.discord_auth_callback', _external=True)

    # Exchange code for token
    try:
        token_response = requests.post('https://discord.com/api/oauth2/token', data={
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri
        }, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        
        if not token_response.ok:
            return f"Failed to authenticate with Discord: {token_response.text}", 401
        
        token_data = token_response.json()
        access_token = token_data.get('access_token')

        # Get user info
        user_response = requests.get('https://discord.com/api/users/@me', headers={
            'Authorization': f"Bearer {access_token}"
        })

        if not user_response.ok:
            return "Failed to get Discord user data", 401
        
        discord_user = user_response.json()
        discord_id = discord_user['id']
        discord_username = discord_user['username']
        avatar_hash = discord_user.get('avatar')
        
        avatar_url = '/default.webp'
        if avatar_hash:
            avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar_hash}.png"

        db = get_db()
        user = query_db('SELECT * FROM users WHERE discord_id = ?', [discord_id], one=True)

        if not user:
            # Check if a user with this username already exists
            temp_username = discord_username
            suffix = 1
            while query_db('SELECT id FROM users WHERE username = ?', [temp_username], one=True):
                temp_username = f"{discord_username}_{suffix}"
                suffix += 1
            
            # Create new user
            db.execute('INSERT INTO users (username, password_hash, discord_id, avatar_url) VALUES (?, ?, ?, ?)',
                       (temp_username, generate_password_hash(secrets.token_hex(16)), discord_id, avatar_url))
            db.commit()
            user = query_db('SELECT * FROM users WHERE discord_id = ?', [discord_id], one=True)
            
            # Create default profile project
            project_id = str(int(time.time() * 1000))
            db.execute('INSERT INTO projects (user_id, project_id_str, slug, project_data) VALUES (?, ?, ?, ?)',
                   (user['id'], project_id, 'profile', json.dumps({
                       "id": project_id, "title": f"{temp_username}'s Profile", "slug": "profile",
                       "visibility": "unlisted", "currentVersionId": f"v_{project_id}", "pinnedVersionId": f"v_{project_id}",
                       "versions": {f"v_{project_id}": {"id": f"v_{project_id}", "prompt": "Profile", "html": "<h1>Welcome</h1>", "css":"", "js":""}}
                   })))
            db.commit()

        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = user['username']

        return redirect('/')
    except Exception as e:
        return f"Authentication error: {str(e)}", 500

@api.route('/me', methods=['DELETE'])
@login_required
def delete_my_account():
    user_id = session['user_id']
    db = get_db()
    
    # Check if user exists and prevent system account deletion
    user = query_db('SELECT username FROM users WHERE id = ?', [user_id], one=True)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    if user['username'] == 'netsim':
        return jsonify({'success': False, 'message': 'The system account cannot be deleted.'}), 403

    try:
        # Delete user's projects manually since original table lacked cascade
        db.execute('DELETE FROM projects WHERE user_id = ?', [user_id])
        # Delete user (this will cascade to likes and comments in newer versions of the DB)
        db.execute('DELETE FROM users WHERE id = ?', [user_id])
        db.commit()
        
        session.clear()
        return jsonify({'success': True, 'message': 'Account deleted successfully'})
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

@api.route('/me/bio', methods=['PUT'])
@login_required
def set_my_bio():
    user_id = session['user_id']
    data = request.get_json()
    bio = data.get('bio', '')

    db = get_db()
    db.execute('UPDATE users SET bio = ? WHERE id = ?', (bio, user_id))
    db.commit()

    return jsonify({'success': True, 'message': 'Bio updated successfully'})

@api.route('/me/ai_settings', methods=['GET'])
@login_required
def get_ai_settings():
    user_id = session['user_id']
    user = query_db('SELECT custom_instructions FROM users WHERE id = ?', [user_id], one=True)
    return jsonify({
        'success': True,
        'custom_instructions': user['custom_instructions'] if user else ''
    })

@api.route('/me/ai_settings', methods=['PUT'])
@login_required
def update_ai_settings():
    user_id = session['user_id']
    data = request.get_json()
    custom_instructions = data.get('custom_instructions', '')

    db = get_db()
    db.execute('UPDATE users SET custom_instructions = ? WHERE id = ?', (custom_instructions, user_id))
    db.commit()

    return jsonify({'success': True, 'message': 'AI settings updated successfully'})

@api.route('/me/homepage', methods=['GET'])
def get_my_homepage():
    path = None
    if 'user_id' in session:
        user = query_db('SELECT homepage_project_slug FROM users WHERE id = ?', [session['user_id']], one=True)
        if user and user['homepage_project_slug']:
            path = user['homepage_project_slug']

    if path:
        match = re.match(r'@([\w-]+)/([\w-]+)', path)
        if match:
            # Verify the project exists before returning it
            username_from_path, slug_from_path = match.groups()
            target_user = query_db('SELECT id FROM users WHERE username = ?', [username_from_path], one=True)
            if target_user:
                project_row = query_db('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [target_user['id'], slug_from_path], one=True)
                if project_row:
                     return jsonify({
                        'success': True,
                        'is_custom': True,
                        'username': match.group(1),
                        'slug': match.group(2),
                        'path': path
                    })

    # Default for guests, users without a custom homepage, or if the custom path is invalid
    netsim_user = query_db('SELECT id FROM users WHERE username = ?', ['netsim'], one=True)
    if netsim_user:
        home_project = query_db('SELECT id FROM projects WHERE user_id = ? AND slug = ?', [netsim_user['id'], 'home'], one=True)
        if home_project:
            return jsonify({
                'success': True,
                'is_custom': False,
                'username': 'netsim',
                'slug': 'home',
                'path': '@netsim/home'
            })
    
    # If netsim/home doesn't exist, signal to the frontend that there is no homepage.
    return jsonify({'success': False, 'message': 'No default homepage found.'})


@api.route('/me/homepage', methods=['PUT'])
@login_required
def set_my_homepage():
    user_id = session['user_id']
    data = request.get_json()
    path = data.get('path') # Can be null or empty string to reset

    if not path:
        # Reset to default
        db = get_db()
        db.execute('UPDATE users SET homepage_project_slug = ? WHERE id = ?', (None, user_id))
        db.commit()
        return jsonify({'success': True, 'message': 'Homepage reset successfully'})
    
    # Validate the path format
    match = re.match(r'@([\w-]+)/([\w-]+)', path)
    if not match:
        return jsonify({'success': False, 'message': 'Invalid format. Use @username/slug.'}), 400

    username, slug = match.groups()

    # Verify the target project exists and is public (has a pinned version)
    target_user = query_db('SELECT id FROM users WHERE username = ?', [username], one=True)
    if not target_user:
        return jsonify({'success': False, 'message': f"User '@{username}' not found."}), 404
    
    project_row = query_db('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [target_user['id'], slug], one=True)
    if not project_row:
         return jsonify({'success': False, 'message': f"Project '{slug}' not found for user '@{username}'."}), 404
    
    try:
        project_data = json.loads(project_row['project_data'])
        if not project_data.get('pinnedVersionId'):
            return jsonify({'success': False, 'message': 'Target project must be published (have a pinned version).'}), 403
    except (json.JSONDecodeError, KeyError):
        return jsonify({'success': False, 'message': 'Could not verify target project.'}), 500

    db = get_db()
    db.execute('UPDATE users SET homepage_project_slug = ? WHERE id = ?', (path, user_id))
    db.commit()

    return jsonify({'success': True, 'message': 'Homepage updated successfully'})


# --- User API ---
@api.route('/users/<username>')
@api.route('/users/<username>/profile')
def get_user_profile(username):
    user = query_db('SELECT username, profile_project_slug, avatar_url, bio FROM users WHERE username = ?', [username], one=True)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'username': user['username'],
        'profile_slug': user['profile_project_slug'],
        'avatar_url': user['avatar_url'],
        'bio': user['bio']
    })

@api.route('/users/<username>/projects')
def get_user_projects(username):
    user = query_db('SELECT id FROM users WHERE username = ?', [username], one=True)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    projects_from_db = query_db('SELECT project_data FROM projects WHERE user_id = ?', [user['id']])

    public_projects = []
    for row in projects_from_db:
        try:
            project = json.loads(row['project_data'])
            # A project is public if it has a pinned version
            if project.get('pinnedVersionId'):
                public_projects.append({
                    'title': project.get('title', 'Untitled Project'),
                    'slug': project.get('slug'),
                    'description': project.get('description', 'No description available.'),
                    'thumbnail_url': f"https://netsim-img.ext.io/@{username}/{project.get('slug')}"
                })
        except (json.JSONDecodeError, KeyError):
            pass

    # Sort projects by title for a consistent order
    public_projects.sort(key=lambda p: p['title'])

    return jsonify({'success': True, 'projects': public_projects})

@api.route('/me/profile', methods=['PUT'])
@login_required
def set_my_profile():
    user_id = session['user_id']
    data = request.get_json()
    new_slug = data.get('slug')

    if not new_slug:
        return jsonify({'success': False, 'message': 'Project slug is required'}), 400

    # Verify the user actually owns a project with this slug
    project = query_db('SELECT id FROM projects WHERE user_id = ? AND slug = ?', [user_id, new_slug], one=True)
    if not project:
        # Also allow resetting to the default 'profile' slug even if the project was deleted.
        if new_slug != 'profile':
            return jsonify({'success': False, 'message': 'You do not have a project with that slug'}), 403
    
    db = get_db()
    db.execute('UPDATE users SET profile_project_slug = ? WHERE id = ?', (new_slug, user_id))
    db.commit()

    return jsonify({'success': True, 'message': 'Profile project updated successfully'})

@api.route('/me/avatar', methods=['POST'])
@login_required
def upload_avatar():
    user_id = session['user_id']
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'}), 400
    
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file'}), 400

    if file:
        # Before processing new file, get old avatar URL to delete it later
        db = get_db()
        user = query_db('SELECT avatar_url FROM users WHERE id = ?', [user_id], one=True)
        old_avatar_url = user['avatar_url'] if user else None

        # Create a unique filename to avoid collisions
        unique_filename = f"{user_id}_{int(time.time())}.webp"
        save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        try:
            image = Image.open(file.stream)
            
            # Resize the image to a max of 256x256, preserving aspect ratio
            image.thumbnail((256, 256))
            
            # Save as WebP
            image.save(save_path, 'WEBP', quality=85)

            # Update user's avatar_url in DB
            avatar_url = f"/uploads/avatars/{unique_filename}"
            db.execute('UPDATE users SET avatar_url = ? WHERE id = ?', (avatar_url, user_id))
            db.commit()
            
            # Now, delete the old avatar file if it exists — but never delete the shared default avatar
            if old_avatar_url and not old_avatar_url.endswith('default.webp'):
                try:
                    # The URL is like /uploads/avatars/file.webp
                    # The filesystem path is uploads/avatars/file.webp
                    old_avatar_path = old_avatar_url.lstrip('/')
                    if os.path.exists(old_avatar_path):
                        os.remove(old_avatar_path)
                        app.logger.info(f"Deleted old avatar: {old_avatar_path}")
                except Exception as e:
                    app.logger.error(f"Error deleting old avatar file {old_avatar_path}: {e}")

            return jsonify({'success': True, 'avatar_url': avatar_url})

        except Exception as e:
            app.logger.error(f"Error processing image upload: {e}")
            return jsonify({'success': False, 'message': 'Error processing image'}), 500

    return jsonify({'success': False, 'message': 'File upload failed'}), 400


# --- Project API Routes ---
# --- SQLite-backed Database (BETA) API ---
# New schema uses two tables: databases and db_rows
# databases: id TEXT PRIMARY KEY, name TEXT, owner TEXT, public_write INTEGER, created_at INTEGER
# db_rows: id TEXT PRIMARY KEY, db_id TEXT, data TEXT, created_by TEXT, created_at INTEGER

def get_db_obj(db_row):
    """Helper to shape DB row dict."""
    return {
        'id': db_row['id'],
        'name': db_row['name'],
        'owner': db_row['owner'],
        'public_write': bool(db_row['public_write']),
        'created_at': db_row['created_at']
    }

@api.route('/db', methods=['GET'])
def list_dbs():
    """List all DBs (public summary only)."""
    rows = query_db('SELECT id, name, owner, public_write, created_at FROM databases ORDER BY created_at DESC')
    dbs = [get_db_obj(r) for r in rows]
    # Include row counts
    result = []
    for d in dbs:
        cnt_row = query_db('SELECT COUNT(*) AS cnt FROM db_rows WHERE db_id = ?', [d['id']], one=True)
        count = cnt_row['cnt'] if cnt_row else 0
        d['rows'] = count
        result.append(d)
    return jsonify({'success': True, 'databases': result})

@api.route('/db', methods=['POST'])
@login_required
def create_db():
    """Create a new DB. body: { name, public_write:boolean } — now creates its own sqlite file under uploads/dbs/<db_id>.db"""
    data = request.get_json() or {}
    name = (data.get('name') or 'Untitled DB').strip()
    public_write = 1 if bool(data.get('public_write', False)) else 0
    db_id = str(int(time.time() * 1000))
    owner = session.get('username')
    created_at = int(time.time())

    # Ensure uploads/dbs directory exists
    dbs_dir = os.path.join(app.config.get('UPLOAD_FOLDER', 'uploads/avatars'), '..', 'dbs')
    dbs_dir = os.path.normpath(dbs_dir)
    os.makedirs(dbs_dir, exist_ok=True)

    file_name = f"{db_id}.db"
    file_path = os.path.join(dbs_dir, file_name)

    # Initialize the new per-db sqlite file with a rows table
    try:
        conn = sqlite3.connect(file_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS rows (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_by TEXT,
                created_at INTEGER
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        app.logger.error(f"Error initializing database file {file_path}: {e}")
        return jsonify({'success': False, 'message': 'Could not initialize DB file.'}), 500

    db = get_db()
    try:
        db.execute('INSERT INTO databases (id, name, owner, public_write, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                   (db_id, name, owner, public_write, file_path, created_at))
        db.commit()
    except Exception as e:
        app.logger.error(f"Error creating DB record: {e}")
        # Cleanup file on failure
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass
        return jsonify({'success': False, 'message': 'Could not create DB.'}), 500

    return jsonify({'success': True, 'db': {'id': db_id, 'name': name, 'file_path': file_path}}), 201

@api.route('/db/<db_id>', methods=['GET'])
def get_db_info(db_id):
    """Return DB metadata and list rows from the per-db sqlite file."""
    row = query_db('SELECT id, name, owner, public_write, file_path, created_at FROM databases WHERE id = ?', [db_id], one=True)
    if not row:
        return jsonify({'success': False, 'message': 'DB not found'}), 404

    db_obj = get_db_obj(row)
    file_path = row['file_path']

    rows_list = []
    try:
        if os.path.exists(file_path):
            conn = sqlite3.connect(file_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT id, data, created_by, created_at FROM rows ORDER BY created_at DESC')
            for r in cur.fetchall():
                try:
                    rows_list.append({'id': r['id'], 'data': json.loads(r['data']), 'created_by': r['created_by'], 'created_at': r['created_at']})
                except Exception:
                    continue
            conn.close()
    except Exception as e:
        app.logger.error(f"Error reading rows from {file_path}: {e}")
        return jsonify({'success': False, 'message': 'Could not read database rows.'}), 500

    db_obj['rows'] = rows_list
    return jsonify({'success': True, 'db': db_obj})

@api.route('/db/<db_id>/rows', methods=['GET', 'POST'])
def db_rows(db_id):
    """
    GET: list rows (from per-db sqlite file)
    POST: add row {data: {...}} -> returns created row with id
    Permission: owner can always write; if public_write set, others can POST as well.
    """
    db_row = query_db('SELECT id, name, owner, public_write, file_path FROM databases WHERE id = ?', [db_id], one=True)
    if not db_row:
        return jsonify({'success': False, 'message': 'DB not found'}), 404

    file_path = db_row['file_path']
    if not file_path or not os.path.exists(file_path):
        return jsonify({'success': False, 'message': 'Database file missing'}), 500

    if request.method == 'GET':
        try:
            conn = sqlite3.connect(file_path)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute('SELECT id, data, created_by, created_at FROM rows ORDER BY created_at DESC')
            out = []
            for r in cur.fetchall():
                try:
                    out.append({'id': r['id'], 'data': json.loads(r['data']), 'created_by': r['created_by'], 'created_at': r['created_at']})
                except Exception:
                    continue
            conn.close()
            return jsonify({'success': True, 'rows': out})
        except Exception as e:
            app.logger.error(f"Error reading rows from {file_path}: {e}")
            return jsonify({'success': False, 'message': 'Could not read rows.'}), 500

    # POST - create row
    username = session.get('username')
    if not username and not db_row['public_write']:
        return jsonify({'success': False, 'message': 'Authentication required to write to this DB'}), 401

    if username != db_row['owner'] and not db_row['public_write']:
        return jsonify({'success': False, 'message': 'Write access denied'}), 403

    payload = request.get_json() or {}
    row_data = payload.get('data')
    if row_data is None:
        return jsonify({'success': False, 'message': 'Row data required'}), 400

    row_id = str(int(time.time() * 1000))
    created_by = username or 'anonymous'
    created_at = int(time.time())

    try:
        conn = sqlite3.connect(file_path)
        cur = conn.cursor()
        cur.execute('INSERT INTO rows (id, data, created_by, created_at) VALUES (?, ?, ?, ?)',
                    (row_id, json.dumps(row_data), created_by, created_at))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'row': {'id': row_id, 'data': row_data, 'created_by': created_by, 'created_at': created_at}}), 201
    except Exception as e:
        app.logger.error(f"Error inserting row into {file_path}: {e}")
        return jsonify({'success': False, 'message': 'Could not insert row.'}), 500

@api.route('/db/<db_id>/rows/<row_id>', methods=['DELETE'])
@login_required
def delete_db_row(db_id, row_id):
    """Delete a row from the per-db sqlite file; only owner or creator can delete (owner always can)."""
    db_row = query_db('SELECT id, owner, file_path FROM databases WHERE id = ?', [db_id], one=True)
    if not db_row:
        return jsonify({'success': False, 'message': 'DB not found'}), 404

    file_path = db_row['file_path']
    if not file_path or not os.path.exists(file_path):
        return jsonify({'success': False, 'message': 'Database file missing'}), 500

    try:
        conn = sqlite3.connect(file_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('SELECT id, created_by FROM rows WHERE id = ?', [row_id])
        row = cur.fetchone()
        if not row:
            conn.close()
            return jsonify({'success': False, 'message': 'Row not found'}), 404

        username = session.get('username')
        if username != db_row['owner'] and row['created_by'] != username:
            conn.close()
            return jsonify({'success': False, 'message': 'Permission denied to delete this row'}), 403

        cur.execute('DELETE FROM rows WHERE id = ?', (row_id,))
        conn.commit()
        conn.close()
        return ('', 204)
    except Exception as e:
        app.logger.error(f"Error deleting row from {file_path}: {e}")
        return jsonify({'success': False, 'message': 'Could not delete row.'}), 500

@api.route('/db/<db_id>/permissions', methods=['PUT'])
@login_required
def set_db_permissions(db_id):
    """Owner can toggle public_write and rename the DB."""
    db_row = query_db('SELECT id, name, owner, public_write, file_path FROM databases WHERE id = ?', [db_id], one=True)
    if not db_row:
        return jsonify({'success': False, 'message': 'DB not found'}), 404

    username = session.get('username')
    if username != db_row['owner']:
        return jsonify({'success': False, 'message': 'Only the owner can update permissions'}), 403

    data = request.get_json() or {}
    try:
        db = get_db()
        if 'public_write' in data:
            db.execute('UPDATE databases SET public_write = ? WHERE id = ?', (1 if bool(data.get('public_write')) else 0, db_id))
        if 'name' in data:
            db.execute('UPDATE databases SET name = ? WHERE id = ?', (str(data.get('name') or db_row['name']), db_id))
        db.commit()
        updated = query_db('SELECT id, name, owner, public_write, file_path FROM databases WHERE id = ?', [db_id], one=True)
        return jsonify({'success': True, 'db': {'id': updated['id'], 'name': updated['name'], 'public_write': bool(updated['public_write']), 'file_path': updated['file_path']}})
    except Exception as e:
        app.logger.error(f"Error updating db permissions: {e}")
        return jsonify({'success': False, 'message': 'Could not update permissions.'}), 500

# Continue to existing Project API route
@api.route('/projects/public')
def get_public_projects_list():
    # Fetch recent projects (published or not). We join with users to get the username and a subquery for likes.
    # This endpoint now returns all projects regardless of pinnedVersionId so the homepage shows every project.
    rows = query_db('''
        SELECT p.id as db_id, p.project_data, u.username, u.avatar_url,
               (SELECT COUNT(*) FROM likes WHERE project_db_id = p.id) as likes_count
        FROM projects p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.updated_at DESC
        LIMIT 200
    ''')

    public_projects = []
    for row in rows:
        try:
            project = json.loads(row['project_data'])
            
            # Exclude specified users from this public view
            if row['username'] in g.excluded_users:
                continue

            # Skip unlisted projects
            if project.get('visibility') != 'public':
                continue

            # Build a safe project summary for the homepage
            title = project.get('title') or 'Untitled Project'
            slug = project.get('slug') or ''
            description = project.get('description') or project.get('currentDescription') or 'No description available.'
            thumbnail_url = f"https://netsim-img.ext.io/@{row['username']}/{slug}"

            # Derive creation timestamp from oldest version ID (format: v_<timestamp_ms>)
            created_at_ms = None
            versions = project.get('versions', {})
            if versions:
                ts_list = []
                for vid in versions.keys():
                    if vid.startswith('v_'):
                        try:
                            ts_list.append(int(vid.split('_')[1]))
                        except (ValueError, IndexError):
                            pass
                if ts_list:
                    created_at_ms = min(ts_list)

            public_projects.append({
                'username': row['username'],
                'avatar_url': row['avatar_url'] or '/default.webp',
                'title': title,
                'slug': slug,
                'description': description,
                'likes': row['likes_count'] or 0,
                'thumbnail_url': thumbnail_url,
                'views': project.get('views', 0),
                'created_at_ms': created_at_ms,
            })
        except (json.JSONDecodeError, KeyError):
            # Skip malformed project rows
            continue
            
    # Keep a reasonable cap for frontend; the query already limited, but ensure final size is controlled
    return jsonify({'success': True, 'projects': public_projects[:100]})

@api.route('/projects/hot')
def get_hot_projects():
    """
    Return the 'hot' projects feed, ordered primarily by number of likes (descending).
    This endpoint filters out excluded users and non-public projects, and returns a compact summary
    including likes so the frontend can present a 'Hot' homepage view.
    """
    rows = query_db('''
        SELECT p.id as db_id, p.project_data, u.username,
               (SELECT COUNT(*) FROM likes WHERE project_db_id = p.id) as likes_count
        FROM projects p
        JOIN users u ON p.user_id = u.id
        ORDER BY likes_count DESC, p.updated_at DESC
        LIMIT 200
    ''')

    hot_projects = []
    for row in rows:
        try:
            project = json.loads(row['project_data'])
            
            # Exclude specified users from this public view
            if row['username'] in g.excluded_users:
                continue

            # Only include projects that are public
            if project.get('visibility') != 'public':
                continue

            title = project.get('title') or 'Untitled Project'
            slug = project.get('slug') or ''
            description = project.get('description') or project.get('currentDescription') or 'No description available.'
            thumbnail_url = f"https://netsim-img.ext.io/@{row['username']}/{slug}"

            hot_projects.append({
                'username': row['username'],
                'title': title,
                'slug': slug,
                'description': description,
                'likes': row['likes_count'] or 0,
                'thumbnail_url': thumbnail_url
            })
        except (json.JSONDecodeError, KeyError):
            continue

    return jsonify({'success': True, 'projects': hot_projects[:100]})

@api.route('/projects', methods=['GET'])
@login_required
def get_projects():
    user_id = session['user_id']
    projects_from_db = query_db('SELECT slug, project_data FROM projects WHERE user_id = ?', [user_id])
    
    projects_data = {}
    for row in projects_from_db:
        try:
            project = json.loads(row['project_data'])
            # Use the local project ID as the key
            projects_data[project['id']] = project
        except (json.JSONDecodeError, KeyError):
            # Skip corrupted project data
            app.logger.error(f"Could not parse project data for user {user_id}, slug {row['slug']}")
            pass
    
    return jsonify({'success': True, 'projects': projects_data})

@api.route('/projects', methods=['POST'])
@login_required
def create_project():
    user_id = session['user_id']
    data = request.get_json()
    project_data = data.get('project_data')

    if not project_data or 'slug' not in project_data or 'id' not in project_data:
        return jsonify({'success': False, 'message': 'Invalid project data provided'}), 400

    slug = project_data['slug'].strip()
    project_id_str = project_data['id']
    
    # Check if a project with this slug already exists for the user
    existing_slug = query_db('SELECT id FROM projects WHERE user_id = ? AND slug = ?', [user_id, slug], one=True)
    if existing_slug:
        return jsonify({'success': False, 'message': 'A project with this slug already exists'}), 409

    # Check if a project with this client-side ID already exists
    existing_id = query_db('SELECT id FROM projects WHERE user_id = ? AND project_id_str = ?', [user_id, project_id_str], one=True)
    if existing_id:
        return jsonify({'success': False, 'message': 'A project with this ID already exists'}), 409

    db = get_db()
    db.execute('INSERT INTO projects (user_id, project_id_str, slug, project_data) VALUES (?, ?, ?, ?)',
               (user_id, project_id_str, slug, json.dumps(project_data)))
    db.commit()
    return jsonify({'success': True, 'message': 'Project created successfully'})

@api.route('/projects/<project_id_str>', methods=['PUT'])
@login_required
def update_project_put(project_id_str):
    user_id = session['user_id']
    data = request.get_json()
    project_data = data.get('project_data')

    if not project_data or 'slug' not in project_data:
        return jsonify({'success': False, 'message': 'Project data is required'}), 400

    new_slug = project_data['slug']

    # First, verify this project belongs to the current user.
    project_to_update = query_db('SELECT id FROM projects WHERE user_id = ? AND project_id_str = ?', [user_id, project_id_str], one=True)
    if not project_to_update:
        # Before returning 404, check if the project exists at all. If it does, it means it belongs to another user.
        project_exists = query_db('SELECT id FROM projects WHERE project_id_str = ?', [project_id_str], one=True)
        if project_exists:
            return jsonify({'success': False, 'message': 'You do not have permission to edit this project.'}), 403
        return jsonify({'success': False, 'message': 'Project not found.'}), 404

    # Check if the new slug is already taken by another project of the same user
    existing_project = query_db(
        'SELECT id FROM projects WHERE user_id = ? AND slug = ? AND project_id_str != ?',
        [user_id, new_slug, project_id_str],
        one=True
    )
    if existing_project:
        return jsonify({'success': False, 'message': 'This slug is already in use by another project.'}), 409

    db = get_db()
    db.execute('UPDATE projects SET slug = ?, project_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND project_id_str = ?',
               (new_slug, json.dumps(project_data), user_id, project_id_str))
    db.commit()

    return jsonify({'success': True, 'message': 'Project updated successfully'})


@api.route('/projects/<project_id_str>', methods=['DELETE'])
@login_required
def delete_project(project_id_str):
    user_id = session['user_id']
    db = get_db()
    db.execute('DELETE FROM projects WHERE user_id = ? AND project_id_str = ?', (user_id, project_id_str))
    db.commit()
    return ('', 204)

@api.route('/generate', methods=['POST'])
@login_required
def generate_site():
    user_id = session['user_id']
    data = request.get_json()
    project_id_str = data.get('projectId')
    user_prompt = data.get('prompt')
    model_name = data.get('model', 'GPT-5 Nano')
    abilities = data.get('abilities', {})
    images = data.get('images', [])

    if not project_id_str or not user_prompt:
        return jsonify({'success': False, 'message': 'Project ID and prompt are required'}), 400

    # Fetch project data
    project_row = query_db('SELECT id, project_data FROM projects WHERE user_id = ? AND project_id_str = ?', [user_id, project_id_str], one=True)
    if not project_row:
        return jsonify({'success': False, 'message': 'Project not found'}), 404

    try:
        project_data = json.loads(project_row['project_data'])
    except json.JSONDecodeError:
        return jsonify({'success': False, 'message': 'Corrupted project data'}), 500

    # AI Configuration
    # 1. Client overrides (Settings)
    # 2. Environment variables (.env)
    # 3. Defaults
    
    client_api_key = data.get('apiKey')
    client_api_base = data.get('apiBase')

    # Prioritize environment variable if client key is not set
    api_key = client_api_key if client_api_key else os.environ.get('AI_API_KEY')
    # Use OpenRouter as default provider
    api_base = client_api_base if client_api_base else os.environ.get('AI_API_BASE', 'https://openrouter.ai/api/v1')
    
    # Clean base URL
    api_base = api_base.rstrip('/')
    
    # If no key is provided and we are using a custom endpoint, OpenAI lib requires *something*.
    # If no key is provided, use 'dummy' — OpenRouter will return a 401 which the UI will surface.
    if not api_key:
        api_key = "dummy"

    # Model Mapping — OpenRouter model IDs
    model_map = {
        # OpenAI
        'GPT-5 Nano': 'openai/gpt-4o-mini',
        'GPT-5 Mini': 'openai/gpt-4o',
        'GPT-5.2': 'openai/gpt-4-turbo',
        'GPT-5.2 Pro': 'openai/gpt-4-turbo',

        # Anthropic
        'Claude Haiku 4.5': 'anthropic/claude-3-haiku',
        'Claude Sonnet 4.5': 'anthropic/claude-sonnet-4-5',
        'Claude Opus 4.6': 'anthropic/claude-3-opus',

        # Google
        'Gemini 2.5 Flash Lite': 'google/gemini-flash-1.5-8b',
        'Gemini 3 Flash': 'google/gemini-flash-1.5',
        'Gemini 3 Pro': 'google/gemini-pro-1.5',
        'Gemini 2.5 Pro': 'google/gemini-2.5-pro-preview',

        # Specialized / Open Source
        'DeepSeek V3.2': 'deepseek/deepseek-chat',
        'Qwen3 Coder 30B': 'qwen/qwen-2.5-coder-32b-instruct',
        'Mistral Small 3.2': 'mistralai/mistral-small',
        'Grok 4 Fast': 'x-ai/grok-beta',
        'Kimi K2.5': 'moonshotai/moonshot-v1-8k',
        'MiniMax M2.1': 'minimax/minimax-01',
        'Amazon Nova Micro': 'amazon/nova-micro-v1',
        'GLM-5': 'zhipuai/glm-4',
    }

    # Determine the model ID to send to the API
    api_model = model_map.get(model_name, model_name)

    # Allow ENV override for self-hosted deployments
    env_model = os.environ.get('AI_MODEL')
    if env_model:
        api_model = env_model

    # Get user custom instructions
    user_settings = query_db('SELECT custom_instructions FROM users WHERE id = ?', [user_id], one=True)
    custom_instructions = user_settings['custom_instructions'] if user_settings else None
    
    full_system_prompt = SYSTEM_PROMPT
    if custom_instructions:
        full_system_prompt += f"\n\n**USER CUSTOM INSTRUCTIONS:**\n{custom_instructions}"

    # Metadata and Database Ability Injection
    if abilities.get('metadata'):
        metadata_doc = """
**NETSIM PLATFORM METADATA API (Experimental):**
You can interact with the platform's public data using the following endpoints (available via `fetch` from the user's browser):
1. **List Public Projects:** `GET /api/v1/projects/public` -> Returns a list of recent public project summaries.
2. **Project Details:** `GET /api/v1/p/<username>/<slug>` -> Returns full data for a specific project.
3. **Social Stats:** `GET /api/v1/p/<username>/<slug>/social` -> Returns like counts and whether the current user liked the project.
4. **Toggle Like:** `POST /api/v1/p/<username>/<slug>/like` -> Authenticated endpoint to like/unlike a project (returns updated social info).
5. **Comments List:** `GET /api/v1/p/<username>/<slug>/comments` -> Returns a list of comments for a project.
6. **Post Comment:** `POST /api/v1/p/<username>/<slug>/comments` -> Authenticated endpoint to post a comment.
7. **Current User:** `GET /api/v1/me` -> Returns the current session's user info (e.g., logged_in, username, avatar_url); useful for client-side UI and permission checks.
8. **User Profile:** `GET /api/v1/users/<username>/profile` -> Returns profile metadata (profile slug, avatar URL, bio).
9. **Project Thumbnails:** `https://netsim-img.ext.io/@<username>/<slug>` (Image URL).

Use these to build "Explore" features, "Social Feeds", "Project Viewers", profile pages, or interactive social widgets within the apps you create.
"""
        full_system_prompt += f"\n\n{metadata_doc}"

    if abilities.get('database'):
        database_doc = """
**NETSIM SIMPLE DATABASE (BETA) API:**
A lightweight JSON DB system is available under /api/v1/db for structured storage. Use these endpoints from your generated app code to create and manage small datasets:

1. Create a database (owner only): POST /api/v1/db
   - body: { "name": "My DB", "public_write": false }
   - returns: { db: { id, name } }

2. Read DB info and rows: GET /api/v1/db/<db_id>
   - returns metadata and rows array.

3. List rows: GET /api/v1/db/<db_id>/rows
   - returns: { rows: [ { id, data, created_by, created_at }, ... ] }

4. Add a row: POST /api/v1/db/<db_id>/rows
   - body: { "data": { ... } }
   - Permission: owner or if `public_write` is true, anyone may POST.

5. Delete a row: DELETE /api/v1/db/<db_id>/rows/<row_id>
   - Permission: owner or creator; requires authentication.

6. Update DB permissions (owner only): PUT /api/v1/db/<db_id>/permissions
   - body: { "public_write": true|false, "name": "New name" }

Guidelines for AI-generated code:
- Use fetch() with proper method/json headers and handle auth (cookies/session) for owner-only operations.
- Validate responses and handle 401/403 by prompting the user to log in.
- Keep user-facing DB operations minimal and sanitize input.
- Include optimistic UI updates but roll back on server errors.
- Respect the owner's 'public_write' flag; do not assume write permissions.
"""
        full_system_prompt += f"\n\n{database_doc}"

    if abilities.get('llms'):
        llms_doc = """
**NETSIM LLMS (EXPERIMENTAL):**
If enabled, prefer using the netsim LLM API for in-app model-driven features. Use the following guidance when generating project-integrated code:

- API endpoint: POST https://netsim-aiapi.ext.io/v1/chat/completions
  - Use model: Qwen3-0.6B-Q4_K_M
  - Accept streaming responses when possible to provide progressive UI updates (server-sent events / chunked json).
  - Example request shape: { "model": "Qwen3-0.6B-Q4_K_M", "messages": [...], "stream": true }

- NOTE ABOUT QWEN3 THINKING: Qwen3-0.6B is a "thinking" style model that may include its internal reasoning inside <think>...</think> tags; these thought-tags are part of model output unless the response explicitly contains the directive `/no_think`, in which case the model should not emit <think> sections. When integrating streamed or parsed responses from this model, treat <think> content as internal exposition (useful for debugging or progressive UIs) and avoid injecting it directly into production-facing UI without explicit sanitization or user-visible labeling.

- Client integration notes:
  - Use fetch() with ReadableStream / streaming parsing to surface partial content to the page while the LLM is still responding.
  - Provide graceful fallbacks when streaming isn't available: show a "Generating..." placeholder and then load full response.
  - Respect rate limits and provide exponential backoff retry behavior for transient errors.

- Security and UX:
  - Never embed raw API keys in generated code; instruct users to store keys in environment/config or use BYOP flows.
  - For streaming responses, implement incremental DOM updates and ensure scripts/styles are only applied after validated segments to avoid injection risks.

Use this ability to enable LLM-powered app widgets, streaming preview panels, or progressive generation features inside the user's project (but do not change the server itself unless the user asks).
"""
        full_system_prompt += f"\n\n{llms_doc}"

    # Prepare Messages
    messages = [{"role": "system", "content": full_system_prompt}]
    
    # Add project history (Last 3 versions context)
    sorted_versions = sorted(project_data.get('versions', {}).values(), key=lambda x: x['id'])
    current_ver_id = project_data.get('currentVersionId')

    for v in sorted_versions[-3:]: 
        if v['id'] > current_ver_id: continue
        messages.append({"role": "user", "content": v.get('prompt', 'Build version')})
        # Mock assistant response to provide context
        content_json = json.dumps({'html': v.get('html', ''), 'css': v.get('css', ''), 'js': v.get('js', '')})
        messages.append({
            "role": "assistant", 
            "content": f"Here is the update:\n```json\n{content_json}\n```"
        })

    if images:
        user_content = [{"type": "text", "text": user_prompt}]
        for img_base64 in images:
            # Ensure proper data URI format
            if not img_base64.startswith('data:image'):
                img_base64 = f"data:image/png;base64,{img_base64}"
            user_content.append({
                "type": "image_url",
                "image_url": {"url": img_base64}
            })
        messages.append({"role": "user", "content": user_content})
    else:
        messages.append({"role": "user", "content": user_prompt})

    # Call AI using OpenAI Client
    try:
        client = OpenAI(
            base_url=api_base,
            api_key=api_key,
            timeout=180.0,
            max_retries=2
        )

        app.logger.info(f"Generating with model: {api_model} at {api_base}")

        # Prepare initial file state from current version
        # We consolidate old html/css/js fields into a virtual filesystem
        virtual_files = {}
        if current_ver_id and current_ver_id in project_data['versions']:
            cv = project_data['versions'][current_ver_id]
            if 'files' in cv:
                virtual_files = cv['files'].copy()
            else:
                # Migrate old structure to virtual files
                if cv.get('html'): virtual_files['index.html'] = cv['html']
                if cv.get('css'): virtual_files['style.css'] = cv['css']
                if cv.get('js'): virtual_files['script.js'] = cv['js']

        has_updates = False
        turn = 0
        max_turns = 8 # Agent loop limit

        while turn < max_turns:
            turn += 1
            app.logger.info(f"--- AI Turn {turn} ---")
            
            completion = client.chat.completions.create(
                model=api_model,
                messages=messages,
                tools=AI_TOOLS,
                tool_choice="auto"
            )

            choice = completion.choices[0].message
            messages.append(choice)

            if not choice.tool_calls:
                # If no tool calls and it's the first turn, check for content markdown fallback
                if turn == 1 and choice.content:
                     json_match = re.search(r'```json\s*([\s\S]*?)\s*```', choice.content)
                     if json_match:
                        try:
                            parsed = json.loads(json_match.group(1))
                            if 'html' in parsed: virtual_files['index.html'] = parsed['html']
                            if 'css' in parsed: virtual_files['style.css'] = parsed['css']
                            if 'js' in parsed: virtual_files['script.js'] = parsed['js']
                            has_updates = True
                        except json.JSONDecodeError: pass
                break
            
            # Execute tools
            for tool_call in choice.tool_calls:
                func_name = tool_call.function.name
                tool_result = ""
                try:
                    args = json.loads(tool_call.function.arguments)
                    app.logger.info(f"Tool call: {func_name}({args})")
                    
                    if func_name == 'list_files':
                        tool_result = json.dumps(list(virtual_files.keys()))
                    elif func_name == 'read_file':
                        path = args.get('path')
                        tool_result = virtual_files.get(path, "Error: File not found.")
                    elif func_name == 'create_file':
                        path = args.get('path')
                        virtual_files[path] = args.get('content', '')
                        tool_result = f"File {path} created/updated."
                        has_updates = True
                    elif func_name == 'edit_file':
                        path = args.get('path')
                        pattern = args.get('pattern')
                        replacement = args.get('replacement')
                        if path in virtual_files:
                            if pattern in virtual_files[path]:
                                virtual_files[path] = virtual_files[path].replace(pattern, replacement)
                                tool_result = f"File {path} successfully edited."
                                has_updates = True
                            else:
                                tool_result = f"Error: Pattern not found in {path}."
                        else:
                            tool_result = f"Error: File {path} not found."
                    elif func_name == 'delete_file':
                        path = args.get('path')
                        if path in virtual_files:
                            del virtual_files[path]
                            tool_result = f"File {path} deleted."
                            has_updates = True
                        else:
                            tool_result = "Error: File not found."
                    elif func_name == 'update_metadata':
                        project_data['title'] = args.get('title', project_data['title'])
                        project_data['description'] = args.get('description', project_data['description'])
                        tool_result = "Metadata updated."
                    else:
                        tool_result = f"Error: Tool {func_name} not recognized."
                except Exception as e:
                    tool_result = f"Error executing tool: {str(e)}"
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": func_name,
                    "content": tool_result
                })

        if not has_updates:
            app.logger.warning("AI response did not contain updates.")
            return jsonify({'success': False, 'message': 'AI did not provide valid project updates. Please try again.'}), 500

        # Create New Version
        new_version_id = f"v_{int(time.time() * 1000)}"
        
        project_data['versions'][new_version_id] = {
            "id": new_version_id,
            "prompt": user_prompt,
            "files": virtual_files,
            "model": model_name,
            # Backward compatibility for serving
            "html": virtual_files.get('index.html', ''),
            "css": virtual_files.get('style.css', ''),
            "js": virtual_files.get('script.js', '')
        }
        project_data['currentVersionId'] = new_version_id
        
        # Save to DB
        db = get_db()
        db.execute('UPDATE projects SET project_data = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                   (json.dumps(project_data), project_data['slug'], project_row['id']))
        db.commit()

        return jsonify({'success': True, 'project': project_data})

    except OpenAIError as e:
        app.logger.error(f"OpenAI API Error: {e}")
        error_msg = str(e)
        if "429" in error_msg:
             return jsonify({'success': False, 'message': 'The AI service is currently busy (Rate Limit). Please try again in a few seconds.'}), 429
        return jsonify({'success': False, 'message': f'AI provider error: {error_msg}'}), 502
    except Exception as e:
        app.logger.error(f"General Generation Error: {e}")
        return jsonify({'success': False, 'message': f'An unexpected error occurred: {str(e)}'}), 500

@api.route('/p/<username>/<slug>')
def get_public_project(username, slug):
    user = query_db('SELECT id FROM users WHERE username = ?', [username], one=True)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    project_row = query_db('SELECT id, project_data FROM projects WHERE user_id = ? AND slug = ?', [user['id'], slug], one=True)
    if not project_row:
        return jsonify({'success': False, 'message': 'Project not found'}), 404

    try:
        project_data = json.loads(project_row['project_data'])
        # Increment view counter
        project_data['views'] = project_data.get('views', 0) + 1
        try:
            db = get_db()
            db.execute('UPDATE projects SET project_data = ? WHERE id = ?',
                       (json.dumps(project_data), project_row['id']))
            db.commit()
        except Exception:
            pass  # Don't fail the request if view tracking fails
        return jsonify({'success': True, 'project': project_data})
    except json.JSONDecodeError:
        return jsonify({'success': False, 'message': 'Error parsing project data'}), 500

@api.route('/p/<username>/<slug>/fork', methods=['POST'])
@login_required
def fork_public_project(username, slug):
    """
    Fork a public project: copies project_data into the current user's projects with a new id/slug.
    The forked project slug will be made unique by appending a timestamp if needed.
    """
    # Find owner and project
    owner = query_db('SELECT id, username FROM users WHERE username = ?', [username], one=True)
    if not owner:
        return jsonify({'success': False, 'message': 'Owner not found'}), 404

    project_row = query_db('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [owner['id'], slug], one=True)
    if not project_row:
        return jsonify({'success': False, 'message': 'Project not found'}), 404

    try:
        project_data = json.loads(project_row['project_data'])
    except json.JSONDecodeError:
        return jsonify({'success': False, 'message': 'Error parsing project data'}), 500

    # Ensure project is allowed to be forked (public or pinned)
    # Here we allow forking of any project; you can add extra checks if desired.

    user_id = session['user_id']
    db = get_db()

    # Prepare new project copy
    new_project = json.loads(json.dumps(project_data))  # deep copy
    # New unique client ID
    new_id = str(int(time.time() * 1000))
    new_project['id'] = new_id

    # Make a new slug and ensure uniqueness for this user
    base_slug = new_project.get('slug') or slug
    candidate_slug = base_slug
    suffix = 1
    while query_db('SELECT id FROM projects WHERE user_id = ? AND slug = ?', [user_id, candidate_slug], one=True):
        candidate_slug = f"{base_slug}-{suffix}"
        suffix += 1

    new_project['slug'] = candidate_slug
    # Reset some metadata
    new_project['title'] = new_project.get('title', 'Forked Project') + ' (Fork)'
    # leave versions intact but keep them; create a new currentVersionId pointing to latest
    if 'versions' in new_project and isinstance(new_project['versions'], dict):
        sorted_ids = sorted(new_project['versions'].keys(), reverse=True)
        if sorted_ids:
            new_project['currentVersionId'] = sorted_ids[0]
    else:
        # Ensure a minimal versions structure
        vid = f"v_{new_id}"
        new_project['versions'] = {vid: {"id": vid, "prompt": new_project.get('description','Forked project'), "html": new_project.get('html',''), "css": new_project.get('css',''), "js": new_project.get('js','')}}
        new_project['currentVersionId'] = vid

    try:
        db.execute('INSERT INTO projects (user_id, project_id_str, slug, project_data) VALUES (?, ?, ?, ?)', 
                   (user_id, new_id, candidate_slug, json.dumps(new_project)))
        db.commit()
    except Exception as e:
        db.rollback()
        app.logger.error(f"Failed to insert forked project: {e}")
        return jsonify({'success': False, 'message': 'Could not create forked project.'}), 500

    return jsonify({'success': True, 'project': new_project, 'owner': session.get('username')})

# --- Download project as ZIP ---
@api.route('/projects/<project_id_str>/download', methods=['GET'])
@login_required
def download_project_zip(project_id_str):
    """
    Create a .zip archive of a project's current files and return it as an attachment.
    Only the project owner may download the zip.
    """
    # Find project and verify ownership
    project_row = query_db('SELECT id, user_id, project_data, slug FROM projects WHERE project_id_str = ?', [project_id_str], one=True)
    if not project_row:
        return jsonify({'success': False, 'message': 'Project not found'}), 404

    # Check ownership
    if session.get('user_id') != project_row['user_id']:
        return jsonify({'success': False, 'message': 'Only the project owner can download the project'}), 403

    try:
        project_data = json.loads(project_row['project_data'])
    except Exception:
        return jsonify({'success': False, 'message': 'Corrupted project data'}), 500

    # Pick current version (fallback to latest)
    versions = project_data.get('versions', {})
    version_id = project_data.get('currentVersionId')
    if not version_id or version_id not in versions:
        sorted_ids = sorted(versions.keys(), reverse=True)
        version_id = sorted_ids[0] if sorted_ids else None

    if not version_id:
        return jsonify({'success': False, 'message': 'No version available to download'}), 404

    version = versions.get(version_id, {})

    # Normalize files from 'files' map or legacy html/css/js
    files = {}
    if 'files' in version and isinstance(version['files'], dict):
        files = version['files'].copy()
    else:
        if version.get('html') is not None:
            files['index.html'] = version.get('html', '')
        if version.get('css') is not None:
            files['style.css'] = version.get('css', '')
        if version.get('js') is not None:
            files['script.js'] = version.get('js', '')

    if not files:
        return jsonify({'success': False, 'message': 'No files to include in the ZIP'}), 400

    # Create in-memory zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add root-level files
        for path, content in files.items():
            # ensure bytes; files are textual in DB
            if isinstance(content, str):
                zf.writestr(path, content)
            else:
                # if non-string content is stored, convert to JSON
                zf.writestr(path, json.dumps(content))

        # Optionally include a metadata.json
        metadata = {
            'project_id': project_data.get('id'),
            'title': project_data.get('title'),
            'slug': project_data.get('slug'),
            'version': version_id,
            'generated_at': int(time.time())
        }
        zf.writestr('netsim-metadata.json', json.dumps(metadata, indent=2))

    zip_buffer.seek(0)
    filename = f"{project_data.get('slug') or project_id_str}.zip"
    return send_file(zip_buffer, mimetype='application/zip', as_attachment=True, download_name=filename)

# --- Upload/import files: each upload creates a new revision ---
@api.route('/projects/<project_id_str>/upload', methods=['POST'])
@login_required
def upload_project_files(project_id_str):
    """
    Accept multipart file uploads and create a new project version that includes/merges uploaded files.
    Text files are stored directly into the project's 'files' map so they can be served at
    /@<user>/<slug>/<filename>. Binary files are saved to disk under uploads/projects/<project_db_id>/ and
    the project's files map will reference the on-disk path (so view_project_resource can serve it).
    Returns the updated project blob.
    """
    user_id = session['user_id']
    project_row = query_db('SELECT id, project_data, slug FROM projects WHERE user_id = ? AND project_id_str = ?', [user_id, project_id_str], one=True)
    if not project_row:
        return jsonify({'success': False, 'message': 'Project not found or not owned by you.'}), 404

    try:
        project_data = json.loads(project_row['project_data'])
    except json.JSONDecodeError:
        return jsonify({'success': False, 'message': 'Corrupted project data.'}), 500

    # Ensure files were sent
    if 'files' not in request.files:
        return jsonify({'success': False, 'message': 'No files uploaded.'}), 400

    # Read existing current files map (merge into it)
    current_vid = project_data.get('currentVersionId')
    current_files = {}
    if current_vid and current_vid in project_data.get('versions', {}):
        ver = project_data['versions'][current_vid]
        if isinstance(ver.get('files'), dict):
            current_files = ver['files'].copy()
        else:
            if ver.get('html') is not None:
                current_files['index.html'] = ver.get('html', '')
            if ver.get('css') is not None:
                current_files['style.css'] = ver.get('css', '')
            if ver.get('js') is not None:
                current_files['script.js'] = ver.get('js', '')

    # Ensure per-project uploads dir exists for binary files
    uploads_root = os.path.join('uploads', 'projects', str(project_row['id']))
    os.makedirs(uploads_root, exist_ok=True)

    # Process uploaded files and add/replace entries in current_files
    files = request.files.getlist('files')
    saved_names = []
    for f in files:
        filename = secure_filename(f.filename) or f"file_{int(time.time()*1000)}"
        try:
            # Enforce 300KB per-file limit for project uploads
            try:
                # Determine size by seeking stream if possible
                stream = f.stream
                stream.seek(0, os.SEEK_END)
                size = stream.tell()
                stream.seek(0)
            except Exception:
                # Fallback: use content_length if available
                size = getattr(f, 'content_length', None) or getattr(f, 'content_length', None) or 0

            max_size_bytes = 300 * 1024  # 300KB
            if size and size > max_size_bytes:
                app.logger.warning(f"Uploaded file {filename} too large: {size} bytes")
                return jsonify({'success': False, 'message': f'File {filename} exceeds the 300KB per-file upload limit.'}), 413

            data = f.read()
            # Try to decode as utf-8 text; if succeeds treat as text file and store directly in files map
            try:
                text = data.decode('utf-8')
                current_files[filename] = text
            except Exception:
                # Binary file: save to disk under uploads/projects/<project_db_id>/<filename>
                disk_path = os.path.join(uploads_root, filename)
                with open(disk_path, 'wb') as out_f:
                    out_f.write(data)
                # Store the web path so view_project_resource can serve it directly from disk
                web_path = f"/uploads/projects/{project_row['id']}/{filename}"
                current_files[filename] = web_path
        except Exception as e:
            app.logger.error(f"Error reading uploaded file {filename}: {e}")
            return jsonify({'success': False, 'message': f'Failed to read file {filename}.'}), 500
        saved_names.append(filename)

    # Create new version with merged files
    new_version_id = f"v_{int(time.time() * 1000)}"
    project_data.setdefault('versions', {})
    project_data['versions'][new_version_id] = {
        "id": new_version_id,
        "prompt": f"Imported files: {', '.join(saved_names)}",
        "files": current_files,
        "model": project_data.get('versions', {}).get(current_vid, {}).get('model', 'uploaded')
    }
    project_data['currentVersionId'] = new_version_id

    # For backward compatibility, also populate html/css/js top-level if those files exist
    if 'index.html' in current_files and isinstance(current_files['index.html'], str) and not current_files['index.html'].startswith('/uploads/projects/'):
        project_data['versions'][new_version_id]['html'] = current_files.get('index.html', '')
    if 'style.css' in current_files and isinstance(current_files['style.css'], str):
        project_data['versions'][new_version_id]['css'] = current_files.get('style.css', '')
    if 'script.js' in current_files and isinstance(current_files['script.js'], str):
        project_data['versions'][new_version_id]['js'] = current_files.get('script.js', '')

    # Save back to DB
    db = get_db()
    try:
        db.execute('UPDATE projects SET project_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (json.dumps(project_data), project_row['id']))
        db.commit()
        return jsonify({'success': True, 'project': project_data})
    except Exception as e:
        db.rollback()
        app.logger.error(f"Error saving uploaded files for project {project_row['id']}: {e}")
        return jsonify({'success': False, 'message': 'Failed to save uploaded files.'}), 500


# --- Social API Routes ---
def get_project_db_id(username, slug):
    """Helper to get the primary key of a project from username and slug."""
    project_info = query_db('''
        SELECT p.id FROM projects p
        JOIN users u ON p.user_id = u.id
        WHERE u.username = ? AND p.slug = ?
    ''', [username, slug], one=True)
    return project_info['id'] if project_info else None

@api.route('/p/<username>/<slug>/social')
def get_social_info(username, slug):
    project_db_id = get_project_db_id(username, slug)
    if not project_db_id:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    likes_count = query_db('SELECT COUNT(*) FROM likes WHERE project_db_id = ?', [project_db_id], one=True)[0]
    
    liked_by_user = False
    if 'user_id' in session:
        user_like = query_db('SELECT id FROM likes WHERE project_db_id = ? AND user_id = ?', [project_db_id, session['user_id']], one=True)
        if user_like:
            liked_by_user = True
            
    return jsonify({
        'success': True,
        'likes': likes_count,
        'liked_by_user': liked_by_user,
    })

@api.route('/p/<username>/<slug>/like', methods=['POST'])
@login_required
def toggle_like(username, slug):
    project_db_id = get_project_db_id(username, slug)
    if not project_db_id:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
    
    user_id = session['user_id']
    db = get_db()
    
    existing_like = query_db('SELECT id FROM likes WHERE project_db_id = ? AND user_id = ?', [project_db_id, user_id], one=True)
    
    if existing_like:
        db.execute('DELETE FROM likes WHERE id = ?', [existing_like['id']])
    else:
        db.execute('INSERT INTO likes (project_db_id, user_id) VALUES (?, ?)', (project_db_id, user_id))
    
    db.commit()
    
    return get_social_info(username, slug)

@api.route('/p/<username>/<slug>/comments')
def get_comments(username, slug):
    project_db_id = get_project_db_id(username, slug)
    if not project_db_id:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
        
    comments_data = query_db('''
        SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.project_db_id = ?
        ORDER BY c.created_at DESC
    ''', [project_db_id])
    
    comments = [dict(row) for row in comments_data]
    return jsonify({'success': True, 'comments': comments})

@api.route('/p/<username>/<slug>/comments', methods=['POST'])
@login_required
def post_comment(username, slug):
    project_db_id = get_project_db_id(username, slug)
    if not project_db_id:
        return jsonify({'success': False, 'message': 'Project not found'}), 404
        
    data = request.get_json()
    content = data.get('content')
    
    if not content or not content.strip():
        return jsonify({'success': False, 'message': 'Comment cannot be empty'}), 400
        
    user_id = session['user_id']
    db = get_db()
    
    cursor = db.execute('INSERT INTO comments (project_db_id, user_id, content) VALUES (?, ?, ?)', (project_db_id, user_id, content))
    new_comment_id = cursor.lastrowid
    db.commit()
    
    # Fetch the newly created comment to return it
    new_comment_data = query_db('''
        SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    ''', [new_comment_id], one=True)
    
    return jsonify({'success': True, 'comment': dict(new_comment_data)}), 201


# --- Main Flask App Setup ---

def create_app():
    app = Flask(__name__, static_folder=None)
    # Use a stable secret key to persist sessions across server restarts/updates
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'netsim-dev-secret-key-change-this-in-prod')
    app.config['PERMANENT_SESSION_LIFETIME'] = 2592000  # 30 days
    app.config['UPLOAD_FOLDER'] = 'uploads/avatars'
    DATABASE = 'database.db'

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # --- Colored Logging Setup ---
    class BColors:
        HEADER = '\033[95m'
        OKBLUE = '\033[94m'
        OKCYAN = '\033[96m'
        OKGREEN = '\033[92m'
        WARNING = '\033[93m'
        FAIL = '\033[91m'
        ENDC = '\033[0m'
        BOLD = '\033[1m'
        UNDERLINE = '\033[4m'

    class ColoredFormatter(logging.Formatter):
        def format(self, record):
            level_color_map = {
                logging.DEBUG: BColors.OKCYAN,
                logging.INFO: BColors.OKGREEN,
                logging.WARNING: BColors.WARNING,
                logging.ERROR: BColors.FAIL,
                logging.CRITICAL: BColors.BOLD + BColors.FAIL,
            }
            color = level_color_map.get(record.levelno, BColors.ENDC)
            # Pad levelname to make logs align
            levelname = record.levelname
            record.levelname_colored = f"{color}[{levelname}]{BColors.ENDC}"
            return super().format(record)

    def setup_logging(app_instance):
        # Disable werkzeug's default handler to avoid duplicate logs
        logging.getLogger('werkzeug').handlers = []

        for handler in app_instance.logger.handlers:
            app_instance.logger.removeHandler(handler)
        
        handler = logging.StreamHandler(sys.stdout)
        # Format without timestamp, use the custom colored levelname
        formatter = ColoredFormatter('%(levelname_colored)s %(message)s')
        handler.setFormatter(formatter)
        
        app_instance.logger.addHandler(handler)
        app_instance.logger.setLevel(logging.INFO)

    setup_logging(app)
    
    with app.app_context():
        run_migrations()

    def load_excluded_users():
        """Loads the list of excluded users from a JSON file."""
        REMOVED_FROM_HOME_FILE = 'removedfromhome.json'
        try:
            if os.path.exists(REMOVED_FROM_HOME_FILE):
                with open(REMOVED_FROM_HOME_FILE, 'r') as f:
                    excluded_list = json.load(f)
                    if isinstance(excluded_list, list):
                        app.logger.info(f"Loaded {len(excluded_list)} users to exclude from public API.")
                        return set(excluded_list)
                    else:
                        app.logger.warning(f"'{REMOVED_FROM_HOME_FILE}' should contain a JSON list of usernames.")
            return set()
        except (json.JSONDecodeError, IOError) as e:
            app.logger.error(f"Error loading '{REMOVED_FROM_HOME_FILE}': {e}")
            return set()

    # --- Database Context ---
    @app.before_request
    def before_request():
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.excluded_users = load_excluded_users()

    @app.teardown_request
    def teardown_request(exception):
        db = getattr(g, 'db', None)
        if db is not None:
            db.close()

    # --- Register API Blueprint ---
    app.register_blueprint(api, url_prefix='/api/v1')

    # --- Frontend Serving Routes ---
    @app.route('/default.webp')
    def serve_default_avatar():
        return send_from_directory('.', 'default.webp')
        
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        # This is a simplified serve route. For production, you'd want to use
        # a more robust solution like serving from Nginx.
        return send_from_directory('uploads', filename)

    @app.route('/app.js')
    def serve_js():
        return send_from_directory('.', 'app.js')

    @app.route('/@<username>')
    def view_user_profile_redirect(username):
        with app.app_context():
            db_conn = sqlite3.connect(DATABASE)
            db_conn.row_factory = sqlite3.Row
            cursor = db_conn.cursor()
            cursor.execute('SELECT profile_project_slug FROM users WHERE username = ?', [username])
            user = cursor.fetchone()
            db_conn.close()

        if not user:
            return "User not found", 404
        
        profile_slug = user['profile_project_slug'] or 'profile'
        return redirect(url_for('view_project', username=username, slug=profile_slug))

    @app.route('/@<username>/<slug>/<path:resource>')
    def view_project_resource(username, slug, resource):
        """
        Serve a specific resource (file) from a project's version (e.g. /@user/slug/home.html).
        This allows in-project fetches to resolve to the project's files instead of returning the SPA shell.
        """
        DATABASE = 'database.db'
        # Lookup user and project
        db_conn = sqlite3.connect(DATABASE)
        db_conn.row_factory = sqlite3.Row
        cursor = db_conn.cursor()
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        if not user:
            db_conn.close()
            return "User not found", 404

        cursor.execute('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [user['id'], slug])
        project_row = cursor.fetchone()
        db_conn.close()

        if not project_row:
            return "Project not found", 404

        try:
            project_data = json.loads(project_row['project_data'])
        except json.JSONDecodeError:
            return "Error parsing project data", 500

        versions = project_data.get('versions', {})
        # choose pinned -> latest fallback
        version_id = project_data.get('pinnedVersionId')
        if not version_id or version_id not in versions:
            # fallback to latest
            sorted_ids = sorted(versions.keys(), reverse=True)
            version_id = sorted_ids[0] if sorted_ids else None

        if not version_id:
            return "No version available", 404

        version = versions.get(version_id, {})
        # Support both multi-file 'files' object and legacy html/css/js fields
        files = {}
        if 'files' in version and isinstance(version['files'], dict):
            files = version['files']
        else:
            if version.get('html') is not None:
                files['index.html'] = version.get('html', '')
            if version.get('css') is not None:
                files['style.css'] = version.get('css', '')
            if version.get('js') is not None:
                files['script.js'] = version.get('js', '')

        # Normalize resource path (strip any leading slashes)
        normalized = resource.lstrip('/')
        # If requested resource is directory-like or empty, serve index.html if present
        target = normalized or 'index.html'
        # If the requested name refers to a file present in the virtual files, return it
        if target in files:
            content = files[target] or ''
            # If the stored value points to an uploads/projects path, serve the file from disk
            if isinstance(content, str) and content.startswith('/uploads/projects/'):
                # content looks like: /uploads/projects/<project_db_id>/<filename>
                try:
                    rel = content.lstrip('/')
                    file_path = os.path.normpath(rel)
                    # Ensure path is within uploads/projects for safety
                    if not file_path.startswith(os.path.join('uploads', 'projects')):
                        return "File not found", 404
                    # filesystem path
                    fs_path = os.path.join(os.getcwd(), file_path)
                    if os.path.exists(fs_path) and os.path.isfile(fs_path):
                        # send_from_directory expects directory and filename
                        dir_path = os.path.dirname(fs_path)
                        file_name = os.path.basename(fs_path)
                        return send_from_directory(dir_path, file_name)
                    else:
                        return "File not found", 404
                except Exception as e:
                    app.logger.error(f"Error serving project file {content}: {e}")
                    return "Error serving file", 500

            # Otherwise treat as in-DB textual file content
            ext = os.path.splitext(target)[1].lower()
            mimetypes = {
                '.html': 'text/html; charset=utf-8',
                '.htm': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.txt': 'text/plain; charset=utf-8'
            }
            content_type = mimetypes.get(ext, 'text/plain; charset=utf-8')
            # For in-DB textual files, return content directly
            return (content, 200, {'Content-Type': content_type})

        # If not found in files, but the resource is 'index.html' fallback to assemble from html/css/js
        if normalized in ('', 'index.html') and ('index.html' in files or version.get('html')):
            html = files.get('index.html', version.get('html', ''))
            css = files.get('style.css', version.get('css', ''))
            js = files.get('script.js', version.get('js', ''))
            if css:
                html = html.replace('</head>', f'<style>{css}</style></head>', 1) if '</head>' in html else html + f'<style>{css}</style>'
            if js:
                html = html.replace('</body>', f'<script>{js}</script></body>', 1) if '</body>' in html else html + f'<script>{js}</script>'
            return (html, 200, {'Content-Type': 'text/html; charset=utf-8'})

        return "File not found", 404

    @app.route('/@<username>/<slug>')
    def view_project(username, slug):
        if request.args.get('full') == 'true':
            with app.app_context():
                db_conn = sqlite3.connect(DATABASE)
                db_conn.row_factory = sqlite3.Row
                cursor = db_conn.cursor()
                cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
                user = cursor.fetchone()
                
                if not user:
                    db_conn.close()
                    return "User not found", 404

                cursor.execute('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [user['id'], slug])
                project_row = cursor.fetchone()
                db_conn.close()

            if not project_row:
                return "Project not found", 404

            try:
                project_data = json.loads(project_row['project_data'])
                versions = project_data.get('versions', {})
                version_to_serve_id = None
                
                version_param = request.args.get('v')
                if version_param:
                    try:
                        version_num = int(version_param)
                        sorted_version_ids = sorted(versions.keys(), reverse=True)
                        index = len(sorted_version_ids) - version_num
                        if 0 <= index < len(sorted_version_ids):
                            version_to_serve_id = sorted_version_ids[index]
                    except (ValueError, IndexError):
                        pass

                if not version_to_serve_id:
                    version_to_serve_id = project_data.get('pinnedVersionId')
                    if version_to_serve_id not in versions:
                        version_to_serve_id = None
                
                if not version_to_serve_id:
                    if not versions:
                        raise ValueError("Project has no versions")
                    version_to_serve_id = sorted(versions.keys(), reverse=True)[0]

                version = versions[version_to_serve_id]
                
                html = version.get('html', '')
                css = version.get('css', '')
                js = version.get('js', '')

                if not html:
                    title = project_data.get('title', 'Project Viewer')
                    return f"""<!DOCTYPE html><html><head><title>{title}</title></head><body><h1>{title}</h1><p>This project has not been generated yet.</p></body></html>""", 200

                if css:
                    html = html.replace('</head>', f'<style>{css}</style></head>', 1)
                
                if js:
                    html = html.replace('</body>', f'<script>{js}</script></body>', 1)

                return html, 200

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                app.logger.error(f"Error processing project data for @{username}/{slug}: {e}")
                return "Error loading project data. The project might be malformed or empty.", 500
        else:
            # Serving the shell
            shell_path = os.path.join(os.path.dirname(__file__), 'index.html')
            if not os.path.exists(shell_path):
                return "index.html not found", 404
                
            with open(shell_path, 'r', encoding='utf-8') as f:
                shell_content = f.read()
            
            # Attempt to fetch project details for meta tags injection
            try:
                db_conn = sqlite3.connect(DATABASE)
                db_conn.row_factory = sqlite3.Row
                cursor = db_conn.cursor()
                cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
                user_row = cursor.fetchone()
                if user_row:
                    cursor.execute('SELECT project_data FROM projects WHERE user_id = ? AND slug = ?', [user_row['id'], slug])
                    project_row = cursor.fetchone()
                    if project_row:
                        project_data = json.loads(project_row['project_data'])
                        p_title = project_data.get('title', 'netsim')
                        p_desc = project_data.get('description') or 'No description...'
                        
                        # Use simple replacements for the shell meta tags
                        shell_content = shell_content.replace('<title>netsim</title>', f'<title>{p_title} • netsim</title>')
                        shell_content = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{p_title}">', shell_content)
                        shell_content = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{p_desc}">', shell_content)
                        shell_content = re.sub(r'<meta property="twitter:title" content="[^"]*">', f'<meta property="twitter:title" content="{p_title}">', shell_content)
                        shell_content = re.sub(r'<meta property="twitter:description" content="[^"]*">', f'<meta property="twitter:description" content="{p_desc}">', shell_content)
                        shell_content = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{p_desc}">', shell_content)
                        
                        p_image = f"https://netsim-img.ext.io/@{username}/{slug}"
                        shell_content = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{p_image}">', shell_content)
                        shell_content = re.sub(r'<meta property="twitter:image" content="[^"]*">', f'<meta property="twitter:image" content="{p_image}">', shell_content)
                db_conn.close()
            except Exception as e:
                app.logger.error(f"Error injecting metadata: {e}")

            return shell_content

    # Catch-all for frontend routing (secure: block sensitive files)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_index(path):
        # Normalize and refuse any attempts to access sensitive files
        forbidden_names = {' .env'.strip(): True}  # placeholder to make dict syntax consistent below
        # Define blacklist patterns
        FORBIDDEN_FILES = {
            '.env',
            'database.db',
            'database.sqlite',
            'requirements.txt',
            '.gitignore',
            '.env.local',
            '.env.development',
            '.env.production',
            'secrets.json',
        }
        # Disallow any hidden files or parent traversal attempts
        if not path:
            return send_from_directory('.', 'index.html')
        normalized = os.path.normpath(path).lstrip(os.sep)
        lower = normalized.lower()

        # Block attempts to traverse out of the webroot
        if '..' in path or path.startswith('../') or path.startswith('/') :
            return "Not found", 404

        # Block explicit forbidden files and common sensitive extensions
        if (lower in FORBIDDEN_FILES) or lower.endswith('.db') or lower.endswith('.env') or lower.startswith('.') or lower.endswith('.sqlite') or lower.endswith('.key'):
            return "Not found", 404

        # For safety, don't serve arbitrary filesystem files; only serve known public files
        public_files_dir = os.path.abspath('.')
        candidate = os.path.join(public_files_dir, normalized)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            # Double-check candidate isn't one of the forbidden absolute paths
            basename = os.path.basename(candidate).lower()
            if basename in FORBIDDEN_FILES or basename.startswith('.') or basename.endswith('.db') or basename.endswith('.env') or basename.endswith('.sqlite') or basename.endswith('.key'):
                return "Not found", 404
            return send_from_directory('.', normalized)

        # Default to serving the SPA shell
        return send_from_directory('.', 'index.html')

    return app

def run_migrations():
    """Checks the database version and applies migrations."""
    DATABASE = 'database.db'
    
    # Ensure the DB file exists before trying to connect
    if not os.path.exists(DATABASE):
        print("Database not found. A new one will be created by init_db_command.")
        return

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    # Get current version
    cursor.execute('PRAGMA user_version')
    current_version = cursor.fetchone()[0]
    
    print(f"Current DB version: {current_version}")

    # --- Migration 1: Add profile_project_slug and homepage_project_slug to users table ---
    if current_version < 1:
        print("Applying migration 1...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN profile_project_slug TEXT DEFAULT 'profile'")
            cursor.execute("ALTER TABLE users ADD COLUMN homepage_project_slug TEXT")
            print("  - Added 'profile_project_slug' and 'homepage_project_slug' to 'users' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  - Columns already exist, skipping.")
            else:
                raise e
        # Update version
        cursor.execute('PRAGMA user_version = 1')
        conn.commit()
        current_version = 1
        print("Migration 1 applied.")
        
    # --- Migration 2: Add project_id_str and updated_at to projects table and perform data migration ---
    if current_version < 2:
        print("Applying migration 2...")
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN project_id_str TEXT")
            cursor.execute("ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            print("  - Added 'project_id_str' and 'updated_at' to 'projects' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  - Columns already exist, skipping schema change.")
            else:
                raise e
        
        # Data migration part
        print("  - Starting data migration for projects...")
        cursor.execute("SELECT id, project_data FROM projects")
        projects = cursor.fetchall()
        updated_count = 0

        for project_id, project_data_json in projects:
            try:
                data = json.loads(project_data_json)
                
                # Check if this project needs migration
                if 'versions' in data and 'project_id_str' in data and 'pinnedVersionId' in data and 'description' in data:
                    continue

                updated_count += 1
                
                # Migrate old structure to new
                if 'versions' not in data:
                    initial_version_id = f"v_{data.get('id', project_id)}"
                    data['versions'] = {
                        initial_version_id: {
                            'id': initial_version_id,
                            'prompt': data.get('prompt', 'Initial prompt'),
                            'html': data.get('html', ''), 'css': data.get('css', ''), 'js': data.get('js', '')
                        }
                    }
                    data['currentVersionId'] = initial_version_id
                    
                if 'slug' not in data or not data['slug']:
                    data['slug'] = re.sub(r'[^a-z0-9]+', '-', data.get('title', 'untitled').lower()).strip('-')

                if 'pinnedVersionId' not in data:
                    data['pinnedVersionId'] = None

                if 'description' not in data:
                    data['description'] = "A project created in netsim."

                # Backfill project_id_str from the JSON blob 'id'
                project_id_str = data.get('id', str(project_id))
                
                # Clean up old top-level keys
                for key in ['prompt', 'html', 'css', 'js', 'history']:
                    data.pop(key, None)

                # Update the row
                cursor.execute("UPDATE projects SET project_id_str = ?, project_data = ? WHERE id = ?",
                               (project_id_str, json.dumps(data), project_id))
            
            except (json.JSONDecodeError, KeyError) as e:
                print(f"  - WARNING: Could not migrate project with id={project_id}. Error: {e}")

        if updated_count > 0:
            print(f"  - Migrated data for {updated_count} projects.")

        # Create unique index after backfilling
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_project_id_str ON projects (user_id, project_id_str)")
            print("  - Ensured unique index on (user_id, project_id_str).")
        except sqlite3.OperationalError as e:
            print(f"  - Could not create unique index, it might already exist: {e}")

        # Update version
        cursor.execute('PRAGMA user_version = 2')
        conn.commit()
        current_version = 2
        print("Migration 2 applied.")

    # --- Migration 3: Add avatar_url to users table ---
    if current_version < 3:
        print("Applying migration 3...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
            print("  - Added 'avatar_url' to 'users' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  - Column 'avatar_url' already exists, skipping.")
            else:
                raise e
        # Update version
        cursor.execute('PRAGMA user_version = 3')
        conn.commit()
        current_version = 3
        print("Migration 3 applied.")

    # --- Migration 4: Set default avatar for users ---
    if current_version < 4:
        print("Applying migration 4...")
        try:
            cursor.execute("UPDATE users SET avatar_url = '/default.webp' WHERE avatar_url IS NULL OR avatar_url = ''")
            print("  - Set '/default.webp' for users with no avatar.")
        except Exception as e:
            print(f"  - Error updating users: {e}")
        
        # It's not easy to add a DEFAULT constraint to an existing column in SQLite.
        # This migration handles existing users, and the signup logic handles new ones.
        
        cursor.execute('PRAGMA user_version = 4')
        conn.commit()
        current_version = 4
        print("Migration 4 applied.")

    # --- Migration 6: Add discord_id to users table ---
    if current_version < 6:
        print("Applying migration 6...")
        try:
            # SQLite cannot add a UNIQUE column via ALTER TABLE directly.
            # Add the column first (without UNIQUE) and then create a UNIQUE INDEX.
            cursor.execute("ALTER TABLE users ADD COLUMN discord_id TEXT")
            print("  - Added 'discord_id' to 'users' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("  - Column 'discord_id' already exists, skipping.")
            else:
                raise e

        # Try to enforce uniqueness by creating a unique index where supported.
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users (discord_id)")
            print("  - Ensured unique index on 'discord_id'.")
        except sqlite3.OperationalError as e:
            print(f"  - Could not create unique index on 'discord_id': {e}")

        cursor.execute('PRAGMA user_version = 6')
        conn.commit()
        current_version = 6
        print("Migration 6 applied.")

    # --- Migration 7: Add custom_instructions to users table ---
    if current_version < 7:
        print("Applying migration 7...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN custom_instructions TEXT")
            print("  - Added 'custom_instructions' to 'users' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e): print("  - Column 'custom_instructions' already exists, skipping.")
            else: raise e
        
        cursor.execute('PRAGMA user_version = 7')
        conn.commit()
        current_version = 7
        print("Migration 7 applied.")

    # --- Migration 5: Add likes, comments, and user bio ---
    if current_version < 5:
        print("Applying migration 5...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN bio TEXT")
            print("  - Added 'bio' to 'users' table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e): print("  - Column 'bio' already exists, skipping.")
            else: raise e
        
        try:
            cursor.execute("""
            CREATE TABLE likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_db_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_db_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE (project_db_id, user_id)
            )""")
            print("  - Created 'likes' table.")
        except sqlite3.OperationalError as e:
            if "table likes already exists" in str(e): print("  - Table 'likes' already exists, skipping.")
            else: raise e

        try:
            cursor.execute("""
            CREATE TABLE comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_db_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_db_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )""")
            print("  - Created 'comments' table.")
        except sqlite3.OperationalError as e:
            if "table comments already exists" in str(e): print("  - Table 'comments' already exists, skipping.")
            else: raise e

        cursor.execute('PRAGMA user_version = 5')
        conn.commit()
        current_version = 5
        print("Migration 5 applied.")


    # --- Migration 8: Ensure 'databases' table exists for SQLite-backed DB feature ---
    if current_version < 8:
        print("Applying migration 8...")
        try:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS databases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner TEXT NOT NULL,
                public_write INTEGER DEFAULT 0,
                file_path TEXT NOT NULL,
                created_at INTEGER
            )
            """)
            print("  - Ensured 'databases' table exists.")
        except sqlite3.OperationalError as e:
            print(f"  - Could not create 'databases' table: {e}")
            # If creation fails for another reason, continue to close the connection and surface logs.
        cursor.execute('PRAGMA user_version = 8')
        conn.commit()
        current_version = 8
        print("Migration 8 applied.")

    conn.close()
    print("Migrations check complete.")


# --- Database Initialization ---
def init_db_command():
    DATABASE = 'database.db'
    if os.path.exists(DATABASE):
        print("Database already exists.")
        return
        
    schema_sql = """
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        profile_project_slug TEXT DEFAULT 'profile',
        homepage_project_slug TEXT,
        avatar_url TEXT DEFAULT '/default.webp',
        bio TEXT,
        discord_id TEXT UNIQUE,
        custom_instructions TEXT
    );
    DROP TABLE IF EXISTS projects;
    CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id_str TEXT NOT NULL,
        slug TEXT NOT NULL,
        project_data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE (user_id, slug),
        UNIQUE (user_id, project_id_str)
    );
    DROP TABLE IF EXISTS likes;
    CREATE TABLE likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_db_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_db_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE (project_db_id, user_id)
    );
    DROP TABLE IF EXISTS comments;
    CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_db_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_db_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    -- New DB Tables for SQLite-backed simple databases
    DROP TABLE IF EXISTS databases;
    CREATE TABLE databases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        public_write INTEGER DEFAULT 0,
        file_path TEXT NOT NULL,
        created_at INTEGER
    );

    /* Per-database rows are stored inside each database file under uploads/dbs/<db_id>.db.
       The global 'db_rows' table is no longer used; row management happens per-file. */
    """
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.executescript(schema_sql)
    
    # Set the DB version to the latest version after initializing
    cursor.execute('PRAGMA user_version = 7')
    conn.commit()
    
    # Create netsim system user and default homepage
    netsim_username = 'netsim'
    netsim_password = os.environ.get('NETSIM_PASSWORD')
    if netsim_password:
        netsim_password_hash = generate_password_hash(netsim_password)
        print(f"Set password for '{netsim_username}' user from NETSIM_PASSWORD environment variable.")
    else:
        random_password = secrets.token_hex(16)
        netsim_password_hash = generate_password_hash(random_password)
        print(f"Generated random password for '{netsim_username}' user. To set a password, use the NETSIM_PASSWORD environment variable.")

    cursor.execute('INSERT INTO users (username, password_hash, bio) VALUES (?, ?, ?)', (netsim_username, netsim_password_hash, 'The official account for the netsim platform.'))
    netsim_user_id = cursor.lastrowid

    home_project_slug = 'home'
    home_project_title = 'netsim'
    project_id = str(int(time.time() * 1000))
    initial_version_id = f"v_{project_id}"
    
    default_home_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discover Projects</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body {
      background-color: #0e0e10;
      color: #d4d4d8;
      font-family: 'DM Sans', sans-serif;
      margin: 0;
    }

    .project-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .project-card:hover {
      transform: translateY(-5px);
      border-color: #71717a;
      box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.4);
    }

    .project-thumbnail {
      width: 100%;
      height: 180px;
      object-fit: cover;
      background: #18181b;
      display: block;
      border-bottom: 1px solid #27272a;
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .project-card-skeleton {
        background-color: #18181b;
        border: 1px solid #27272a;
        border-radius: 0.5rem;
        overflow: hidden;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    /* Hide default search input cancel button */
    input[type="search"]::-webkit-search-cancel-button {
      -webkit-appearance: none;
      appearance: none;
    }

    .preview-skeleton {
        height: 180px;
        background-color: #27272a;
    }

    @keyframes pulse {
        50% {
            opacity: .5;
        }
    }
  </style>
</head>
<body class="min-h-screen">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header Section -->
    <header class="flex items-center justify-between py-6 border-b border-zinc-800 mb-8 gap-4">
        <div class="flex items-center flex-shrink-0">
            <a href="/" aria-label="Homepage">
                <img src="https://netsim.us.to/netsimlogobigger.png" alt="netsim logo" class="h-7">
            </a>
        </div>
        <div class="flex-1 max-w-lg">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i data-lucide="search" class="w-4 h-4 text-zinc-500"></i>
                </div>
                <input id="search-input" type="search" placeholder="Search..." class="w-full bg-zinc-900 border border-zinc-700/80 rounded-md py-2 pl-9 pr-10 text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
                <button id="search-clear" class="absolute inset-y-0 right-0 pr-3 flex items-center hidden" aria-label="Clear search">
                    <i data-lucide="x" class="w-4 h-4 text-zinc-500 hover:text-zinc-300"></i>
                </button>
            </div>
        </div>
        <div class="flex items-center gap-4">
            <a href="https://netsim.us.to/discord" target="_blank" class="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 font-semibold text-sm py-2 px-4 rounded-md transition-colors">
                <i data-lucide="message-circle" class="w-4 h-4"></i>
                <span>Join the discord</span>
            </a>
        </div>
    </header>

    <!-- Projects Grid -->
    <main id="projects-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-12">
      <!-- Loading skeleton -->
      <div class="project-card-skeleton">
        <div class="preview-skeleton"></div>
        <div class="p-4 border-t border-zinc-800">
          <div class="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
      <div class="project-card-skeleton">
        <div class="preview-skeleton"></div>
        <div class="p-4 border-t border-zinc-800">
          <div class="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
      <div class="project-card-skeleton">
        <div class="preview-skeleton"></div>
        <div class="p-4 border-t border-zinc-800">
          <div class="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
      <div class="project-card-skeleton">
        <div class="preview-skeleton"></div>
        <div class="p-4 border-t border-zinc-800">
          <div class="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
    </main>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Initial icon creation is moved to the HTML to avoid a flash of unstyled icons.
      
      const projectsGrid = document.getElementById('projects-grid');
      const searchInput = document.getElementById('search-input');
      const searchClearBtn = document.getElementById('search-clear');
      let allProjects = [];

      // Search and clear functionality
      if (searchInput && searchClearBtn) {
        searchInput.addEventListener('input', () => {
          const hasValue = searchInput.value.trim() !== '';
          searchClearBtn.classList.toggle('hidden', !hasValue);
          filterProjects(searchInput.value);
        });

        searchClearBtn.addEventListener('click', () => {
          searchInput.value = '';
          searchClearBtn.classList.add('hidden');
          filterProjects('');
          searchInput.focus();
        });
      }

      async function fetchPublicProjects() {
        try {
          const response = await fetch(`/api/v1/projects/public`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          if (data.success && data.projects) {
            allProjects = data.projects;
            return allProjects;
          } else {
            showError(data.message || 'Could not load projects.');
            return [];
          }
        } catch (error) {
          console.error('Error fetching projects:', error);
          showError('Failed to fetch projects. The server might be down.');
          return [];
        }
      }

      function filterProjects(query) {
        const lowerCaseQuery = query.toLowerCase().trim();
        if (!lowerCaseQuery) {
          displayProjects(allProjects);
          return;
        }

        const filtered = allProjects.filter(project => {
          const title = (project.title || '').toLowerCase();
          const description = (project.description || '').toLowerCase();
          const username = (project.username || '').toLowerCase();
          return title.includes(lowerCaseQuery) || description.includes(lowerCaseQuery) || username.includes(lowerCaseQuery);
        });
        
        displayProjects(filtered);
      }

      function displayProjects(projects) {
        projectsGrid.innerHTML = ''; // Clear skeleton loaders or previous results

        if (projects.length === 0) {
          projectsGrid.innerHTML = `
            <div class="col-span-full text-center text-zinc-500 py-8">
              No projects found.
            </div>`;
          return;
        }

        projects.forEach(project => {
          // Don't show profile pages on the homepage
          if (project.slug === 'profile') return;

          const projectUrl = `/@${project.username}/${project.slug}`;
          const title = project.title || "Untitled Project";
          const description = project.description || "No description available.";
          const likes = project.likes || 0;
          const thumbnail = project.thumbnail_url || `https://netsim-img.ext.io/@${project.username}/${project.slug}`;

          const card = document.createElement('a');
          card.href = projectUrl;
          card.className = 'project-card bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700';
          card.target = '_top';
          card.setAttribute('aria-label', `View project: ${title}`);

          card.innerHTML = `
            <div class="relative overflow-hidden">
                <img class="project-thumbnail" src="${thumbnail}" alt="${title}" loading="lazy">
                <div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors"></div>
            </div>
            <div class="p-4 flex-1 flex flex-col">
              <h3 class="text-lg font-semibold text-zinc-100 truncate mb-1">${title}</h3>
              <p class="text-sm text-zinc-400 line-clamp-2 flex-1">${description}</p>
              <div class="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span class="hover:text-zinc-300 transition-colors">by @${project.username}</span>
                <div class="flex items-center gap-1">
                    <i data-lucide="heart" class="w-3.5 h-3.5"></i>
                    <span>${likes}</span>
                </div>
              </div>
            </div>
          `;

          projectsGrid.appendChild(card);
        });

        lucide.createIcons();
      }

      function showError(message) {
        projectsGrid.innerHTML = `
          <div class="col-span-full text-center text-red-400 py-8">
            <i data-lucide="alert-triangle" class="inline-block w-6 h-6 mb-2"></i>
            <p>${message}</p>
          </div>`;
        lucide.createIcons();
      }

      fetchPublicProjects().then(displayProjects);
    });
  </script>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>"""

    default_home_project = {
        "id": project_id,
        "title": home_project_title,
        "slug": home_project_slug,
        "description": "The public homepage for netsim, showcasing public projects.",
        "currentVersionId": initial_version_id,
        "pinnedVersionId": initial_version_id,
        "versions": {
            initial_version_id: {
                "id": initial_version_id,
                "prompt": "A discovery page for netsim that shows a grid of public projects created by users.",
                "html": default_home_html,
                "css": "",
                "js": ""
            }
        }
    }
    cursor.execute('INSERT INTO projects (user_id, project_id_str, slug, project_data) VALUES (?, ?, ?, ?)',
               (netsim_user_id, project_id, home_project_slug, json.dumps(default_home_project)))

    conn.commit()
    conn.close()
    print("Initialized the database.")

if __name__ == '__main__':
    init_db_command()
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000, use_reloader=False)
