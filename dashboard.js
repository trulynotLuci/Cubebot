// =============================================
//  CUBEBOT — dashboard.js
//  ESP32 and Web count independently in sync
// =============================================

// Wait for Supabase
(function waitForSupabase() {
  if (typeof window.supabaseClient === 'undefined') {
    setTimeout(waitForSupabase, 100);
    return;
  }
  initDashboard();
})();

async function initDashboard() {
  try {
    const { data: { user }, error } = await window.supabaseClient.auth.getUser();
    if (error || !user) { window.location.href = 'loginpage.html'; return; }

    const username = user.user_metadata?.username ||
                     user.user_metadata?.full_name ||
                     user.email.split('@')[0];

    setText('welcome-username', username);
    setText('account-username', username);
    setText('account-email', user.email);
    const sw = document.querySelector('#welcome-user');
    if (sw) sw.innerHTML = `Hello, ${username}`;

  } catch (e) {
    window.location.href = 'loginpage.html';
  }

  loadSavedIP();
  initNavigation();
  startStatusPoll();
  startSoundMonitor();
  startAlarmCountdownUpdater();
  startTouchMonitor();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setFeedback(id, msg, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = color || '#38a169';
}

function getSavedIP() {
  const el = document.getElementById('ip-input');
  const val = el ? el.value.trim() : '';
  if (val) { localStorage.setItem('cubebot_ip', val); return val; }
  return localStorage.getItem('cubebot_ip') || '';
}

function loadSavedIP() {
  const saved = localStorage.getItem('cubebot_ip');
  if (saved) {
    const el = document.getElementById('ip-input');
    if (el) el.value = saved;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const ipInput = document.getElementById('ip-input');
  if (ipInput) {
    ipInput.addEventListener('input', function () {
      if (this.value.trim()) localStorage.setItem('cubebot_ip', this.value.trim());
    });
  }
});

function sendToESP32(path, onSuccess, onFail) {
  const ip = getSavedIP();
  if (!ip) {
    if (onFail) onFail('No IP saved. Enter it in the Connect section first.');
    return;
  }
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `http://${ip}${path}`, true);
  xhr.timeout = 4000;
  xhr.onload    = function () { if (onSuccess) onSuccess(xhr.responseText); };
  xhr.onerror   = function () { if (onFail) onFail('Connection failed. Check IP.'); };
  xhr.ontimeout = function () { if (onFail) onFail('Timeout. Check connection.'); };
  xhr.send();
}

function testConnection() {
  const ip = getSavedIP();
  if (!ip) {
    setFeedback('connect-status', 'Please enter an IP address.', '#e53e3e');
    return;
  }
  setFeedback('connect-status', 'Testing connection...', '#4299e1');
  sendToESP32('/',
    function () {
      setFeedback('connect-status', 'Connected! CubeBot is online.', '#38a169');
      pollStatus();
    },
    function (msg) { setFeedback('connect-status', `Failed: ${msg}`, '#e53e3e'); }
  );
}

// BeatSync - Audio Visualization
let soundMonitorInterval = null;

function startSoundMonitor() {
  if (soundMonitorInterval) clearInterval(soundMonitorInterval);
  soundMonitorInterval = setInterval(fetchSoundLevel, 200);
}

function fetchSoundLevel() {
  if (!getSavedIP()) return;
  
  sendToESP32('/mic',
    function (response) {
      try {
        const data = JSON.parse(response);
        updateSoundVisualizer(data.level, data.max || 4095);
      } catch (e) { }
    },
    null
  );
}

