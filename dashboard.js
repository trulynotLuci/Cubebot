// =============================================
//  CUBEBOT — dashboard.js
//  Complete Production Version - No Console Warnings
//  Features: Active Highlighter, Mobile Menu, ESP32 Control, Silent XHR
// =============================================

// Wait for Supabase to be ready
(function waitForSupabase() {
  if (typeof window.supabaseClient === 'undefined') {
    console.log('Waiting for supabaseClient...');
    setTimeout(waitForSupabase, 100);
    return;
  }
  
  console.log('✅ supabaseClient ready');
  initDashboard();
})();

async function initDashboard() {
  console.log('Dashboard initializing...');
  
  try {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    
    if (error || !user) {
      window.location.href = 'loginpage.html';
      return;
    }
    
    console.log('✅ User found:', user.email);
    
    let username = user.user_metadata?.username || 
                   user.user_metadata?.full_name || 
                   user.email.split('@')[0];
    
    const welcomeSpan = document.getElementById('welcome-username');
    if (welcomeSpan) welcomeSpan.textContent = username;
    
    const accountUsername = document.getElementById('account-username');
    if (accountUsername) accountUsername.textContent = username;
    
    const accountEmail = document.getElementById('account-email');
    if (accountEmail) accountEmail.textContent = user.email;
    
    const sidebarWelcome = document.querySelector('#welcome-user');
    if (sidebarWelcome) {
      sidebarWelcome.innerHTML = `Hello, ${username}`;
    }
    
  } catch (error) {
    console.error('Error:', error);
    window.location.href = 'loginpage.html';
  }
  
  initNavigation();
  loadSavedIP();
}

// =============================================
//  NAVIGATION (Active Highlighter)
// =============================================

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      
      if (targetSection) {
        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        targetSection.scrollIntoView({ behavior: 'smooth' });
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          sidebar.classList.remove('mobile-open');
        }
      }
    });
  });

  window.addEventListener('scroll', updateActiveOnScroll);
  window.addEventListener('resize', updateActiveOnScroll);
  setTimeout(() => updateActiveOnScroll(), 100);
}

function updateActiveOnScroll() {
  const sections = document.querySelectorAll('.dashboard-section');
  const navLinks = document.querySelectorAll('.nav-link');
  
  let currentSection = '';
  let currentSectionTop = Infinity;
  
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    if (rect.top < viewportHeight - 100 && rect.bottom > 100) {
      if (Math.abs(rect.top) < Math.abs(currentSectionTop)) {
        currentSectionTop = rect.top;
        currentSection = section.getAttribute('id');
      }
    }
  });
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href').substring(1);
    if (href === currentSection) {
      link.classList.add('active');
    }
  });
  
  if (!currentSection && navLinks.length > 0 && window.scrollY < 100) {
    navLinks[0].classList.add('active');
  }
}

// =============================================
//  ESP32 CONNECTION (Silent XMLHttpRequest - No Console Warnings)
// =============================================

function testConnection() {
  const ip = document.getElementById('ip-input').value.trim();
  const status = document.getElementById('connect-status');

  if (!ip) {
    status.textContent = '⚠️ Please enter an IP address.';
    status.style.color = '#e53e3e';
    return;
  }

  status.textContent = '🔍 Testing connection...';
  status.style.color = '#4299e1';
  localStorage.setItem('cubebot_ip', ip);

  const xhr = new XMLHttpRequest();
  xhr.open('GET', `http://${ip}/?t=${Date.now()}`, true);
  xhr.timeout = 3000;
  
  xhr.onload = function() {
    status.textContent = '✅ Connected successfully! You can now control CubeBot.';
    status.style.color = '#38a169';
  };
  
  xhr.onerror = function() {
    status.textContent = '❌ Connection failed. Make sure ESP32 is powered and on the same WiFi.';
    status.style.color = '#e53e3e';
  };
  
  xhr.ontimeout = function() {
    status.textContent = '❌ Connection timeout. Check IP address.';
    status.style.color = '#e53e3e';
  };
  
  xhr.send();
}

// =============================================
//  SEND MODE TO ESP32 (Silent XMLHttpRequest)
// =============================================

function sendMode(modeId) {
  const feedback = document.getElementById('mode-feedback');
  const ip = document.getElementById('ip-input').value.trim();

  if (!ip) {
    feedback.textContent = '⚠️ Please enter ESP32 IP address first.';
    feedback.style.color = '#e53e3e';
    return;
  }

  const modeNames = {
    0: 'Awake', 1: 'Sleep', 3: 'Happy', 4: 'Info', 
    6: 'Grumpy', 7: 'Focus', 8: 'Fortune', 9: 'Dance', 10: 'Drama'
  };
  
  const modeName = modeNames[modeId] || 'Unknown';
  feedback.textContent = `Sending ${modeName} mode...`;
  feedback.style.color = '#4299e1';

  const xhr = new XMLHttpRequest();
  xhr.open('GET', `http://${ip}/setMode?m=${modeId}&t=${Date.now()}`, true);
  xhr.timeout = 2000;
  
  xhr.onload = function() {
    feedback.textContent = `✅ ${modeName} mode sent to CubeBot!`;
    feedback.style.color = '#38a169';
    setTimeout(() => {
      if (feedback.textContent.includes('✅')) feedback.textContent = '';
    }, 2000);
  };
  
  xhr.onerror = function() {
    feedback.textContent = '❌ Failed to connect. Check IP address.';
    feedback.style.color = '#e53e3e';
  };
  
  xhr.ontimeout = function() {
    feedback.textContent = '❌ Timeout. Check connection.';
    feedback.style.color = '#e53e3e';
  };
  
  xhr.send();
}

