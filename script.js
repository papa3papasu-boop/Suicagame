const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const WIDTH = 340; 
const HEIGHT = 520; 
const DEAD_LINE = 80; 

let gameMode = 'solo'; 
let isGameOver = false;
let score = 0;
let cpuScore = 0;

// ★さくらんぼ無しのフルーツデータ
const FRUIT_TYPES = [
  { name: 'いちご',       radius: 19, color: '#ff2e3b', face: 'happy' },
  { name: 'ぶどう',       radius: 24, color: '#a352ff', face: 'wink' },
  { name: 'ブルーベリー', radius: 30, color: '#3377ff', face: 'angry' }, 
  { name: 'みかん',       radius: 37, color: '#ffa629', face: 'cute' },
  { name: 'かき',         radius: 45, color: '#ff7729', face: 'happy' },
  { name: 'もも',         radius: 54, color: '#ff99cc', face: 'tongue' }, 
  { name: 'りんご',       radius: 64, color: '#ff3838', face: 'cute' },
  { name: 'なし',         radius: 76, color: '#e0df56', face: 'sleep' },
  { name: 'パイナップル', radius: 89, color: '#ffe433', face: 'happy' },
  { name: 'メロン',       radius: 104, color: '#82e645', face: 'cute' },
  { name: 'スイカ',       radius: 120, color: '#24b33b', face: 'king' }
];

// ==========================================
// 1. スマホの「本当の表示領域」に合わせる縮小ロジック
// ==========================================
function adjustGameScale() {
  // ブラウザのアドレスバーなどを除いた「本当の画面幅と高さ」を取得
  const windowWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const windowHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

  // タイトル・設定画面の縮小制御
  const menuWrapper = document.getElementById('menu-wrapper');
  const settingsWrapper = document.getElementById('settings-wrapper');
  if (menuWrapper && settingsWrapper) {
    const menuScale = Math.min(1, windowWidth * 0.88 / 240, windowHeight * 0.85 / 320);
    menuWrapper.style.transform = `scale(${menuScale})`;
    settingsWrapper.style.transform = `scale(${menuScale})`;
  }

  // プレイ画面の縮小制御
  const playScreen = document.getElementById('play-screen');
  if (playScreen.classList.contains('hidden')) return;

  const wrapper = document.getElementById('wrapper');
  
  // 各モードのパーツ合計の元サイズ
  const targetWidth = (gameMode === 'cpu') ? 714 : 352; 
  const targetHeight = 670; 

  // 画面の「90%」に完全に収まるように超安全マージンを設定
  const allowedWidth = windowWidth * 0.90;
  const allowedHeight = windowHeight * 0.90;

  const widthScale = allowedWidth / targetWidth;
  const heightScale = allowedHeight / targetHeight;
  
  // 最も狭い方に合わせて縮小（これで上下左右どちらのはみ出しも完全に消滅します）
  const scale = Math.min(1, widthScale, heightScale);
  wrapper.style.transform = `scale(${scale})`;
}

// 画面サイズ変更イベント、スクロール、ズームなどあらゆる変化を監視して即時再計算
window.addEventListener('load', adjustGameScale);
window.addEventListener('resize', adjustGameScale);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustGameScale);
  window.visualViewport.addEventListener('scroll', adjustGameScale);
}
window.addEventListener('orientationchange', () => {
  setTimeout(adjustGameScale, 100);
});

// ==========================================
// 2. 画面遷移
// ==========================================
function openSettings() {
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('settings-screen').classList.remove('hidden');
  adjustGameScale();
}
function closeSettings() {
  document.getElementById('settings-screen').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');
  adjustGameScale();
}
function updateBackground() {
  const theme = document.getElementById('bg-select').value;
  const body = document.getElementById('game-body');
  if (theme === 'cream') body.style.backgroundColor = '#fcedc0';
  else if (theme === 'dark') body.style.backgroundColor = '#1a1a24';
  else if (theme === 'pastel') body.style.backgroundColor = '#ffd3dd';
}

function changeMode(mode) {
  gameMode = mode;
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('play-screen').classList.remove('hidden');
  
  const wrapper = document.getElementById('wrapper');
  if (mode === 'cpu') {
    wrapper.classList.add('cpu-mode-active');
    document.getElementById('cpu-game-container').classList.remove('hidden');
    document.getElementById('info-panel').querySelector('.cpu-info').classList.remove('hidden');
    document.getElementById('p1-label').textContent = 'YOU';
  } else {
    wrapper.classList.remove('cpu-mode-active');
    document.getElementById('cpu-game-container').classList.add('hidden');
    document.getElementById('info-panel').querySelector('.cpu-info').classList.add('hidden');
    document.getElementById('p1-label').textContent = 'PLAYER';
  }
  
  initGames();
  adjustGameScale();
  setTimeout(adjustGameScale, 50);
}