function updateSoundVisualizer(level, maxLevel) {
  const visualizer = document.getElementById('beatsync-visualizer');
  const levelText = document.getElementById('sound-level');
  const waveBars = document.querySelectorAll('.wave-bar');
  
  if (!visualizer) return;
  
  const percentage = (level / maxLevel) * 100;
  const normalizedLevel = Math.min(100, Math.max(0, percentage));
  
  if (levelText) {
    levelText.textContent = `${Math.round(normalizedLevel)}%`;
    levelText.style.color = getSoundColor(normalizedLevel);
  }
  
  if (waveBars.length > 0) {
    waveBars.forEach((bar, index) => {
      const variation = Math.sin(Date.now() / 200 + index) * 0.3 + 0.7;
      const height = Math.max(4, (normalizedLevel / 100) * 40 * variation);
      bar.style.height = `${height}px`;
      bar.style.backgroundColor = getSoundColor(normalizedLevel);
    });
  }
  
  const intensity = normalizedLevel / 100;
  visualizer.style.opacity = 0.3 + (intensity * 0.5);
}

function getSoundColor(percentage) {
  if (percentage < 30) return '#4a90e2';
  if (percentage < 60) return '#38a169';
  if (percentage < 85) return '#ed8936';
  return '#e53e3e';
}

function toggleBeatSync() {
  const btn = document.getElementById('beatsync-toggle');
  const isActive = btn?.classList.contains('active');
  
  if (isActive) {
    sendMode(0);
    btn.classList.remove('active');
    btn.textContent = 'Activate BeatSync';
    setFeedback('beatsync-status', 'BeatSync deactivated', '#666666');
    stopBeatSyncVisualizer();
  } else {
    sendToESP32('/setMode?m=18',
      function () {
        btn.classList.add('active');
        btn.textContent = 'BeatSync Active';
        setFeedback('beatsync-status', 'BeatSync activated! CubeBot is listening to music!', '#38a169');
        startBeatSyncVisualizer();
      },
      function (msg) { 
        setFeedback('beatsync-status', `Failed to activate: ${msg}`, '#e53e3e');
      }
    );
  }
}

function startBeatSyncVisualizer() {
  const container = document.getElementById('beatsync-visualizer-container');
  if (container) container.style.display = 'block';
}

function stopBeatSyncVisualizer() {
  const container = document.getElementById('beatsync-visualizer-container');
  if (container) container.style.display = 'none';
  const waveBars = document.querySelectorAll('.wave-bar');
  waveBars.forEach(bar => {
    bar.style.height = '4px';
    bar.style.backgroundColor = '#4a90e2';
  });
  const levelText = document.getElementById('sound-level');
  if (levelText) levelText.textContent = '0%';
}

// Status Poll
let statusInterval = null;

function startStatusPoll() {
  pollStatus();
  statusInterval = setInterval(pollStatus, 500);
}

function pollStatus() {
  sendToESP32('/status',
    function (response) {
      try {
        const data = JSON.parse(response);
        setText('status-bot-name', data.name || '—');
        setText('status-bot-mode', getModeLabel(data.mode));
        setText('status-bot-ip',   data.ip   || '—');
        
        const beatsyncBtn = document.getElementById('beatsync-toggle');
        if (beatsyncBtn && data.mode === 18) {
          beatsyncBtn.classList.add('active');
          beatsyncBtn.textContent = 'BeatSync Active';
          startBeatSyncVisualizer();
        } else if (beatsyncBtn && data.mode !== 18) {
          beatsyncBtn.classList.remove('active');
          beatsyncBtn.textContent = 'Activate BeatSync';
          stopBeatSyncVisualizer();
        }
        
      } catch (e) { 
        console.log('Parse error:', e);
      }
    },
    null
  );
}

// Monitor for touch events from ESP32
function startTouchMonitor() {
  setInterval(checkTouchStatus, 1000);
}

function checkTouchStatus() {
  sendToESP32('/status',
    function (response) {
      try {
        const data = JSON.parse(response);
        if (pomodoroActive && data.mode !== 11 && data.mode !== 17 && data.mode !== 0) {
          if (data.mode === 13) { // ALARM_RINGING_MODE
            stopPomodoro();
            setFeedback('pomo-status', '⏸️ Timer interrupted by touch on robot!', '#e53e3e');
          }
        }
      } catch (e) { }
    },
    null
  );
}

