document.addEventListener('DOMContentLoaded', async () => {
  App.ensureAuth();
  App.renderUserUi();
  const projects = await App.api('/projects');
  const tasks = await App.api('/tasks');
  document.getElementById('stat-projects').textContent = projects.length;
  document.getElementById('stat-tasks').textContent = tasks.length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  document.getElementById('stat-todo').textContent = todo;
});





