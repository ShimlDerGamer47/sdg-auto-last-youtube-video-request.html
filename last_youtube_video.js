document.addEventListener("DOMContentLoaded", () => {
  try {
    const html = document.documentElement;
    const fontFamilyVar = "--font-family";
    const robotoBold = getComputedStyle(html)
      .getPropertyValue(fontFamilyVar)
      .trim();
    const body = document.body;
    if (robotoBold) body.style.fontFamily = robotoBold;

    function createPlayerContainer() {
      const div = document.createElement("div");
      div.id = "youtubePlayerApiContainerId";
      div.classList.add("youtube-video-embed-container");

      if (robotoBold) {
        Object.assign(div.style, {
          fontFamily: robotoBold,
          background: "rgba(0,0,0,0)",
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        });
      }

      body.appendChild(div);
      return div;
    }

    const params = new URLSearchParams(window.location.search);
    const videoId = (params.get("videoId") || "").trim();
    if (!videoId) {
      console.warn("Keine 'videoId' Parameter in der URL gefunden.");
      return;
    }

    const container = createPlayerContainer();

    let autoplay = false;
    let muted = false;
    let controls = true;
    let loop = false;
    let start = 0;
    let end = 0;

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

    if (end > 0 && end <= start) {
      console.warn("'end' muss größer als 'start' sein. 'end' wird ignoriert.");
      end = 0;
    }

    if (autoplay && !muted) {
      console.warn(
        "Autoplay mit Ton wird von vielen Browsern blockiert. 'muted' wird auf true gesetzt (für Autoplay)."
      );
      muted = true;
    }

    let player = null;
    let endTimer = null;

    function initPlayer() {
      const playerVars = {
        playsinline: 1,
        rel: 0,
        controls: controls ? 1 : 0,
        autoplay: autoplay ? 1 : 0,
        start: start > 0 ? start : undefined,
        loop: !end && loop ? 1 : 0,
        playlist: !end && loop ? videoId : undefined,
        modestbranding: 1,
      };

      player = new YT.Player("youtubePlayerApiContainerId", {
        width: 1920,
        height: 1080,
        videoId: videoId,
        playerVars: playerVars,
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: (e) => console.error("YT Player Fehler:", e),
        },
      });
    }

    function onPlayerReady(event) {
      if (!player) return;

      if (muted) player.unMute();
      else player.mute();

      if (start > 0) {
        try {
          player.seekTo(start, true);
        } catch (e) {}
      }

      if (autoplay) {
        try {
          event.target.playVideo();
        } catch (err) {
          console.warn("Autoplay wurde möglicherweise blockiert:", err);
        }
      }
    }

    function clearEndTimer() {
      if (endTimer) {
        clearTimeout(endTimer);
        endTimer = null;
      }
    }

    function onPlayerStateChange(e) {
      if (!player) return;
      const YTState =
        window.YT && window.YT.PlayerState ? window.YT.PlayerState : null;

      if (YTState && e.data === YTState.PLAYING) {
        clearEndTimer();
        if (end > 0) {
          const current = player.getCurrentTime ? player.getCurrentTime() : 0;
          const remaining = Math.max(0, end - current);

          endTimer = setTimeout(() => {
            if (!player) return;

            if (loop) {
              player.seekTo(start > 0 ? start : 0, true);
              player.playVideo();
            } else {
              try {
                player.pauseVideo();
              } catch (e) {}
            }
          }, Math.ceil(remaining * 1000));
        }
      } else {
        if (
          YTState &&
          (e.data === YTState.PAUSED ||
            e.data === YTState.BUFFERING ||
            e.data === YTState.ENDED)
        ) {
          clearEndTimer();
        }

        if (YTState && e.data === YTState.ENDED && end === 0 && loop) {
          try {
            player.seekTo(start > 0 ? start : 0, true);
            player.playVideo();
          } catch (err) {}
        }
      }
    }

    function loadYouTubeIframeAPI() {
      if (window.YT && window.YT.Player) {
        initPlayer();

        return;
      }

      const tag = document.createElement("script");
      tag.async = true;
      tag.defer = true;
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = function () {
        try {
          initPlayer();
        } catch (err) {
          console.error("Fehler beim Initialisieren des YouTube Players:", err);
        }
      };

      setTimeout(() => {
        if (!window.YT || !window.YT.Player) {
          console.error(
            "YouTube IFrame API konnte nicht geladen werden (Timeout)."
          );
        }
      }, 10000);
    }

    function securityToken() {
      [body, container].forEach((element) => {
        if (!element) return;

        ["copy", "dragstart", "keydown", "selectstart"].forEach((event) => {
          element.addEventListener(event, (e) => e.preventDefault());
        });

        element.style.webkitUserSelect = "none";
        element.style.userSelect = "none";
      });
    }
    securityToken();

    loadYouTubeIframeAPI();
  } catch (error) {
    console.error("Error:", error);
  }
});