const MODE_LABELS = {
  0: 'Awake', 1: 'Sleeping', 3: 'Happy', 4: 'Info', 6: 'Grumpy',
  7: 'Focus', 8: 'Fortune', 9: 'Dance', 10: 'Drama',
  11: 'Pomodoro', 12: 'Weather', 13: 'Alarm Ringing',
  14: 'Confirmation', 15: 'Time & Weather',
  16: 'Alarm Countdown', 17: 'Pomodoro Countdown',
  18: 'BeatSync'
};
function getModeLabel(id) { return MODE_LABELS[id] || `Mode ${id}`; }

function sendMode(modeId) {
  const name = getModeLabel(modeId);
  setFeedback('mode-feedback', `Sending ${name}...`, '#4299e1');
  sendToESP32(`/setMode?m=${modeId}`,
    function () {
      setFeedback('mode-feedback', `${name} mode sent!`, '#38a169');
      setTimeout(() => setFeedback('mode-feedback', ''), 2500);
    },
    function (msg) { setFeedback('mode-feedback', `Failed: ${msg}`, '#e53e3e'); }
  );
}

function sendBotName() {
  const name = document.getElementById('botname-input')?.value.trim();
  if (!name) { setFeedback('botname-feedback', 'Enter a name first.', '#e53e3e'); return; }
  setFeedback('botname-feedback', 'Sending name...', '#4299e1');
  sendToESP32(`/setName?n=${encodeURIComponent(name)}`,
    function () {
      setFeedback('botname-feedback', `Name "${name}" saved to CubeBot!`, '#38a169');
      setTimeout(() => setFeedback('botname-feedback', ''), 2500);
    },
    function (msg) { setFeedback('botname-feedback', `Failed: ${msg}`, '#e53e3e'); }
  );
}

// =============================================
//  POMODORO
// =============================================

let pomodoroInterval = null;
let isBreakTime = false;
let pomodoroStartTime = 0;
let pomodoroRemaining = 0;
let currentWorkDuration = 25;
let currentBreakDuration = 5;
let pomodoroActive = false;
let lastSentRemaining = -1;

function startPomodoro() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  pomodoroActive = true;
  isBreakTime = false;
  lastSentRemaining = -1;
  
  currentWorkDuration = parseInt(document.getElementById('pomo-minutes')?.value) || 25;
  currentBreakDuration = parseInt(document.getElementById('break-minutes')?.value) || 5;
  
  startWorkSession();
}

function startWorkSession() {
  isBreakTime = false;
  
  pomodoroRemaining = currentWorkDuration * 60;
  pomodoroStartTime = Date.now();
  
  updatePomoDisplay(pomodoroRemaining, false);
  setFeedback('pomo-status', `🍅 Work session started! ${currentWorkDuration} minutes focus time.`, '#38a169');
  
  updateESP32Timer(pomodoroRemaining, false);
  
  const pomoDisplay = document.getElementById('pomo-display');
  const pomoBadge = document.getElementById('pomo-status-badge');
  const pomoTime = document.getElementById('pomo-time');
  
  if (pomoDisplay) pomoDisplay.classList.remove('break-mode');
  if (pomoBadge) {
    pomoBadge.textContent = 'Work Time';
    pomoBadge.classList.remove('break');
  }
  if (pomoTime) pomoTime.classList.remove('break');
  
  if (pomodoroInterval) clearInterval(pomodoroInterval);
  pomodoroInterval = setInterval(updatePomodoroCountdown, 1000);
}

function startBreakSession() {
  isBreakTime = true;
  
  pomodoroRemaining = currentBreakDuration * 60;
  pomodoroStartTime = Date.now();
  
  updatePomoDisplay(pomodoroRemaining, true);
  
  setFeedback('pomo-status', `☕ Break time! ${currentBreakDuration} minutes rest.`, '#e53e3e');
  
  updateESP32Timer(pomodoroRemaining, true);
  
  const pomoDisplay = document.getElementById('pomo-display');
  const pomoBadge = document.getElementById('pomo-status-badge');
  const pomoTime = document.getElementById('pomo-time');
  if (pomoDisplay) pomoDisplay.classList.add('break-mode');
  if (pomoBadge) {
    pomoBadge.textContent = 'Break Time';
    pomoBadge.classList.add('break');
  }
  if (pomoTime) pomoTime.classList.add('break');
  
  sendToESP32('/buzz', null, null);
  
  if (pomodoroInterval) clearInterval(pomodoroInterval);
  pomodoroInterval = setInterval(updatePomodoroCountdown, 1000);
}

