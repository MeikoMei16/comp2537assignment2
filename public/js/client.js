import 'bootstrap/dist/css/bootstrap.min.css';
import './client.css';

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
    let result;
    const contentType = response.headers.get('content-type');
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
      el.style.color = '';
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('client.js: DOMContentLoaded');
  try {
    const loginForm = document.getElementById('loginForm');
    const createForm = document.getElementById('createForm');
    const errorMessage = document.getElementById('errorMessage');
    const createMessage = document.getElementById('createMessage');
    console.log('Elements found:', { loginForm, createForm, errorMessage, createMessage });

    if (!loginForm) console.error('loginForm not found');
    if (!createForm) console.error('createForm not found');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        resetMessages([errorMessage, createMessage]);

        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;

        if (!username || !password) {
          errorMessage.textContent = 'Username and password are required';
          errorMessage.style.display = 'block';
          return;
        }

        try {
          const { response, result } = await makeApiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
          });

          if (response.ok) {
            console.log('Login successful:', result);

            try {
              const { response: sessionResp, result: sessionResult } = await makeApiRequest('/api/check-session', {
                method: 'GET',
              });

              if (sessionResp.ok && sessionResult.authenticated) {
                console.log('Session confirmed, redirecting');
                window.location.href = result.redirect || '/dashboard.html';
              } else {
                console.error('Session not confirmed after login');
                errorMessage.textContent = 'Login succeeded but session could not be verified. Try again.';
                errorMessage.style.display = 'block';
              }
            } catch (sessionErr) {
              console.error('Error confirming session:', sessionErr);
              errorMessage.textContent = 'Session verification failed. Please try again.';
              errorMessage.style.display = 'block';
            }
          } else {
            errorMessage.textContent = result.message || 'Invalid username or password';
            errorMessage.style.display = 'block';
          }
        } catch (error) {
          errorMessage.textContent = 'An error occurred during login. Please try again.';
          errorMessage.style.display = 'block';
        }
      });
    }

    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Create account form submitted');
        resetMessages([errorMessage, createMessage]);

        const username = document.getElementById('createUsername')?.value;
        const firstName = document.getElementById('createFirstName')?.value;
        const lastName = document.getElementById('createLastName')?.value;
        const email = document.getElementById('createEmail')?.value;
        const password = document.getElementById('createPassword')?.value;

        if (!username || !firstName || !lastName || !email || !password) {
          createMessage.textContent = 'All fields are required';
          createMessage.style.color = 'red';
          createMessage.style.display = 'block';
          return;
        }

        try {
          const { response, result } = await makeApiRequest('/api/create', {
            method: 'POST',
            body: JSON.stringify({ username, firstName, lastName, email, password }),
          });

          if (response.ok) {
            createMessage.textContent = 'Account created successfully! Please log in.';
            createMessage.style.display = 'block';
            createForm.reset();
          } else {
            createMessage.textContent = result.message || 'Account creation failed';
            createMessage.style.color = 'red';
            createMessage.style.display = 'block';
          }
        } catch (error) {
          createMessage.textContent = 'An error occurred. Please try again.';
          createMessage.style.color = 'red';
          createMessage.style.display = 'block';
        }
      });
    }
  } catch (error) {
    console.error('Error in client.js initialization:', error);
  }
});
