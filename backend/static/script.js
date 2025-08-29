// script.js - integrated: chat + calendar (full) + music + search + settings
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    // Base elements
    const chatDiv = document.getElementById("chat");
    const inputBox = document.getElementById("userMsg");
    const chatContainer = document.getElementById("chat-container");
    const botTyping = document.getElementById("bot-typing");
    const themeToggle = document.getElementById("theme-toggle");
    const sendBtn = document.getElementById("sendBtn");
    const voiceBtn = document.getElementById("voiceBtn");

    // Quick action buttons (the order in HTML)
    const quickButtons = document.querySelectorAll(".quick-actions button");
    const calendarBtn = document.querySelector(".quick-actions button[title='Calendar']");
    const musicBtn = document.querySelector(".quick-actions button[title='Music']");
    const searchBtn = document.querySelector(".quick-actions button[title='Search']");
    const settingsBtn = document.querySelector(".quick-actions button[title='Settings']");

    // Calendar elements
    const calendarModal = document.getElementById("calendarModal");
    const closeCalendar = document.getElementById("closeCalendar");
    const calendarGrid = document.getElementById("calendarGrid");
    const monthYear = document.getElementById("monthYear");
    const prevMonth = document.getElementById("prevMonth");
    const nextMonth = document.getElementById("nextMonth");
    const todayBtn = document.getElementById("todayBtn");
    const pickBtn = document.getElementById("pickBtn");

    // Music elements
    const musicModal = document.getElementById("musicModal");
    const closeMusic = document.getElementById("closeMusic");
    const audioPlayer = document.getElementById("audioPlayer");
    const playPause = document.getElementById("playPause");
    const prevTrack = document.getElementById("prevTrack");
    const nextTrack = document.getElementById("nextTrack");
    const trackFiles = document.getElementById("trackFiles");
    const playlistEl = document.getElementById("playlist");
    const nowPlaying = document.getElementById("nowPlaying");
    const seekBar = document.getElementById("seekBar");
    const curTime = document.getElementById("curTime");
    const durTime = document.getElementById("durTime");
    const volume = document.getElementById("volume");
    const clearPlaylist = document.getElementById("clearPlaylist");

    // Search elements
    const searchModal = document.getElementById("searchModal");
    const closeSearch = document.getElementById("closeSearch");
    const searchInput = document.getElementById("searchInput");
    const searchBot = document.getElementById("searchBot");
    const searchWeb = document.getElementById("searchWeb");

    // Settings elements
    const settingsModal = document.getElementById("settingsModal");
    const closeSettings = document.getElementById("closeSettings");
    const settingsDark = document.getElementById("settingsDark");
    const settingsVoice = document.getElementById("settingsVoice");
    const settingsFont = document.getElementById("settingsFont");
    const clearChat = document.getElementById("clearChat");

    // Minimal safety checks
    if (!chatDiv || !inputBox) {
      console.warn("Essential elements missing.");
      return;
    }

    // ---------- Chat history load ----------
    async function loadHistory() {
      try {
        const res = await fetch("/history");
        if (!res.ok) throw new Error("History load failed");
        const data = await res.json();
        chatDiv.innerHTML = "";
        data.forEach(([user, bot]) => {
          addMessage(user, "user-msg");
          addMessage(bot, "bot-msg");
        });
        scrollChat();
      } catch (err) {
        console.warn("Could not load history:", err);
      }
    }

    function addMessage(msg, className) {
      const div = document.createElement("div");
      div.classList.add(className);
      div.textContent = msg;
      chatDiv.appendChild(div);
      scrollChat();
    }

    function scrollChat() {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // ---------- Send message ----------
    async function sendMsg(msg = null) {
      if (!msg) msg = inputBox.value.trim();
      if (!msg) return;
      inputBox.value = "";

      addMessage(msg, "user-msg");
      botTyping.style.display = "block";

      try {
        const res = await fetch("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        botTyping.style.display = "none";
        const reply = data.reply ?? data.response ?? "No reply";
        addMessage(reply, "bot-msg");

        // speech if enabled
        if (settingsVoice && settingsVoice.checked) {
          try {
            const utt = new SpeechSynthesisUtterance(reply);
            speechSynthesis.speak(utt);
          } catch (e) { console.warn("Speech synth failed:", e); }
        }
      } catch (err) {
        console.error("Error sending message:", err);
        botTyping.style.display = "none";
        addMessage("⚠️ Error sending message", "bot-msg");
      }
    }

    // ---------- Voice recognition ----------
    let recognition = null;
    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        recognition = new SpeechRec();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const voiceText = event.results[0][0].transcript;
          sendMsg(voiceText);
        };
        recognition.onerror = (e) => console.error("Voice recognition error:", e);
      } else {
        console.info("SpeechRecognition not supported");
      }
    } catch (e) {
      console.warn("SpeechRecognition init failed:", e);
      recognition = null;
    }

    function startVoice() {
      if (!settingsVoice || !settingsVoice.checked) {
        alert("Voice input is disabled in settings.");
        return;
      }
      if (!recognition) {
        alert("Speech recognition not supported in this browser.");
        return;
      }
      try { recognition.start(); } catch (e) { console.warn("Recognition start failed:", e); }
    }

    // ---------- Theme toggle ----------
    function updateThemeIcon() {
      const isDark = document.body.classList.contains("dark-mode");
      themeToggle.textContent = isDark ? "☀️" : "🌙";
      if (settingsDark) settingsDark.checked = document.body.classList.contains("dark-mode");
    }
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        updateThemeIcon();
      });
      updateThemeIcon();
    }

    // ---------- Calendar (full month grid) ----------
    let viewDate = new Date(); // current visible month
    function renderCalendar(date) {
      calendarGrid.innerHTML = "";
      const year = date.getFullYear();
      const month = date.getMonth();
      monthYear.textContent = date.toLocaleString(undefined, { month: "long", year: "numeric" });

      // day-of-week headers
      const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      dow.forEach(d => {
        const cell = document.createElement("div");
        cell.className = "dow";
        cell.textContent = d;
        calendarGrid.appendChild(cell);
      });

      // first day of month and number of days
      const first = new Date(year, month, 1);
      const startIndex = first.getDay();
      const numDays = new Date(year, month + 1, 0).getDate();

      // previous month's trailing days (disabled)
      const prevDaysCount = startIndex;
      const prevLast = new Date(year, month, 0).getDate();

      // fill grid: days from previous month (as disabled)
      for (let i = prevLast - prevDaysCount + 1; i <= prevLast; i++) {
        const d = document.createElement("div");
        d.className = "day disabled";
        d.textContent = i;
        calendarGrid.appendChild(d);
      }

      // current month days
      for (let d = 1; d <= numDays; d++) {
        const dayEl = document.createElement("div");
        dayEl.className = "day";
        dayEl.textContent = d;
        const thisDate = new Date(year, month, d);
        const isToday = isSameDay(thisDate, new Date());
        if (isToday) dayEl.classList.add("today");
        dayEl.addEventListener("click", () => {
          // format YYYY-MM-DD to insert into input field
          const y = thisDate.getFullYear();
          const m = String(thisDate.getMonth() + 1).padStart(2, "0");
          const dd = String(thisDate.getDate()).padStart(2, "0");
          inputBox.value = `${y}-${m}-${dd}`;
          inputBox.focus();
          closeModal(calendarModal);
        });
        calendarGrid.appendChild(dayEl);
      }

      // next month's leading days (to fill end of grid) to keep layout consistent
      const totalCells = 7 * Math.ceil((dow.length + prevDaysCount + numDays) / 7);
      const used = dow.length + prevDaysCount + numDays;
      for (let i = 1; i <= (totalCells - used); i++) {
        const d = document.createElement("div");
        d.className = "day disabled";
        d.textContent = i;
        calendarGrid.appendChild(d);
      }
    }

    function isSameDay(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();}

    function openCalendar() {
      calendarModal.classList.remove("hidden");
      calendarModal.setAttribute("aria-hidden", "false");
      renderCalendar(viewDate);
    }
    function closeModal(modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
    if (calendarBtn) calendarBtn.addEventListener("click", openCalendar);
    if (closeCalendar) closeCalendar.addEventListener("click", () => closeModal(calendarModal));
    if (prevMonth) prevMonth.addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(viewDate); });
    if (nextMonth) nextMonth.addEventListener("click", () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(viewDate); });
    if (todayBtn) todayBtn.addEventListener("click", () => { viewDate = new Date(); renderCalendar(viewDate); });
    if (pickBtn) pickBtn.addEventListener("click", () => {
      // if user hasn't selected a day visually, set input to first day of current view
      const y = viewDate.getFullYear();
      const m = String(viewDate.getMonth() + 1).padStart(2,"0");
      const dd = String(1).padStart(2,"0");
      inputBox.value = `${y}-${m}-${dd}`;
      inputBox.focus();
      closeModal(calendarModal);
    });

    // close calendar by clicking outside or escape
    calendarModal.addEventListener("click", (e) => { if (e.target === calendarModal) closeModal(calendarModal); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(calendarModal); });

    // ---------- Music player ----------
    let playlist = [];
    let currentIndex = -1;

    function updatePlaylistUI() {
      playlistEl.innerHTML = "";
      playlist.forEach((item, idx) => {
        const li = document.createElement("li");
        const title = document.createElement("div");
        title.className = "title";
        title.textContent = item.name;
        const actions = document.createElement("div");
        const playBtn = document.createElement("button");
        playBtn.className = "btn small";
        playBtn.textContent = "Play";
        playBtn.addEventListener("click", () => playIndex(idx));
        const rm = document.createElement("button");
        rm.className = "remove";
        rm.title = "Remove";
        rm.textContent = "✖";
        rm.addEventListener("click", () => { playlist.splice(idx,1); if (idx===currentIndex) stopAudio(); if (idx<currentIndex) currentIndex--; updatePlaylistUI(); });
        actions.appendChild(playBtn);
        actions.appendChild(rm);
        li.appendChild(title);
        li.appendChild(actions);
        playlistEl.appendChild(li);
      });
    }

    function playIndex(i) {
      if (i < 0 || i >= playlist.length) return;
      currentIndex = i;
      const src = playlist[i].url;
      audioPlayer.src = src;
      audioPlayer.play().then(() => {
        playPause.textContent = "⏸";
        nowPlaying.textContent = `Playing: ${playlist[i].name}`;
      }).catch(e => { console.warn("Play failed:", e); });
    }

    function stopAudio() {
      audioPlayer.pause();
      audioPlayer.removeAttribute("src");
      audioPlayer.load();
      playPause.textContent = "▶️";
      nowPlaying.textContent = "No track";
      currentIndex = -1;
    }

    playPause.addEventListener("click", () => {
      if (!audioPlayer.src) {
        if (playlist.length > 0) playIndex(0);
        return;
      }
      if (audioPlayer.paused) { audioPlayer.play(); playPause.textContent = "⏸"; }
      else { audioPlayer.pause(); playPause.textContent = "▶️"; }
    });

    prevTrack.addEventListener("click", () => {
      if (playlist.length === 0) return;
      const next = (currentIndex <= 0) ? playlist.length - 1 : currentIndex - 1;
      playIndex(next);
    });
    nextTrack.addEventListener("click", () => {
      if (playlist.length === 0) return;
      const next = (currentIndex >= playlist.length - 1) ? 0 : currentIndex + 1;
      playIndex(next);
    });

    // file input -> create object URLs for playlist
    trackFiles.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach(f => {
        const url = URL.createObjectURL(f);
        playlist.push({ name: f.name, url });
      });
      updatePlaylistUI();
      if (currentIndex === -1 && playlist.length > 0) playIndex(0);
    });

    // audio time/progress
    audioPlayer.addEventListener("timeupdate", () => {
      if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
      const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      seekBar.value = percent;
      curTime.textContent = formatTime(audioPlayer.currentTime);
      durTime.textContent = formatTime(audioPlayer.duration);
    });
    audioPlayer.addEventListener("ended", () => {
      // auto next
      if (playlist.length === 0) return;
      const next = (currentIndex >= playlist.length - 1) ? 0 : currentIndex + 1;
      playIndex(next);
    });

    seekBar.addEventListener("input", (e) => {
      if (!audioPlayer.duration) return;
      const pct = e.target.value;
      audioPlayer.currentTime = (pct / 100) * audioPlayer.duration;
    });

    volume.addEventListener("input", (e) => {
      audioPlayer.volume = parseFloat(e.target.value);
    });

    clearPlaylist.addEventListener("click", () => {
      playlist.forEach(p => URL.revokeObjectURL(p.url));
      playlist = [];
      stopAudio();
      updatePlaylistUI();
    });

    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60).toString().padStart(2, "0");
      return `${m}:${sec}`;
    }

    // open/close music modal
    if (musicBtn) musicBtn.addEventListener("click", () => {
      musicModal.classList.remove("hidden");
      musicModal.setAttribute("aria-hidden", "false");
    });
    if (closeMusic) closeMusic.addEventListener("click", () => closeModal(musicModal));
    musicModal.addEventListener("click", (e) => { if (e.target === musicModal) closeModal(musicModal); });

    // ---------- Search ----------
    if (searchBtn) searchBtn.addEventListener("click", () => {
      searchModal.classList.remove("hidden");
      searchModal.setAttribute("aria-hidden", "false");
      searchInput.focus();
    });
    if (closeSearch) closeSearch.addEventListener("click", () => closeModal(searchModal));
    searchModal.addEventListener("click", (e) => { if (e.target === searchModal) closeModal(searchModal); });

    // Search with bot (POST to /chat)
    searchBot.addEventListener("click", async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      closeModal(searchModal);
      inputBox.value = q;
      sendMsg(q);
    });
    // Open web search
    searchWeb.addEventListener("click", () => {
      const q = encodeURIComponent(searchInput.value.trim() || "");
      if (!q) window.open("https://www.google.com", "_blank");
      else window.open(`https://www.google.com/search?q=${q}`, "_blank");
    });

    // ---------- Settings ----------
    if (settingsBtn) settingsBtn.addEventListener("click", () => {
      settingsModal.classList.remove("hidden");
      settingsModal.setAttribute("aria-hidden", "false");
      // sync UI with current state
      settingsDark.checked = document.body.classList.contains("dark-mode");
      settingsVoice.checked = !!(settingsVoice.checked);
      settingsFont.value = parseInt(window.getComputedStyle(inputBox).fontSize) || 14;
    });
    if (closeSettings) closeSettings.addEventListener("click", () => closeModal(settingsModal));
    settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeModal(settingsModal); });

    settingsDark.addEventListener("change", (e) => {
      document.body.classList.toggle("dark-mode", e.target.checked);
      updateThemeIcon();
    });

    settingsVoice.addEventListener("change", (e) => {
      // toggles the voice capability used by startVoice and sendMsg
      // no other action required here
    });

    settingsFont.addEventListener("input", (e) => {
      const size = e.target.value + "px";
      document.documentElement.style.setProperty("--chat-font-size", size);
      // apply font-size to message area & input
      document.querySelectorAll(".bot-msg, .user-msg").forEach(el => el.style.fontSize = size);
      inputBox.style.fontSize = size;
    });

    // clear chat history (calls backend endpoint)
    clearChat.addEventListener("click", async () => {
      if (!confirm("Clear chat history? This will remove history on the server.")) return;
      try {
        const res = await fetch("/clear-history", { method: "POST" });
        if (!res.ok) throw new Error("Clear failed");
        chatDiv.innerHTML = "";
        alert("Chat history cleared.");
        closeModal(settingsModal);
      } catch (err) {
        console.warn("Clear failed:", err);
        alert("Failed to clear history.");
      }
    });

    // ---------- UI bindings for chat send/voice ----------
    if (sendBtn) sendBtn.addEventListener("click", () => sendMsg());
    if (voiceBtn) voiceBtn.addEventListener("click", () => startVoice());
    inputBox.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMsg(); });

    // ---------- helper: close all modals on ESC ----------
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") {
      [calendarModal, musicModal, searchModal, settingsModal].forEach(m => m && closeModal(m));
    }});

    // initial load
    loadHistory();
  });
})();