function updatePomodoroCountdown() {
  if (!pomodoroActive) return;
  
  const now = Date.now();
  const elapsed = Math.floor((now - pomodoroStartTime) / 1000);
  let remaining = pomodoroRemaining - elapsed;
  
  if (remaining <= 0) {
    if (!isBreakTime) {
      startBreakSession();
    } else {
      completePomodoro();
    }
  } else {
    updatePomoDisplay(remaining, isBreakTime);
    updateESP32Timer(remaining, isBreakTime);
  }
}

function updateESP32Timer(remainingSeconds, isBreak) {
  if (remainingSeconds === lastSentRemaining) return;
  lastSentRemaining = remainingSeconds;
  
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  if (isBreak) {
    const breakMsg = `BREAK ${timeStr}`;
    sendToESP32(`/setAlarm?time=${remainingSeconds * 1000}&message=${encodeURIComponent(breakMsg)}`, null, null);
    sendToESP32(`/setMode?m=8`, null, null); 
  } else {
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    sendToESP32(`/setPomodoro?minutes=${remainingMinutes}`, null, null);
  }
}

function updatePomoDisplay(remainingSeconds, isBreak) {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const display = document.getElementById('pomo-time');
  if (display) {
    display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (isBreak) {
      display.style.color = '#e53e3e';
    } else {
      if (remainingSeconds < 60) {
        display.style.color = '#e53e3e';
      } else if (remainingSeconds < 300) {
        display.style.color = '#ed8936';
      } else {
        display.style.color = '#ffffff';
      }
    }
  }
}

function completePomodoro() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  pomodoroActive = false;
  lastSentRemaining = -1;
  
  setFeedback('pomo-status', `🎉 CONGRATULATIONS! Pomodoro session complete! 🎉`, '#38a169');
  
  sendToESP32('/setMode?m=3', null, null); 
  sendToESP32('/resetPomodoro', null, null);
  
  const pomoDisplay = document.getElementById('pomo-display');
  const pomoBadge = document.getElementById('pomo-status-badge');
  
  if (pomoDisplay) pomoDisplay.classList.remove('break-mode');
  if (pomoBadge) {
    pomoBadge.textContent = 'Complete!';
    pomoBadge.classList.remove('break');
  }
  
  sendToESP32('/buzz', null, null);
}

function stopPomodoro() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  pomodoroActive = false;
  isBreakTime = false;
  lastSentRemaining = -1;
  
  sendToESP32('/setMode?m=0', null, null);
  sendToESP32('/resetPomodoro', null, null);
  sendToESP32('/cancelAlarm', null, null);
  
  setFeedback('pomo-status', '⏸️ Timer stopped by user.', '#e53e3e');
  
  const pomoDisplay = document.getElementById('pomo-display');
  const pomoBadge = document.getElementById('pomo-status-badge');
  const pomoTime = document.getElementById('pomo-time');
  
  if (pomoDisplay) pomoDisplay.classList.remove('break-mode');
  if (pomoBadge) {
    pomoBadge.textContent = 'Stopped';
    pomoBadge.classList.remove('break');
  }
  if (pomoTime) {
    pomoTime.textContent = `${String(currentWorkDuration).padStart(2, '0')}:00`;
    pomoTime.classList.remove('break');
    pomoTime.style.color = '#ffffff';
  }
}

