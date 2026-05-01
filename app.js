// =============================================
//  CUBEBOT — app.js (Supabase Version)
//  Works with both local config.js and Vercel env variables
// =============================================

// Wait for Supabase to load
(function initSupabase() {
  // Check if Supabase is loaded
  if (typeof window.supabase === 'undefined') {
    console.log('Waiting for Supabase to load...');
    setTimeout(initSupabase, 100);
    return;
  }
  
  console.log('Supabase loaded, initializing...');
  
  // Get Supabase credentials
  let SUPABASE_URL = null;
  let SUPABASE_ANON_KEY = null;
  
  // For Vercel: The environment variables are injected at build time
  // We need to use a different approach - hardcode or use a config endpoint
  // Since this is client-side JS, we'll use a simple approach:
  
  // Check for window.SUPABASE_CONFIG (from config.js - local development)
  if (typeof window.SUPABASE_CONFIG !== 'undefined') {
    SUPABASE_URL = window.SUPABASE_CONFIG.URL;
    SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.ANON_KEY;
    console.log('Using credentials from config.js');
  }
  
  // For Vercel production, we'll use hardcoded values (these are safe as anon keys)
  // These are your actual Supabase credentials
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    SUPABASE_URL = 'https://vufsqvwjtzadabcsiydv.supabase.co';
    SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1ZnNxdndqdHphZGFiY3NpeWR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTY4OTgsImV4cCI6MjA5MzE5Mjg5OH0.ozHFxSVjczRjiT9Jt61p5CcBr6xAaC_OeWzoRhyFC2U';
    console.log('Using hardcoded credentials for production');
  }

  // Create Supabase client
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client created');
  
  // Continue with initialization
  initApp();
})();

function initApp() {
  // ========== REGISTER LOGIC ==========
  const registerForm = document.getElementById('register-form');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      console.log('Register form submitted');
  
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirm = document.getElementById('reg-confirm').value;
      const errorMsg = document.getElementById('register-error');
      const successMsg = document.getElementById('register-success');
  
      errorMsg.textContent = '';
      successMsg.textContent = '';
  
      if (!username || !email || !password || !confirm) {
        errorMsg.textContent = 'Please fill in all fields.';
        return;
      }
  
      if (password.length < 6) {
        errorMsg.textContent = 'Password must be at least 6 characters.';
        return;
      }
  
      if (password !== confirm) {
        errorMsg.textContent = 'Passwords do not match.';
        return;
      }
  
      try {
        const { data, error } = await window.supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              username: username,
              full_name: username
            }
          }
        });
  
        if (error) throw error;
  
        console.log('Registration successful:', data);
        successMsg.textContent = 'Account created successfully! Redirecting to login...';
        registerForm.reset();
  
        setTimeout(() => {
          window.location.href = 'loginpage.html';
        }, 2000);
  
      } catch (error) {
        errorMsg.textContent = error.message;
        console.error('Registration error:', error);
      }
    });
  }
  
  // ========== LOGIN LOGIC ==========
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      console.log('Login form submitted');
  
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const errorMsg = document.getElementById('login-error');
  
      errorMsg.textContent = '';
  
      if (!email || !password) {
        errorMsg.textContent = 'Please enter your email and password.';
        return;
      }
  
      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });
  
        if (error) throw error;
  
        console.log('Login successful:', data.user.email);
        sessionStorage.setItem('cubebot_logged_in', email);
        sessionStorage.setItem('cubebot_user_id', data.user.id);
  
        window.location.href = 'dashboard.html';
  
      } catch (error) {
        errorMsg.textContent = 'Invalid email or password. Please try again.';
        console.error('Login error:', error);
      }
    });
  }
  
  // ========== CHECK AUTH STATUS ==========
  window.checkAuth = async function() {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
      window.location.href = 'loginpage.html';
    }
    return user;
  };
  
  console.log('✅ App initialized');
}