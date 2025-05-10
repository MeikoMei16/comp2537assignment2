import 'bootstrap/dist/css/bootstrap.min.css';
import './dashboard.css';

// Utility function for making API requests
const makeApiRequest = async (url, options) => {
  console.log('Making API request to:', url);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });
    console.log('API response status:', response.status, 'Headers:', response.headers.get('Set-Cookie'));
    const contentType = response.headers.get('content-type');
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = { message: await response.text() || 'Unknown error' };
    }
    return { response, result };
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
};

// Utility function to reset messages
const resetMessages = (elements) => {
  elements.forEach((el) => {
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('dashboard.js: DOMContentLoaded');
  try {
    const currentPath = window.location.pathname;
    console.log('Current path:', currentPath);

    const normalizedPath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    const validRoutes = ['/index.html', '/dashboard.html', '/404.html', '', '/'];

    if (!validRoutes.includes(normalizedPath)) {
      console.log('Redirecting to 404.html for invalid path:', normalizedPath);
      window.location.href = '/404.html';
      return;
    }

    if (normalizedPath === '' || normalizedPath === '/') {
      console.log('Redirecting root path to /index.html');
      window.location.href = '/index.html';
      return;
    }

    if (normalizedPath === '/dashboard.html') {
      try {
        const { response, result } = await makeApiRequest('/api/check-session', {
          method: 'GET',
        });

        if (!response.ok || !result.authenticated) {
          console.log('Session invalid, redirecting to /index.html');
          window.location.href = '/index.html';
          return;
        }

        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
          welcomeMessage.textContent = `Welcome, ${result.username}!`;
        } else {
          console.error('welcomeMessage not found');
        }

        const gifPaths = ['/pictures/pepe.gif', '/pictures/theresa.gif', '/pictures/viro.gif'];
        const randomIndex = Math.floor(Math.random() * gifPaths.length);
        const gifImage = document.getElementById('gifImage');
        if (gifImage) {
          gifImage.src = gifPaths[randomIndex];
        } else {
          console.error('gifImage not found');
        }

        const signoutBtn = document.getElementById('signoutBtn');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const createPostForm = document.getElementById('createPostForm');
        console.log('Elements found:', { signoutBtn, errorMessage, successMessage, createPostForm });

        if (!signoutBtn) console.error('signoutBtn not found');
        if (!createPostForm) console.error('createPostForm not found');

        if (signoutBtn) {
          signoutBtn.addEventListener('click', async () => {
            console.log('Signout button clicked');
            resetMessages([errorMessage, successMessage]);
            try {
              const { response, result } = await makeApiRequest('/api/signout', {
                method: 'POST',
              });
              if (response.ok) {
                window.location.href = result.redirect || '/index.html';
              } else {
                errorMessage.textContent = result.message || 'Signout failed';
                errorMessage.style.display = 'block';
              }
            } catch (error) {
              errorMessage.textContent = 'An error occurred during signout.';
              errorMessage.style.display = 'block';
            }
          });
        }

        if (createPostForm) {
          createPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Create post form submitted');
            resetMessages([errorMessage, successMessage]);

            const postText = document.getElementById('postText')?.value;
            if (!postText || postText.length > 100) {
              errorMessage.textContent = 'Post text is required and must be 100 characters or less';
              errorMessage.style.display = 'block';
              return;
            }

            try {
              const { response, result } = await makeApiRequest('/api/create-post', {
                method: 'POST',
                body: JSON.stringify({ post_text: postText }),
              });

              if (response.ok) {
                successMessage.textContent = 'Post created successfully!';
                successMessage.style.display = 'block';
                createPostForm.reset();
              } else {
                errorMessage.textContent = result.message || 'Failed to create post';
                errorMessage.style.display = 'block';
              }
            } catch (error) {
              errorMessage.textContent = 'An error occurred while creating the post.';
              errorMessage.style.display = 'block';
            }
          });
        }
      } catch (error) {
        console.log('Session check failed, redirecting to /index.html');
        window.location.href = '/index.html';
      }
    }
  } catch (error) {
    console.error('Error in dashboard.js initialization:', error);
  }
});