function resetPomodoro() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  pomodoroActive = false;
  isBreakTime = false;
  lastSentRemaining = -1;
  currentWorkDuration = parseInt(document.getElementById('pomo-minutes')?.value) || 25;
  
  const mins = currentWorkDuration;
  const display = document.getElementById('pomo-time');
  if (display) {
    display.textContent = `${String(mins).padStart(2, '0')}:00`;
    display.style.color = '#ffffff';
    display.classList.remove('break');
  }
  
  const pomoDisplay = document.getElementById('pomo-display');
  const pomoBadge = document.getElementById('pomo-status-badge');
  
  if (pomoDisplay) pomoDisplay.classList.remove('break-mode');
  if (pomoBadge) {
    pomoBadge.textContent = 'Work Time';
    pomoBadge.classList.remove('break');
  }
  
  sendToESP32('/resetPomodoro', null, null);
  sendToESP32('/setMode?m=0', null, null);
  setFeedback('pomo-status', '🔄 Pomodoro reset.', '#666666');
}

// =============================================
//  MULTIPLE INDEPENDENT ALARMS
// =============================================

let nextAlarmId = 1;
let webAlarms = {};

function addNewAlarmCard() {
  const container = document.getElementById('alarms-container');
  const alarmId = nextAlarmId++;
  
  const alarmCard = document.createElement('div');
  alarmCard.className = 'alarm-card';
  alarmCard.setAttribute('data-alarm-id', alarmId);
  
  alarmCard.innerHTML = `
    <div class="alarm-card-header">
      <h3>Alarm #${alarmId + 1}</h3>
      <button class="delete-alarm-btn" onclick="deleteAlarm(${alarmId})" title="Delete Alarm">✕</button>
    </div>
    <div class="alarm-card-body">
      <div class="alarm-time-field">
        <label>Time</label>
        <input type="time" class="alarm-time" value="07:00" />
      </div>
      <div class="alarm-name-field">
        <label>Name</label>
        <input type="text" class="alarm-name" placeholder="Wake up!" maxlength="25" />
      </div>
      <div class="alarm-countdown">
        <label>Countdown</label>
        <span class="countdown-display">--:--:--</span>
      </div>
      <div class="alarm-actions">
        <button class="set-alarm-btn" onclick="setAlarmFromCard(this)">Set</button>
        <button class="cancel-alarm-btn" onclick="cancelAlarmFromCard(this)">Cancel</button>
      </div>
      <p class="alarm-status-message"></p>
    </div>
  `;
  
  container.appendChild(alarmCard);
  alarmCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteAlarm(alarmId) {
  const alarmCard = document.querySelector(`.alarm-card[data-alarm-id="${alarmId}"]`);
  if (alarmCard) {
    if (webAlarms[alarmId]) {
      if (webAlarms[alarmId].timeout) {
        clearTimeout(webAlarms[alarmId].timeout);
      }
      delete webAlarms[alarmId];
    }
    
    alarmCard.style.transition = 'all 0.2s ease';
    alarmCard.style.opacity = '0';
    alarmCard.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
      alarmCard.remove();
      updateActiveAlarmsList();
    }, 200);
  }
}

