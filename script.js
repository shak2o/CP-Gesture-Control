const videoElement = document.getElementById('video');
    const canvasElement = document.getElementById('output');
    const canvasCtx = canvasElement.getContext('2d');
    const audio = document.getElementById('audio');
    const heartsContainer = document.getElementById('hearts');

    
    canvasElement.width = 1024;
    canvasElement.height = 576;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8
    });

    // Проверяем палец вверх (кончик выше средней фаланги)
    function isFingerUp(landmarks, tip, dip) {
      return landmarks[tip].y < landmarks[dip].y;
    }
    // Большой палец вверх - упрощённая проверка по x (для правой руки)
    function isThumbUp(landmarks) {
      return landmarks[4].x < landmarks[3].x;
    }

    function isOpenPalm(landmarks) {
      return (
        landmarks[4].y < landmarks[3].y && // большой
        landmarks[8].y < landmarks[6].y && // указательный
        landmarks[12].y < landmarks[10].y && // средний
        landmarks[16].y < landmarks[14].y && // безымянный
        landmarks[20].y < landmarks[18].y // мизинец
      );
    }
    
    // Проверяем "факи": большой и мизинец вверх, остальные пальцы вниз
    function isFackGesture(landmarks) {
      const thumbUp = isThumbUp(landmarks);
      const pinkyUp = isFingerUp(landmarks, 20, 19);
      const indexUp = isFingerUp(landmarks, 8, 7);
      const middleUp = isFingerUp(landmarks, 12, 11);
      const ringUp = isFingerUp(landmarks, 16, 15);
      return thumbUp && pinkyUp && !indexUp && !middleUp && !ringUp;
    }

    // Проверка жеста "сердечко"
    function isHeartGesture(landmarks) {
      // большие пальцы вниз?
      const thumbDown = landmarks[4].y > landmarks[3].y;
      if (!thumbDown) return false;

      // Проверим расстояния между остальными пальцами (8,12,16,20)
      const fingerTips = [8, 12, 16, 20];
      for (let i = 0; i < fingerTips.length - 1; i++) {
        for (let j = i + 1; j < fingerTips.length; j++) {
          const dx = landmarks[fingerTips[i]].x - landmarks[fingerTips[j]].x;
          const dy = landmarks[fingerTips[i]].y - landmarks[fingerTips[j]].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.07) return false; // пальцы далеко - не сердечко
        }
      }
      return true;
    }

    function drawHolographicLines(ctx, landmarks, volume) {
      const connections = HAND_CONNECTIONS;
      const baseGlow = (Math.sin(Date.now() / 200) + 1) / 2;
      const glowIntensity = 0.3 + baseGlow * 0.7 * volume;
      const glowColor = `rgba(255,255,255,${glowIntensity.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 30 * glowIntensity;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;

      for (const [startIdx, endIdx] of connections) {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        ctx.beginPath();
        ctx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        ctx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        ctx.stroke();
      }
    }

    function createHeart() {
      const svgNS = "http://www.w3.org/2000/svg";
      const heart = document.createElementNS(svgNS, "svg");
      heart.setAttribute("class", "heart");
      heart.setAttribute("viewBox", "0 0 24 24");
      heart.style.left = `${Math.random() * window.innerWidth}px`;
      heart.style.top = `${window.innerHeight}px`;
      heart.style.animationDuration = `${0.8 + Math.random() * 0.7}s`;

      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("fill", "#ff2a8d");
      path.setAttribute("d", "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z");
      heart.appendChild(path);
      heartsContainer.appendChild(heart);
      setTimeout(() => heart.remove(), 2000);
    }

    let heartsInterval = null;
    function startHearts() {
      if (heartsInterval) return;
      heartsInterval = setInterval(() => {
        for(let i=0; i<5; i++) createHeart();
      }, 250);
    }
    function stopHearts() {
      if (!heartsInterval) return;
      clearInterval(heartsInterval);
      heartsInterval = null;
      heartsContainer.innerHTML = '';
    }

    let currentMode = 'music';
   
    // частицы для режима эффектов
const particlesCanvas = document.getElementById('particlesCanvas');
const pctx = particlesCanvas.getContext('2d');
particlesCanvas.width = window.innerWidth;
particlesCanvas.height = window.innerHeight;

let particles = [];
for (let i = 0; i < 100; i++) {
  particles.push({
    x: Math.random() * particlesCanvas.width,
    y: Math.random() * particlesCanvas.height,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    radius: 2 + Math.random() * 3
  });
}

function updateParticles(hands) {
  pctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

  particles.forEach(p => {
    // тянутся к центру
    const dx = particlesCanvas.width / 2 - p.x;
    const dy = particlesCanvas.height / 2 - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const force = 0.01;
    p.vx += dx / dist * force;
    p.vy += dy / dist * force;

    // влияние от рук
    if (hands) {
      hands.forEach(hand => {
        const point = hand[9]; // середина ладони
        const px = point.x * particlesCanvas.width;
        const py = point.y * particlesCanvas.height;
        const dxh = p.x - px;
        const dyh = p.y - py;
        const d2 = dxh * dxh + dyh * dyh;
        if (d2 < 3000) {
          const factor = 1 / (d2 + 1);
          p.vx += dxh * factor * 2;
          p.vy += dyh * factor * 2;
        }
      });
    }

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > particlesCanvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > particlesCanvas.height) p.vy *= -1;

    pctx.beginPath();
    pctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    pctx.fillStyle = '#00fff7';
    pctx.fill();
  });
}


    document.getElementById('musicMode').onclick = () => {
      currentMode = 'music';
      document.getElementById('musicMode').classList.add('active');
      document.getElementById('effectMode').classList.remove('active');
    };
    
    document.getElementById('effectMode').onclick = () => {
      currentMode = 'effect';
      document.getElementById('effectMode').classList.add('active');
      document.getElementById('musicMode').classList.remove('active');
    };
    
    // микшер - обновление индикаторов
    const volumeBar = document.getElementById('volumeBar');
    const rateBar = document.getElementById('rateBar');
    const playStatus = document.getElementById('playStatus');

    function updateMixer(volume, rate, paused) {
      volumeBar.style.width = `${volume * 100}%`;
      const ratePercent = ((rate - 0.7) / (2 - 0.7)) * 100;
      rateBar.style.width = `${ratePercent}%`;
      if (paused) {
        playStatus.textContent = 'пауза';
        playStatus.classList.add('paused');
      } else {
        playStatus.textContent = 'играет';
        playStatus.classList.remove('paused');
      }
    }

    hands.onResults((results) => {
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

      const handsDetected = results.multiHandLandmarks || [];
      if (handsDetected.length === 0) {
        stopHearts();
        updateMixer(0, 1, true);
        return;
      }
      
      if (currentMode === 'effect') {
        updateParticles(results.multiHandLandmarks);
      }
      

      let volume = 0.5;
      let rate = 1;
      let pauseAudio = false;

      if (handsDetected.length === 1) {
        const hand = handsDetected[0];
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const dtx = thumbTip.x - indexTip.x;
        const dty = thumbTip.y - indexTip.y;
        const pinch = Math.sqrt(dtx * dtx + dty * dty);
        volume = Math.max(0, Math.min(1, 1 - pinch * 4));

        if (isFackGesture(hand)) {
          pauseAudio = true;
        }

        drawHolographicLines(canvasCtx, hand, volume);
        stopHearts();

      } else if (handsDetected.length === 2) {
        const [hand1, hand2] = handsDetected;

        const dxThumbs = hand1[4].x - hand2[4].x;
        const dyThumbs = hand1[4].y - hand2[4].y;
        const thumbsDist = Math.sqrt(dxThumbs*dxThumbs + dyThumbs*dyThumbs);

        const wrist1 = hand1[0];
        const wrist2 = hand2[0];
        const dx = wrist1.x - wrist2.x;
        const dy = wrist1.y - wrist2.y;
        const handsDistance = Math.sqrt(dx * dx + dy * dy);
        rate = 1 + (0.5 - handsDistance) * 2.5;
        rate = Math.max(0.7, Math.min(2, rate));

        const thumbTip = hand1[4];
        const indexTip = hand1[8];
        const dtx = thumbTip.x - indexTip.x;
        const dty = thumbTip.y - indexTip.y;
        const pinch = Math.sqrt(dtx * dtx + dty * dty);
        volume = Math.max(0, Math.min(1, 1 - pinch * 4));

        const hand1Fack = isFackGesture(hand1);
        const hand2Fack = isFackGesture(hand2);

        if (hand1Fack && hand2Fack) {
          pauseAudio = true;
        } else if (hand1Fack || hand2Fack) {
          pauseAudio = false;
        }

        drawHolographicLines(canvasCtx, hand1, volume);
        drawHolographicLines(canvasCtx, hand2, volume);

        if (thumbsDist < 0.06 && isHeartGesture(hand1) && isHeartGesture(hand2)) {
          startHearts();
        } else {
          stopHearts();
        }
      }

      audio.playbackRate = rate;
      audio.volume = volume;

      if (pauseAudio) {
        audio.pause();
      } else {
        if (audio.paused) audio.play();
      }

      updateMixer(volume, rate, pauseAudio);
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 1024,
      height: 576
    });
    camera.start().then(() => {
      console.log("камера запущена");
    }).catch(console.error);  