// =============================================
//  SEND BOT NAME TO ESP32 (Silent XMLHttpRequest)
// =============================================

function sendBotName() {
  const name = document.getElementById('botname-input').value.trim();
  const feedback = document.getElementById('botname-feedback');
  const ip = document.getElementById('ip-input').value.trim();

  if (!ip) {
    feedback.textContent = '⚠️ Please enter ESP32 IP address first.';
    feedback.style.color = '#e53e3e';
    return;
  }

  if (!name) {
    feedback.textContent = '⚠️ Please enter a name.';
    feedback.style.color = '#e53e3e';
    return;
  }

  feedback.textContent = 'Sending name...';
  feedback.style.color = '#4299e1';

  const xhr = new XMLHttpRequest();
  xhr.open('GET', `http://${ip}/setName?n=${encodeURIComponent(name)}&t=${Date.now()}`, true);
  xhr.timeout = 2000;
  
  xhr.onload = function() {
    feedback.textContent = `✅ Name "${name}" saved to CubeBot!`;
    feedback.style.color = '#38a169';
    setTimeout(() => {
      if (feedback.textContent.includes('✅')) feedback.textContent = '';
    }, 2500);
  };
  
  xhr.onerror = function() {
    feedback.textContent = '❌ Failed to send name. Check connection.';
    feedback.style.color = '#e53e3e';
  };
  
  xhr.ontimeout = function() {
    feedback.textContent = '❌ Timeout. Check connection.';
    feedback.style.color = '#e53e3e';
  };
  
  xhr.send();
}

// =============================================
//  ALARM CLOCK
// =============================================

let alarmTimeout = null;

function setAlarm() {
  const timeInput = document.getElementById('alarm-time').value;
  const status = document.getElementById('alarm-status');

  if (!timeInput) {
    status.textContent = '⚠️ Please select a time.';
    status.style.color = '#e53e3e';
    return;
  }

  cancelAlarm();

  const now = new Date();
  const [hours, minutes] = timeInput.split(':').map(Number);
  const alarmTime = new Date();
  alarmTime.setHours(hours, minutes, 0, 0);

  if (alarmTime <= now) {
    alarmTime.setDate(alarmTime.getDate() + 1);
  }

  const delay = alarmTime - now;

  status.textContent = `⏰ Alarm set for ${timeInput}`;
  status.style.color = '#38a169';

  alarmTimeout = setTimeout(() => {
    alert('🔔 Alarm! Time to check on CubeBot!');
    status.textContent = '🔔 Alarm triggered!';
    
    const ip = document.getElementById('ip-input').value.trim();
    if (ip) {
      sendMode(3);
    }
  }, delay);
}

function cancelAlarm() {
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
    alarmTimeout = null;
    const status = document.getElementById('alarm-status');
    status.textContent = '⏰ Alarm cancelled.';
    status.style.color = '#666666';
  }
}

// =============================================
//  POMODORO TIMER
// =============================================

let pomoInterval = null;
let pomoTimeLeft = 25 * 60;

function startPomodoro() {
  const minutes = parseInt(document.getElementById('pomo-minutes').value) || 25;
  const status = document.getElementById('pomo-status');

  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
  }

  pomoTimeLeft = minutes * 60;
  updatePomoDisplay();

  status.textContent = '🍅 Timer running... Focus!';
  status.style.color = '#38a169';

  pomoInterval = setInterval(() => {
    if (pomoTimeLeft > 0) {
      pomoTimeLeft--;
      updatePomoDisplay();
    }

    if (pomoTimeLeft <= 0) {
      clearInterval(pomoInterval);
      pomoInterval = null;
      alert('🍅 Pomodoro complete! Time for a break! 🎉');
      status.textContent = '✅ Complete! Take a break!';
      status.style.color = '#e94560';
      
      const ip = document.getElementById('ip-input').value.trim();
      if (ip) {
        sendMode(9);
      }
    }
  }, 1000);
}

function resetPomodoro() {
  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
  }

  const minutes = parseInt(document.getElementById('pomo-minutes').value) || 25;
  pomoTimeLeft = minutes * 60;
  updatePomoDisplay();
  const status = document.getElementById('pomo-status');
  status.textContent = '🔄 Timer reset.';
  status.style.color = '#666666';
}

function updatePomoDisplay() {
  const mins = Math.floor(pomoTimeLeft / 60);
  const secs = pomoTimeLeft % 60;
  const display = document.getElementById('pomo-time');
  if (display) {
    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    if (pomoTimeLeft < 60) {
      display.style.color = '#e53e3e';
    } else if (pomoTimeLeft < 300) {
      display.style.color = '#ed8936';
    } else {
      display.style.color = '#38a169';
    }
  }
}

// =============================================
//  UTILITIES
// =============================================

function loadSavedIP() {
  const savedIP = localStorage.getItem('cubebot_ip');
  if (savedIP) {
    const ipInput = document.getElementById('ip-input');
    if (ipInput) {
      ipInput.value = savedIP;
    }
  }
}

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
  }
}

async function logout() {
  try {
    if (typeof window.supabaseClient !== 'undefined') {
      await window.supabaseClient.auth.signOut();
    }
    sessionStorage.clear();
    window.location.href = 'loginpage.html';
  } catch (error) {
    window.location.href = 'loginpage.html';
  }
}

// =============================================
//  EXPORT GLOBALS FOR HTML BUTTONS
// =============================================

window.sendMode = sendMode;
window.testConnection = testConnection;
window.sendBotName = sendBotName;
window.setAlarm = setAlarm;
window.cancelAlarm = cancelAlarm;
window.startPomodoro = startPomodoro;
window.resetPomodoro = resetPomodoro;
window.logout = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;

console.log('✅ Dashboard fully loaded - No CORS warnings!');