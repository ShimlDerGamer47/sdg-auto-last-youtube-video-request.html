document.addEventListener("DOMContentLoaded", () => {
  try {
    const html = document.documentElement;
    const fontFamilyVar = "--font-family";
    const robotoBold = getComputedStyle(html)
      .getPropertyValue(fontFamilyVar)
      .trim();
    const body = document.body;
    body.style.fontFamily = robotoBold || "sans-serif";

    const params = new URLSearchParams(window.location.search);
    const channelIdRaw = params.get("channelId");
    if (!channelIdRaw || channelIdRaw.trim() === "") {
      console.warn("Keine 'channelId' Parameter in der URL gefunden.");
      return;
    }

    let autoplay = true;
    let muted = true;
    let controls = false;
    let loop = false;
    let start = null;
    let end = null;

    if (params.has("autoplay")) {
      const v = (params.get("autoplay") || "").toLowerCase();
      autoplay = v === "true" || v === "1";
    }
    if (params.has("muted")) {
      const v = (params.get("muted") || "").toLowerCase();
      muted = v === "true" || v === "1";
    }
    if (params.has("controls")) {
      const v = (params.get("controls") || "").toLowerCase();
      controls = v === "true" || v === "1";
    }
    if (params.has("loop")) {
      const v = (params.get("loop") || "").toLowerCase();
      loop = v === "true" || v === "1";
    }
    if (params.has("start")) {
      const v = parseInt(params.get("start"), 10);
      if (!Number.isNaN(v) && v >= 0) start = v;
    }
    if (params.has("end")) {
      const v = parseInt(params.get("end"), 10);
      if (!Number.isNaN(v) && v > 0) end = v;
    }

    const langParam = params.has("lang") ? params.get("lang").trim() : "de";

    if (autoplay && !muted) {
      console.warn(
        "Autoplay mit Ton wird von vielen Browsern blockiert. 'muted' wird auf true gesetzt."
      );
      muted = true;
    }

    const raw = channelIdRaw.trim();
    const isHandle = raw.startsWith("@");
    const identifier = isHandle ? raw.replace(/^@+/, "") : raw;

    const apiUrl = isHandle
      ? `https://decapi.me/youtube/latest_video?handle=${encodeURIComponent(
          identifier
        )}&lang=${encodeURIComponent(langParam)}`
      : `https://decapi.me/youtube/latest_video?id=${encodeURIComponent(
          identifier
        )}&lang=${encodeURIComponent(langParam)}`;

    const wrapper = document.createElement("div");
    wrapper.className = "last-video";
    Object.assign(wrapper.style, {
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      userSelect: "none",
    });
    body.appendChild(wrapper);

    const playerHost = document.createElement("div");
    const playerId = "yt-player-js";
    playerHost.id = playerId;
    Object.assign(playerHost.style, {
      width: "100%",
      height: "100%",
      pointerEvents: "auto",
    });
    wrapper.appendChild(playerHost);

    ["copy", "dragstart", "select"].forEach((ev) => {
      wrapper.addEventListener(ev, (e) => e.preventDefault());
    });

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            `API-Request fehlgeschlagen mit Status ${res.status}`
          );
        return res.text();
      })
      .then((text) => {
        const regex =
          /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/)|watch\?v=)([A-Za-z0-9_-]{11})/;
        const match = text.match(regex);
        if (!match || !match[1]) {
          console.error("Konnte keine videoId finden in API-Antwort:", text);
          return;
        }
        const videoId = match[1];

        loadYouTubeAPI(() => {
          initPlayer(videoId);
        });
      })
      .catch((err) => {
        console.error("Fehler beim Laden des letzten YouTube-Videos:", err);
      });

    function loadYouTubeAPI(callback) {
      if (window.YT && window.YT.Player) {
        callback();
        return;
      }

      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === "function")
          try {
            prev();
          } catch (e) {
            console.warn(e);
          }
        callback();
      };

      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        )
      ) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        document.head.appendChild(s);
      }
    }

    function initPlayer(videoId) {
      const playerVars = {
        rel: 0,
        modestbranding: 1,
      };

      playerVars.enablejsapi = 1;
      playerVars.autoplay = autoplay ? 1 : 0;
      playerVars.mute = muted ? 1 : 0;
      playerVars.controls = controls ? 1 : 0;

      if (loop) {
        playerVars.loop = 1;
        playerVars.playlist = videoId;
      }

      if (start !== null) playerVars.start = start;
      if (end !== null) playerVars.end = end;

      try {
        if (location && location.origin) {
          playerVars.origin = location.origin;
        }
      } catch (e) {
        // ignore
      }

      const player = new YT.Player(playerId, {
        width: "100%",
        height: "100%",
        videoId: videoId,
        playerVars: playerVars,
        events: {
          onReady: (e) => {
            window._ytPlayer = e.target;
            try {
              if (muted) e.target.mute();
              else e.target.unMute();
            } catch (err) {
              // ignore
            }
            if (autoplay) {
              try {
                e.target.playVideo();
              } catch (err) {
                console.warn("Konnte Video nicht automatisch starten:", err);
              }
            }
          },
          onStateChange: (e) => {
            console.log("YT State:", e.data);
          },
          onError: (e) => {
            console.error("YT Player Fehler:", e);
          },
        },
      });

      return player;
    }
  } catch (error) {
    console.error("Fehler in main script:", error);
  }
});