function backToMenu() {
  clearGame(playerGame);
  if (cpuGame) clearGame(cpuGame);
  document.getElementById('play-screen').classList.add('hidden');
  document.getElementById('menu-screen').classList.remove('hidden');
  adjustGameScale();
}

function clearGame(gameObj) {
  if (!gameObj) return;
  Render.stop(gameObj.render);
  Runner.stop(gameObj.runner);
  if (gameObj.render.canvas) {
    gameObj.render.canvas.remove();
  }
  Composite.clear(gameObj.engine.world, false);
  gameObj.container.innerHTML = '';
}

// ==========================================
// 3. ゲームコアシステム
// ==========================================
let playerGame = null;
let cpuGame = null;

function initGames() {
  isGameOver = false;
  score = 0;
  cpuScore = 0;
  document.getElementById('score-val').textContent = '0';
  document.getElementById('cpu-score-val').textContent = '0';

  playerGame = createGameWorld(document.getElementById('game-container'), false);
  if (gameMode === 'cpu') {
    cpuGame = createGameWorld(document.getElementById('cpu-game-container'), true);
  } else {
    cpuGame = null;
  }
  
  const gaugeContainer = document.getElementById('gauge-dots');
  gaugeContainer.innerHTML = ''; 
  FRUIT_TYPES.forEach(type => {
    const dot = document.createElement('div');
    dot.className = 'gauge-dot';
    dot.style.width = `${type.radius * 0.32}px`;
    dot.style.height = `${type.radius * 0.32}px`;
    dot.style.backgroundColor = type.color;
    gaugeContainer.appendChild(dot);
  });
  
  setTimeout(() => { drawPlayerNext(playerGame.nextFruitType); }, 50);
}