function setAlarmFromCard(buttonElement) {
  const alarmCard = buttonElement.closest('.alarm-card');
  const alarmId = parseInt(alarmCard.getAttribute('data-alarm-id'));
  const timeInput = alarmCard.querySelector('.alarm-time').value;
  const nameInput = alarmCard.querySelector('.alarm-name').value.trim() || "Time's up!";
  const statusMsg = alarmCard.querySelector('.alarm-status-message');
  
  if (!timeInput) {
    statusMsg.textContent = 'Pick a time.';
    statusMsg.style.color = '#e53e3e';
    return;
  }
  
  if (!getSavedIP()) {
    statusMsg.textContent = 'No IP saved.';
    statusMsg.style.color = '#e53e3e';
    return;
  }
  
  const now = new Date();
  const [h, m] = timeInput.split(':').map(Number);
  const alarmDate = new Date();
  alarmDate.setHours(h, m, 0, 0);
  if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);
  const offsetMs = alarmDate - now;
  const displayTime = alarmDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  statusMsg.textContent = `Setting for ${displayTime}...`;
  statusMsg.style.color = '#4299e1';
  
  if (webAlarms[alarmId]) {
    if (webAlarms[alarmId].timeout) {
      clearTimeout(webAlarms[alarmId].timeout);
    }
  }
  
  sendToESP32(
    `/setAlarm?time=${offsetMs}&message=${encodeURIComponent(nameInput)}`,
    function () {
      const targetTime = Date.now() + offsetMs;
      
      webAlarms[alarmId] = {
        targetTime: targetTime,
        name: nameInput,
        displayTime: displayTime,
        timeout: setTimeout(function () {
          alert(`🔔 ALARM! ${displayTime}\n${nameInput}`);
          if (webAlarms[alarmId]) {
            delete webAlarms[alarmId];
            const countdownSpan = alarmCard.querySelector('.countdown-display');
            if (countdownSpan) countdownSpan.textContent = '--:--:--';
            updateActiveAlarmsList();
          }
        }, offsetMs)
      };
      
      statusMsg.innerHTML = `Set for ${displayTime} - "${nameInput}"`;
      statusMsg.style.color = '#38a169';
      
      const setBtn = alarmCard.querySelector('.set-alarm-btn');
      const cancelBtn = alarmCard.querySelector('.cancel-alarm-btn');
      setBtn.disabled = true;
      cancelBtn.disabled = false;
      
      const countdownSpan = alarmCard.querySelector('.countdown-display');
      if (countdownSpan) {
        countdownSpan.classList.add('active');
      }
      
      updateActiveAlarmsList();
      
      alarmCard.style.backgroundColor = '#f0fff4';
      setTimeout(() => {
        alarmCard.style.backgroundColor = '';
      }, 300);
    },
    function (msg) {
      statusMsg.textContent = `Failed: ${msg}`;
      statusMsg.style.color = '#e53e3e';
    }
  );
}

function cancelAlarmFromCard(buttonElement) {
  const alarmCard = buttonElement.closest('.alarm-card');
  const alarmId = parseInt(alarmCard.getAttribute('data-alarm-id'));
  const statusMsg = alarmCard.querySelector('.alarm-status-message');
  
  if (webAlarms[alarmId]) {
    if (webAlarms[alarmId].timeout) {
      clearTimeout(webAlarms[alarmId].timeout);
    }
    delete webAlarms[alarmId];
  }
  
  sendToESP32(`/cancelAlarm`, null, null);
  
  statusMsg.textContent = 'Cancelled.';
  statusMsg.style.color = '#666666';
  
  const setBtn = alarmCard.querySelector('.set-alarm-btn');
  const cancelBtn = alarmCard.querySelector('.cancel-alarm-btn');
  setBtn.disabled = false;
  cancelBtn.disabled = true;
  
  const countdownSpan = alarmCard.querySelector('.countdown-display');
  if (countdownSpan) {
    countdownSpan.textContent = '--:--:--';
    countdownSpan.classList.remove('active');
  }
  
  updateActiveAlarmsList();
  
  alarmCard.style.backgroundColor = '#fff5f5';
  setTimeout(() => {
    alarmCard.style.backgroundColor = '';
  }, 300);
}

function startAlarmCountdownUpdater() {
  setInterval(updateAllCountdowns, 1000);
}

function updateAllCountdowns() {
  const now = Date.now();
  
  for (const [alarmId, alarmData] of Object.entries(webAlarms)) {
    const alarmCard = document.querySelector(`.alarm-card[data-alarm-id="${alarmId}"]`);
    if (alarmCard) {
      const countdownSpan = alarmCard.querySelector('.countdown-display');
      if (countdownSpan && alarmData.targetTime) {
        const remainingMs = alarmData.targetTime - now;
        
        if (remainingMs <= 0) {
          countdownSpan.textContent = '00:00:00';
          countdownSpan.style.color = '#e53e3e';
        } else {
          const hours = Math.floor(remainingMs / 3600000);
          const minutes = Math.floor((remainingMs % 3600000) / 60000);
          const seconds = Math.floor((remainingMs % 60000) / 1000);
          
          countdownSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          
          if (remainingMs < 60000) {
            countdownSpan.style.color = '#e53e3e';
          } else if (remainingMs < 300000) {
            countdownSpan.style.color = '#ed8936';
          } else {
            countdownSpan.style.color = '#38a169';
          }
        }
      }
    }
  }
  
  updateActiveAlarmsList();
}

