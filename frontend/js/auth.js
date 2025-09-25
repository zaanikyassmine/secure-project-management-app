document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (localStorage.getItem('authToken')) {
    window.location.href = '/dashboard.html';
    return;
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.value, password: form.password.value })
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      window.location.href = '/dashboard.html';
    } catch (err) {
      alert(err?.error || 'Erreur de connexion');
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.value, email: form.email.value, password: form.password.value })
      });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      window.location.href = '/dashboard.html';
    } catch (err) {
      alert(err?.error || "Erreur d'inscription");
    }
  });
});





