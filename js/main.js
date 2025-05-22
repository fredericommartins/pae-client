document.addEventListener('DOMContentLoaded', () => {
  // Navigation toggle for mobile
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('nav-menu--open');
    });
  }

  // Login form submission
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = loginForm.username.value.trim();
      const password = loginForm.password.value.trim();

      if (username && password) {
        // Perform login logic here (e.g., API call)
        console.log('Logging in:', { username, password });
        // Reset form
        loginForm.reset();
      } else {
        alert('Please enter both username and password.');
      }
    });
  }
});