function createGameWorld(targetContainer, isCPU) {
  const enc = Engine.create({ gravity: { y: 1.2 } });
  const rnd = Render.create({
    element: targetContainer,
    engine: enc,
    options: { width: WIDTH, height: HEIGHT, wireframes: false, background: '#fffdf6' }
  });
  
  Render.run(rnd);
  const rnr = Runner.create();
  Runner.run(rnr, enc);

  const wallOptions = { isStatic: true, render: { fillStyle: '#e0a96d' } };
  const ground = Bodies.rectangle(WIDTH / 2, HEIGHT - 10, WIDTH, 20, wallOptions);
  const leftWall = Bodies.rectangle(10, HEIGHT / 2, 20, HEIGHT, wallOptions);
  const rightWall = Bodies.rectangle(WIDTH - 10, HEIGHT / 2, 20, HEIGHT, wallOptions);
  Composite.add(enc.world, [ground, leftWall, rightWall]);

  const gameObj = {
    engine: enc, render: rnd, runner: rnr, container: targetContainer, isCPU: isCPU,
    currentFruitType: Math.floor(Math.random() * 3), 
    nextFruitType: Math.floor(Math.random() * 3),
    tubeX: WIDTH / 2, canSpawn: true, isDragging: false, gameOverTimer: 0, localGameOver: false
  };

  Events.on(enc, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      if (bodyA.label === 'fruit' && bodyB.label === 'fruit' && bodyA.fruitType === bodyB.fruitType) {
        if (!Composite.allBodies(enc.world).includes(bodyA) || !Composite.allBodies(enc.world).includes(bodyB)) return;
        
        const currentLevel = bodyA.fruitType;
        const pts = (currentLevel + 1) * 10;
        
        if (!isCPU) {
          score += pts; document.getElementById('score-val').textContent = score;
        } else {
          cpuScore += pts; document.getElementById('cpu-score-val').textContent = cpuScore;
        }

        if (currentLevel < FRUIT_TYPES.length - 1) {
          const upgradedFruit = Bodies.circle((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, FRUIT_TYPES[currentLevel+1].radius, {
            restitution: 0.1, friction: 0.1, label: 'fruit', fruitType: currentLevel + 1, spawnTime: Date.now()
          });
          Composite.remove(enc.world, [bodyA, bodyB]);
          Composite.add(enc.world, upgradedFruit);
        } else {
          if (!isCPU) score += 100; else cpuScore += 100;
          Composite.remove(enc.world, [bodyA, bodyB]);
        }
      }
    });
  });

  Events.on(rnd, 'afterRender', () => {
    const ctx = rnd.context;
    const bodies = Composite.allBodies(enc.world);
    
    ctx.save();
    ctx.strokeStyle = (isGameOver || gameObj.localGameOver) ? '#ff2e3b' : 'rgba(224, 169, 109, 0.6)';
    ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(10, DEAD_LINE); ctx.lineTo(WIDTH - 10, DEAD_LINE); ctx.stroke();
    ctx.restore();

    let isOverflowing = false;
    bodies.forEach(body => {
      if (body.label !== 'fruit') return;
      const { x, y } = body.position;
      const type = FRUIT_TYPES[body.fruitType];
      const r = type.radius;

      if (y - r < DEAD_LINE && Date.now() - body.spawnTime > 1000) {
        isOverflowing = true;
      }

      ctx.save(); ctx.translate(x, y); ctx.rotate(body.angle);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = type.color; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#331a00'; ctx.stroke();

      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fill();

      if (type.face === 'king') {
        ctx.strokeStyle = '#126120'; ctx.lineWidth = 3;
        for (let i = -r; i <= r; i += 25) {
          ctx.beginPath(); ctx.arc(i, 0, r, 0, Math.PI, true); ctx.stroke();
        }
      }

      ctx.fillStyle = '#331a00'; ctx.strokeStyle = '#331a00'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const eyeOffset = r * 0.25; const eyeSize = Math.max(2, r * 0.08);

      if (type.face === 'cute') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI); ctx.stroke();
      } else if (type.face === 'happy') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, r * 0.1, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(eyeOffset, -r * 0.1, r * 0.1, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI); ctx.fill();
      } else if (type.face === 'wink') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(eyeOffset - 4, -r * 0.1); ctx.lineTo(eyeOffset + 4, -r * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.fill();
      } else if (type.face === 'angry') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-eyeOffset - 4, -r * 0.15); ctx.lineTo(-eyeOffset + 4, -r * 0.13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeOffset + 4, -r * 0.15); ctx.lineTo(eyeOffset - 4, -r * 0.13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, r * 0.05); ctx.lineTo(4, r * 0.05); ctx.stroke();
      } else if (type.face === 'tongue') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeOffset, -r * 0.1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff4a6b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI); ctx.fill(); ctx.stroke();
      } else if (type.face === 'sleep') {
        ctx.beginPath(); ctx.moveTo(-eyeOffset - 3, -r * 0.1); ctx.lineTo(-eyeOffset + 3, -r * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(eyeOffset - 3, -r * 0.1); ctx.lineTo(eyeOffset + 3, -r * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, r * 0.05); ctx.lineTo(2, r * 0.05); ctx.stroke();
      } else if (type.face === 'king') {
        ctx.beginPath(); ctx.arc(-eyeOffset, -r * 0.1, eyeSize * 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeOffset, -r * 0.1, eyeSize * 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI); ctx.stroke();
      }
      ctx.restore();
    });

    if (isOverflowing && !isGameOver && !gameObj.localGameOver) {
      gameObj.gameOverTimer++;
      if (gameObj.gameOverTimer > 60) {
        gameObj.localGameOver = true;
        isGameOver = true;
      }
    } else {
      gameObj.gameOverTimer = 0;
    }

    if (!isGameOver && !gameObj.localGameOver) {
      ctx.save(); ctx.translate(gameObj.tubeX, DEAD_LINE - 45);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#331a00'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-13, -15); ctx.lineTo(13, -15); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0a96d'; ctx.fillRect(-15, -20, 30, 5); ctx.strokeRect(-15, -20, 30, 5);
      ctx.fillStyle = FRUIT_TYPES[gameObj.currentFruitType].color;
      ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(12, -8); ctx.lineTo(10, 4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#666'; ctx.fillRect(-3, 8, 6, 6); ctx.strokeRect(-3, 8, 6, 6);
      ctx.restore();
    }

    if (isGameOver || gameObj.localGameOver) {
      ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "M PLUS Rounded 1c"'; ctx.textAlign = 'center';
      let msg = 'GAME OVER';
      if (gameMode === 'cpu') msg = gameObj.localGameOver ? 'LOSE...' : 'WIN!!';
      ctx.fillText(msg, WIDTH / 2, HEIGHT / 2);
      ctx.restore();
    }
  });

  if (!isCPU) {
    const handlePointer = (e) => {
      if (!gameObj.canSpawn || isGameOver || gameObj.localGameOver) return;
      const rect = targetContainer.getBoundingClientRect();
      
      const wrapper = document.getElementById('wrapper');
      const transform = wrapper.style.transform;
      let scale = 1;
      if (transform && transform.includes('scale')) {
        scale = parseFloat(transform.match(/scale\(([^)]+)\)/)[1]);
      }
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (!clientX) return;

      const touchX = (clientX - rect.left) / scale;
      if (touchX >= 0 && touchX <= WIDTH) {
        gameObj.tubeX = getSafeX(touchX, gameObj.currentFruitType);
      }
    };

    targetContainer.addEventListener('pointerdown', (e) => {
      const rect = targetContainer.getBoundingClientRect();
      const wrapper = document.getElementById('wrapper');
      let scale = 1;
      if (wrapper.style.transform.includes('scale')) {
        scale = parseFloat(wrapper.style.transform.match(/scale\(([^)]+)\)/)[1]);
      }
      const clientX = e.clientX;
      const touchX = (clientX - rect.left) / scale;
      
      if (touchX >= 0 && touchX <= WIDTH) {
        gameObj.isDragging = true;
        handlePointer(e);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!gameObj.isDragging || isGameOver) return;
      handlePointer(e);
    });

    window.addEventListener('pointerup', () => {
      if (gameObj.isDragging && gameObj.canSpawn && !isGameOver) {
        gameObj.isDragging = false;
        executeSpawn(gameObj);
        setTimeout(() => { drawPlayerNext(playerGame.nextFruitType); }, 50);
      }
    });
  }

  return gameObj;
}

