import { logger } from '@/lib/logger';

// Simple confetti effect for celebrations.
// Fires from the bottom corners as two cannons arcing inward and up, leaving
// the center clear so it doesn't obscure any post-completion CTA (Gemini #10).
export function triggerConfetti() {
  playConfettiSound();

  const confettiContainer = document.createElement('div');
  confettiContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10000;
  `;
  document.body.appendChild(confettiContainer);

  const piecesPerCannon = 50;
  const cannons: Array<{ side: 'left' | 'right' }> = [{ side: 'left' }, { side: 'right' }];

  cannons.forEach(({ side }) => {
    for (let i = 0; i < piecesPerCannon; i++) {
      const piece = document.createElement('div');
      const dx = (Math.random() * 50 + 30) * (side === 'left' ? 1 : -1);
      const dy = -(Math.random() * 70 + 50);
      const driftY = Math.random() * 40 + 60;
      const dur = (Math.random() * 0.8 + 1.4).toFixed(2);
      piece.style.cssText = `
        position: absolute;
        width: ${Math.random() * 8 + 4}px;
        height: ${Math.random() * 8 + 4}px;
        background: ${getRandomColor()};
        bottom: 0;
        ${side}: 4%;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        --dx: ${dx}vw;
        --dy: ${dy}vh;
        --drift-y: ${driftY}vh;
        animation: confetti-cannon ${dur}s cubic-bezier(.18,.7,.4,1) forwards;
        transform: rotate(${Math.random() * 360}deg);
      `;
      confettiContainer.appendChild(piece);
    }
  });

  setTimeout(() => {
    confettiContainer.remove();
  }, 3000);
}

function getRandomColor(): string {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function playConfettiSound() {
  try {
    // Create audio context for generating celebration sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a cheerful ascending chord progression
    const notes = [
      { freq: 523.25, time: 0 },    // C5
      { freq: 659.25, time: 0.1 },  // E5  
      { freq: 783.99, time: 0.2 },  // G5
      { freq: 1046.5, time: 0.3 },  // C6
    ];
    
    notes.forEach(({ freq, time }) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + time);
      oscillator.type = 'sine';
      
      // Envelope for a pleasant sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + time);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.4);
      
      oscillator.start(audioContext.currentTime + time);
      oscillator.stop(audioContext.currentTime + time + 0.4);
    });
    
    // Add some sparkle with higher frequency notes
    setTimeout(() => {
      const sparkleOsc = audioContext.createOscillator();
      const sparkleGain = audioContext.createGain();
      
      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(audioContext.destination);
      
      sparkleOsc.frequency.setValueAtTime(2093, audioContext.currentTime); // C7
      sparkleOsc.type = 'triangle';
      
      sparkleGain.gain.setValueAtTime(0, audioContext.currentTime);
      sparkleGain.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.02);
      sparkleGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      sparkleOsc.start(audioContext.currentTime);
      sparkleOsc.stop(audioContext.currentTime + 0.2);
    }, 300);
    
  } catch (error) {
    logger.debug('🎵 Audio not supported, confetti will be silent');
  }
}

// Mini confetti for step completions (smaller, no sound)
export function triggerMiniConfetti() {
  const confettiContainer = document.createElement('div');
  confettiContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10000;
  `;
  document.body.appendChild(confettiContainer);

  // Create fewer, smaller confetti pieces
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.style.cssText = `
      position: absolute;
      width: ${Math.random() * 6 + 3}px;
      height: ${Math.random() * 6 + 3}px;
      background: ${getRandomColor()};
      top: 40%;
      left: ${30 + Math.random() * 40}%;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confetti-burst ${Math.random() * 0.8 + 0.6}s ease-out forwards;
      transform: rotate(${Math.random() * 360}deg);
    `;
    confettiContainer.appendChild(piece);
  }

  // Clean up after animation
  setTimeout(() => {
    confettiContainer.remove();
  }, 1500);
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes confetti-fall {
    0% {
      opacity: 1;
      transform: translateY(-10px) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: translateY(100vh) rotate(720deg);
    }
  }
  @keyframes confetti-cannon {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0deg);
    }
    35% {
      opacity: 1;
      transform: translate(var(--dx), var(--dy)) rotate(180deg);
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), calc(var(--dy) + var(--drift-y))) rotate(540deg);
    }
  }
  @keyframes confetti-burst {
    0% {
      opacity: 1;
      transform: scale(0) rotate(0deg);
    }
    50% {
      opacity: 1;
      transform: scale(1.2) rotate(180deg) translateY(-20px);
    }
    100% {
      opacity: 0;
      transform: scale(0.5) rotate(360deg) translateY(50px);
    }
  }
`;
document.head.appendChild(style);