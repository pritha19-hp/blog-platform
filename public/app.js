let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let token = localStorage.getItem('token') || null;
let isRegisterMode = false;
let currentPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  fetchPosts();
});

function showAlert(message, type = 'success') {
  const alertBox = document.getElementById('alertBox');
  if (!alertBox) return;
  alertBox.className = `alert alert-${type}`;
  alertBox.innerText = message;
  alertBox.classList.remove('hidden');
  setTimeout(() => alertBox.classList.add('hidden'), 4000);
}

function renderNav() {
  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;

  if (currentUser) {
    navLinks.innerHTML = `
      <span>Welcome, <strong>${escapeHtml(currentUser.username)}</strong></span>
      <button class="btn btn-primary" onclick="showCreatePost()">+ New Post</button>
      <button class="btn btn-secondary" onclick="handleLogout()">Logout</button>
    `;
  } else {
    navLinks.innerHTML = `
      <button class="btn btn-primary" onclick="openAuthModal(false)">Login</button>
      <button class="btn btn-secondary" onclick="openAuthModal(true)">Register</button>
    `;
  }
}

function showHome() {
  document.getElementById('homeView')?.classList.remove('hidden');
  document.getElementById('createPostView')?.classList.add('hidden');
  document.getElementById('postDetailView')?.classList.add('hidden');
  fetchPosts();
}

function showCreatePost() {
  if (!currentUser) return openAuthModal(false);
  document.getElementById('homeView')?.classList.add('hidden');
  document.getElementById('createPostView')?.classList.remove('hidden');
  document.getElementById('postDetailView')?.classList.add('hidden');
}

function showPostDetail(id) {
  currentPostId = id;
  document.getElementById('homeView')?.classList.add('hidden');
  document.getElementById('createPostView')?.classList.add('hidden');
  document.getElementById('postDetailView')?.classList.remove('hidden');
  fetchSinglePost(id);
}

async function fetchPosts() {
  const list = document.getElementById('postsList');
  if (!list) return;

  try {
    const res = await fetch('/api/posts');
    const posts = await res.json();

    if (posts.length === 0) {
      list.innerHTML = '<p>No blog posts found. Be the first to publish one!</p>';
      return;
    }

    list.innerHTML = posts.map(post => `
      <div class="post-card">
        <h3 onclick="showPostDetail(${post.id})">${escapeHtml(post.title)}</h3>
        <div class="post-meta">By ${escapeHtml(post.author_name)} on ${new Date(post.created_at).toLocaleDateString()}</div>
        <p>${escapeHtml(post.content.substring(0, 150))}${post.content.length > 150 ? '...' : ''}</p>
        <br>
        <button class="btn btn-secondary" onclick="showPostDetail(${post.id})">Read More & Comments</button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p>Error loading blog posts. Make sure the backend server is running.</p>';
  }
}

async function fetchSinglePost(id) {
  const detail = document.getElementById('postDetail');
  const commentFormContainer = document.getElementById('commentFormContainer');
  const commentsList = document.getElementById('commentsList');

  try {
    const res = await fetch(`/api/posts/${id}`);
    const post = await res.json();
    const isAuthor = currentUser && currentUser.id === post.author_id;

    detail.innerHTML = `
      <h2>${escapeHtml(post.title)}</h2>
      <div class="post-meta">Published by ${escapeHtml(post.author_name)} on ${new Date(post.created_at).toLocaleString()}</div>
      <div class="post-content" style="white-space: pre-wrap;">${escapeHtml(post.content)}</div>
      ${isAuthor ? `<br><button class="btn btn-danger" onclick="deletePost(${post.id})">Delete Post</button>` : ''}
    `;

    if (currentUser) {
      commentFormContainer.innerHTML = `
        <form onsubmit="handleAddComment(event)" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <textarea id="commentInput" rows="3" required placeholder="Write a comment..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit Comment</button>
        </form>
      `;
    } else {
      commentFormContainer.innerHTML = '<p><em>Please <a href="#" onclick="openAuthModal(false)">login</a> to post a comment.</em></p><br>';
    }

    if (!post.comments || post.comments.length === 0) {
      commentsList.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
    } else {
      commentsList.innerHTML = post.comments.map(c => `
        <div class="comment-card">
          <div class="comment-author">${escapeHtml(c.author_name)} <span style="font-weight:normal; font-size:0.8rem; color:#64748b;">• ${new Date(c.created_at).toLocaleString()}</span></div>
          <p>${escapeHtml(c.content)}</p>
        </div>
      `).join('');
    }
  } catch (err) {
    detail.innerHTML = '<p>Error loading post details.</p>';
  }
}

async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById('postTitle').value;
  const content = document.getElementById('postContent').value;

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, content })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create post');

    showAlert('Post created successfully!');
    document.getElementById('createPostForm').reset();
    showHome();
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function deletePost(id) {
  if (!confirm('Are you sure you want to delete this post?')) return;

  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete post');

    showAlert('Post deleted successfully.');
    showHome();
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function handleAddComment(e) {
  e.preventDefault();
  const content = document.getElementById('commentInput').value;

  try {
    const res = await fetch(`/api/posts/${currentPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add comment');

    fetchSinglePost(currentPostId);
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function openAuthModal(isRegister) {
  isRegisterMode = isRegister;
  document.getElementById('authModal')?.classList.remove('hidden');
  document.getElementById('usernameGroup').style.display = isRegister ? 'block' : 'none';
  document.getElementById('modalTitle').innerText = isRegister ? 'Register Account' : 'Login';
  document.getElementById('authSubmitBtn').innerText = isRegister ? 'Register' : 'Login';
  document.getElementById('authToggleText').innerText = isRegister ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('authToggleLink').innerText = isRegister ? 'Login here' : 'Register here';
}

function closeAuthModal() {
  document.getElementById('authModal')?.classList.add('hidden');
}

function toggleAuthMode(e) {
  e.preventDefault();
  openAuthModal(!isRegisterMode);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const username = document.getElementById('authUsername').value;

  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const body = isRegisterMode ? { username, email, password } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    if (isRegisterMode) {
      showAlert('Registration successful! Please login.');
      openAuthModal(false);
    } else {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      closeAuthModal();
      renderNav();
      showAlert(`Welcome back, ${currentUser.username}!`);
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function handleLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  renderNav();
  showAlert('Logged out successfully.');
  showHome();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}