function updateActiveAlarmsList() {
  const activeListContainer = document.getElementById('active-alarms-list');
  if (!activeListContainer) return;
  
  const activeAlarmsArray = Object.entries(webAlarms);
  
  if (activeAlarmsArray.length === 0) {
    activeListContainer.innerHTML = '<p class="no-alarms">No active alarms</p>';
    return;
  }
  
  const now = Date.now();
  let html = '';
  
  for (const [alarmId, alarmData] of activeAlarmsArray) {
    const remainingMs = alarmData.targetTime - now;
    let timeLeft = '';
    let warningClass = '';
    
    if (remainingMs <= 0) {
      timeLeft = '00:00:00';
      warningClass = 'warning';
    } else {
      const hours = Math.floor(remainingMs / 3600000);
      const minutes = Math.floor((remainingMs % 3600000) / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      timeLeft = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      if (remainingMs < 60000) warningClass = 'warning';
    }
    
    html += `
      <div class="active-alarm-item">
        <span class="alarm-name">${escapeHtml(alarmData.name)}</span>
        <span class="alarm-time-left ${warningClass}">${timeLeft}</span>
      </div>
    `;
  }
  
  activeListContainer.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setAlarm() {
  const firstAlarmCard = document.querySelector('.alarm-card');
  if (firstAlarmCard) {
    const setBtn = firstAlarmCard.querySelector('.set-alarm-btn');
    if (setBtn) setAlarmFromCard(setBtn);
  }
}

function cancelAlarm() {
  const firstAlarmCard = document.querySelector('.alarm-card');
  if (firstAlarmCard) {
    const cancelBtn = firstAlarmCard.querySelector('.cancel-alarm-btn');
    if (cancelBtn) cancelAlarmFromCard(cancelBtn);
  }
}

// Navigation
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        target.scrollIntoView({ behavior: 'smooth' });
        const sidebar = document.getElementById('sidebar');
        if (sidebar?.classList.contains('mobile-open')) sidebar.classList.remove('mobile-open');
      }
    });
  });
  window.addEventListener('scroll', updateActiveOnScroll);
  setTimeout(updateActiveOnScroll, 100);
}

function updateActiveOnScroll() {
  const sections = document.querySelectorAll('.dashboard-section');
  const navLinks = document.querySelectorAll('.nav-link');
  let current = '';
  sections.forEach(s => {
    const r = s.getBoundingClientRect();
    if (r.top < window.innerHeight - 100 && r.bottom > 100) current = s.id;
  });
  navLinks.forEach(l => {
    l.classList.remove('active');
    if (l.getAttribute('href').substring(1) === current) l.classList.add('active');
  });
}

function toggleMobileMenu() {
  document.getElementById('sidebar')?.classList.toggle('mobile-open');
}

function closeMobileMenu() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
}

async function logout() {
  try { if (window.supabaseClient) await window.supabaseClient.auth.signOut(); } catch(e){}
  sessionStorage.clear();
  window.location.href = 'loginpage.html';
}

// Exports
window.sendMode         = sendMode;
window.testConnection   = testConnection;
window.sendBotName      = sendBotName;
window.setAlarm         = setAlarm;
window.cancelAlarm      = cancelAlarm;
window.startPomodoro    = startPomodoro;
window.stopPomodoro     = stopPomodoro;
window.resetPomodoro    = resetPomodoro;
window.toggleBeatSync   = toggleBeatSync;
window.addNewAlarmCard  = addNewAlarmCard;
window.deleteAlarm      = deleteAlarm;
window.setAlarmFromCard = setAlarmFromCard;
window.cancelAlarmFromCard = cancelAlarmFromCard;
window.logout           = logout;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu  = closeMobileMenu;