function drawPlayerNext(nextType) {
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas.getContext('2d');
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const type = FRUIT_TYPES[nextType];
  nextCtx.save(); nextCtx.translate(nextCanvas.width / 2, nextCanvas.height / 2);
  nextCtx.beginPath(); nextCtx.arc(0, 0, Math.max(6, type.radius * 0.4), 0, Math.PI * 2);
  nextCtx.fillStyle = type.color; nextCtx.fill();
  nextCtx.lineWidth = 2; nextCtx.strokeStyle = '#331a00'; 
  nextCtx.stroke(); 
  nextCtx.restore();
}

// ==========================================
// 4. CPU自動ループ
// ==========================================
setInterval(() => {
  if (gameMode !== 'cpu' || !cpuGame || isGameOver || !cpuGame.canSpawn) return;

  const bodies = Composite.allBodies(cpuGame.engine.world).filter(b => b.label === 'fruit');
  let bestX = WIDTH / 2;

  if (bodies.length > 0) {
    const counts = new Array(8).fill(0);
    bodies.forEach(b => {
      const idx = Math.floor(b.position.x / (WIDTH / 8));
      if(idx >= 0 && idx < 8) counts[idx]++;
    });
    const minIdx = counts.indexOf(Math.min(...counts));
    bestX = (minIdx * (WIDTH / 8)) + (WIDTH / 16);
  } else {
    bestX = Math.random() * (WIDTH - 60) + 30;
  }

  cpuGame.tubeX = getSafeX(bestX, cpuGame.currentFruitType);
  
  setTimeout(() => {
    if (!isGameOver && cpuGame.canSpawn) {
      executeSpawn(cpuGame);
    }
  }, 200);
}, 1200); 

function getSafeX(x, typeIndex) {
  const radius = FRUIT_TYPES[typeIndex].radius;
  return Math.max(20 + radius, Math.min(WIDTH - 20 - radius, x));
}

function executeSpawn(gameObj) {
  gameObj.canSpawn = false;
  const radius = FRUIT_TYPES[gameObj.currentFruitType].radius;
  const fruit = Bodies.circle(gameObj.tubeX, DEAD_LINE - 10, radius, {
    restitution: 0.1, friction: 0.1, label: 'fruit', fruitType: gameObj.currentFruitType, spawnTime: Date.now()
  });
  Composite.add(gameObj.engine.world, fruit);

  gameObj.currentFruitType = gameObj.nextFruitType;
  gameObj.nextFruitType = Math.floor(Math.random() * 3); 
  gameObj.tubeX = getSafeX(gameObj.tubeX, gameObj.currentFruitType);

  setTimeout(() => { gameObj.canSpawn = true; }, 400);
}
