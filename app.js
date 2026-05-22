// Macbeth 3D Booklet Application Logic

// DOM Elements
const book = document.getElementById('macbeth-book');
const sheets = [
  document.getElementById('sheet-1'),
  document.getElementById('sheet-2'),
  document.getElementById('sheet-3')
];
const btnOpenBook = document.getElementById('btn-open-book');
const btnResetBook = document.getElementById('reset-book');
const btnPrev = document.getElementById('prev-page');
const btnNext = document.getElementById('next-page');

const toggleAudioBtn = document.getElementById('toggle-audio');
const audioVisualizer = document.getElementById('audio-visualizer');

// Cauldron Elements
const cauldronWrapper = document.getElementById('cauldron-wrapper');
const brewMessage = document.getElementById('brew-message');
const cauldronQuote = document.getElementById('cauldron-quote');
const potionBubbles = document.getElementById('potion-bubbles');
const ingredientButtons = document.querySelectorAll('.ingredient-item');

// Dagger & Annotation Elements
const glowingDagger = document.getElementById('glowing-dagger');
const daggerArtZone = document.getElementById('dagger-art-zone');
const translationTitle = document.getElementById('translation-title');
const translationText = document.getElementById('translation-text');
const annotatedWords = document.querySelectorAll('.anno-word');

// State Variables
let currentLeaf = 0; // 0 = Closed (Cover), 1 = Sheet 1 flipped, 2 = Sheet 2 flipped, 3 = Sheet 3 flipped (Back Cover)
const totalLeaves = 3;

// Web Audio API State
let audioCtx = null;
let audioInitialized = false;
let isAudioPlaying = false;
let windNoiseSource = null;
let rainNoiseSource = null;
let windFilter = null;
let windGain = null;
let rainGain = null;
let windLfo = null;
let windVolLfo = null;

// Cauldron Brewing State
const addedIngredients = new Set();
const maxIngredients = 4;
const ingredientQuotes = {
  'eye-of-newt': '"Eye of newt, and toe of frog..."<br>The witches grin as the broth changes color.',
  'toe-of-frog': '"Toe of frog... Wool of bat..."<br>A strange green vapour rises from the rim.',
  'wool-of-bat': '"Wool of bat, and tongue of dog..."<br>The potion begins to hum with dark magic.',
  'tongue-of-dog': '"Adder\'s fork, and blind-worm\'s sting..."<br>A pungent scent of sulfur fills the air.'
};

// ----------------------------------------------------
// 1. Booklet Navigation & 3D Page Flipping
// ----------------------------------------------------

function updateBookState() {
  // Update flipped classes on sheets
  sheets.forEach((sheet, idx) => {
    if (idx < currentLeaf) {
      sheet.classList.add('flipped');
      sheet.classList.remove('active-leaf');
    } else if (idx === currentLeaf) {
      sheet.classList.remove('flipped');
      sheet.classList.add('active-leaf');
    } else {
      sheet.classList.remove('flipped');
      sheet.classList.remove('active-leaf');
    }

    // Adjust z-index dynamically based on flipped status to avoid overlapping clipping
    if (idx < currentLeaf) {
      // Flipped pages go behind (decreasing z-index)
      sheet.style.zIndex = 10 + idx;
    } else {
      // Unflipped pages stacked in front (decreasing from top)
      sheet.style.zIndex = 30 - idx;
    }
  });

  // Enable/disable navigation buttons
  if (currentLeaf === 0) {
    btnPrev.classList.add('disabled');
    btnPrev.disabled = true;
  } else {
    btnPrev.classList.remove('disabled');
    btnPrev.disabled = false;
  }

  if (currentLeaf === totalLeaves) {
    btnNext.classList.add('disabled');
    btnNext.disabled = true;
  } else {
    btnNext.classList.remove('disabled');
    btnNext.disabled = false;
  }

  // Adjust overall book perspective transform slightly to balance open look
  if (currentLeaf === 0) {
    book.style.transform = 'rotateX(10deg) rotateY(0deg)';
  } else if (currentLeaf === totalLeaves) {
    book.style.transform = 'rotateX(10deg) rotateY(-5deg)';
  } else {
    book.style.transform = 'rotateX(10deg) rotateY(-2deg)';
  }
}

function flipForward() {
  if (currentLeaf < totalLeaves) {
    currentLeaf++;
    updateBookState();
    playPageFlipSound();
  }
}

function flipBackward() {
  if (currentLeaf > 0) {
    currentLeaf--;
    updateBookState();
    playPageFlipSound();
  }
}

function resetBook() {
  currentLeaf = 0;
  updateBookState();
  playPageFlipSound();
}

// Attach Page turning listeners
btnNext.addEventListener('click', flipForward);
btnPrev.addEventListener('click', flipBackward);
btnOpenBook.addEventListener('click', flipForward);
btnResetBook.addEventListener('click', resetBook);

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    flipForward();
  } else if (e.key === 'ArrowLeft') {
    flipBackward();
  } else if (e.key === 'Escape') {
    resetBook();
  }
});


// ----------------------------------------------------
// 2. Web Audio API Atmosphere Generator
// ----------------------------------------------------

function initAudio() {
  if (audioInitialized) return;

  try {
    // Create audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    // Create white noise buffer
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // --- WIND SYNTHESIS ---
    // Noise source
    windNoiseSource = audioCtx.createBufferSource();
    windNoiseSource.buffer = noiseBuffer;
    windNoiseSource.loop = true;

    // Bandpass filter for wind "howl"
    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 2.5;
    windFilter.frequency.value = 400;

    // Gain node for wind volume
    windGain = audioCtx.createGain();
    windGain.gain.value = 0.05;

    // LFO to modulate filter frequency (creates the rising/falling howling sound)
    windLfo = audioCtx.createOscillator();
    windLfo.frequency.value = 0.06; // Very slow cycle
    const windLfoGain = audioCtx.createGain();
    windLfoGain.gain.value = 280; // Sweeps +/- 280 Hz

    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);

    // LFO to modulate wind volume (creates gusty storms)
    windVolLfo = audioCtx.createOscillator();
    windVolLfo.frequency.value = 0.04;
    const windVolLfoGain = audioCtx.createGain();
    windVolLfoGain.gain.value = 0.04; // Adjust volume up/down by 4%

    windVolLfo.connect(windVolLfoGain);
    windVolLfoGain.connect(windGain.gain);

    // Connect wind chain
    windNoiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);

    // --- RAIN SYNTHESIS ---
    rainNoiseSource = audioCtx.createBufferSource();
    rainNoiseSource.buffer = noiseBuffer;
    rainNoiseSource.loop = true;

    // Bandpass filter for rain "patter" (higher frequencies, less bass)
    const rainFilter = audioCtx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1200;

    rainGain = audioCtx.createGain();
    rainGain.gain.value = 0.02;

    // Connect rain chain
    rainNoiseSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(audioCtx.destination);

    // Start sources and LFOs
    windNoiseSource.start(0);
    windLfo.start(0);
    windVolLfo.start(0);
    rainNoiseSource.start(0);

    audioInitialized = true;
  } catch (err) {
    console.error("Web Audio API not supported or blocked: ", err);
  }
}

function startAmbientSound() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  if (windGain && rainGain) {
    // Fade in wind and rain smoothly
    windGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 2.0);
    rainGain.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 2.0);
  }
  
  isAudioPlaying = true;
  toggleAudioBtn.classList.add('active');
  audioVisualizer.classList.add('playing');
}

function stopAmbientSound() {
  if (windGain && rainGain) {
    // Fade out wind and rain smoothly
    windGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    rainGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
  }
  
  setTimeout(() => {
    if (!isAudioPlaying && audioCtx) {
      audioCtx.suspend();
    }
  }, 1600);

  isAudioPlaying = false;
  toggleAudioBtn.classList.remove('active');
  audioVisualizer.classList.remove('playing');
}

toggleAudioBtn.addEventListener('click', () => {
  if (isAudioPlaying) {
    stopAmbientSound();
  } else {
    startAmbientSound();
  }
});

// Synthesize a page flip sound using a brief noise sweep
function playPageFlipSound() {
  if (!audioInitialized || !isAudioPlaying) return;

  try {
    const flipOsc = audioCtx.createOscillator();
    const flipGain = audioCtx.createGain();
    const flipFilter = audioCtx.createBiquadFilter();

    flipOsc.type = 'sine';
    flipOsc.frequency.setValueAtTime(180, audioCtx.currentTime);
    flipOsc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.35);

    flipFilter.type = 'lowpass';
    flipFilter.frequency.setValueAtTime(300, audioCtx.currentTime);

    flipGain.gain.setValueAtTime(0, audioCtx.currentTime);
    flipGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
    flipGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    flipOsc.connect(flipFilter);
    flipFilter.connect(flipGain);
    flipGain.connect(audioCtx.destination);

    flipOsc.start(0);
    flipOsc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn("Could not play page flip sound:", e);
  }
}

// Synthesize thunder randomly if sound is active
setInterval(() => {
  if (isAudioPlaying && Math.random() < 0.2) {
    triggerThunder();
  }
}, 12000);

function triggerThunder() {
  if (!audioInitialized || !audioCtx) return;

  try {
    const thunderNoise = audioCtx.createBufferSource();
    
    // Re-use noise buffer
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    thunderNoise.buffer = noiseBuffer;

    const thunderFilter = audioCtx.createBiquadFilter();
    thunderFilter.type = 'lowpass';
    thunderFilter.frequency.setValueAtTime(80, audioCtx.currentTime);
    // Dynamic rumble frequency changes
    thunderFilter.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 3.0);

    const thunderGain = audioCtx.createGain();
    thunderGain.gain.setValueAtTime(0, audioCtx.currentTime);
    // Instant lightning strike crack
    thunderGain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.1);
    // Secondary crackle
    thunderGain.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.3);
    // Long fading rumble
    thunderGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 4.5);

    thunderNoise.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(audioCtx.destination);

    thunderNoise.start(0);
    thunderNoise.stop(audioCtx.currentTime + 5.0);

    // Visual lightning effect: flash background
    const originalBg = document.body.style.backgroundColor;
    document.body.style.transition = 'background-color 0.1s ease';
    document.body.style.backgroundColor = '#1a1f1b';
    
    setTimeout(() => {
      document.body.style.backgroundColor = '#2c332d';
      setTimeout(() => {
        document.body.style.transition = 'background-color 3.5s cubic-bezier(0.25, 0.8, 0.25, 1)';
        document.body.style.backgroundColor = originalBg;
      }, 80);
    }, 100);
  } catch (e) {
    console.warn("Could not play thunder:", e);
  }
}

// ----------------------------------------------------
// 3. Witches Cauldron Scene Interaction
// ----------------------------------------------------

function playBubbleSound() {
  if (!audioInitialized || !audioCtx) return;

  try {
    const bubbleOsc = audioCtx.createOscillator();
    const bubbleGain = audioCtx.createGain();

    bubbleOsc.type = 'sine';
    // Frequency sweep upward (sounds like a liquid pop)
    const baseFreq = 180 + Math.random() * 100;
    bubbleOsc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    bubbleOsc.frequency.exponentialRampToValueAtTime(baseFreq * 3.5, audioCtx.currentTime + 0.18);

    bubbleGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    bubbleGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

    bubbleOsc.connect(bubbleGain);
    bubbleGain.connect(audioCtx.destination);

    bubbleOsc.start(0);
    bubbleOsc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.warn("Could not play bubble sound:", e);
  }
}

// Generate animated bubbles in SVG area
function createBubbleVisual() {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  
  const size = 5 + Math.random() * 8;
  const left = Math.random() * 80;
  
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${left}px`;
  
  potionBubbles.appendChild(bubble);
  
  // Remove after animation completes
  setTimeout(() => {
    bubble.remove();
  }, 2500);
}

ingredientButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const ingredient = e.target.getAttribute('data-ingredient');
    const name = e.target.textContent;
    
    // Add to cauldron brew
    if (!addedIngredients.has(ingredient)) {
      addedIngredients.add(ingredient);
      e.target.style.opacity = '0.4';
      e.target.style.pointerEvents = 'none';
      
      // Update text and triggers
      brewMessage.textContent = `Added ${name}!`;
      cauldronQuote.innerHTML = ingredientQuotes[ingredient];
      
      // Bubble audio and animations
      playBubbleSound();
      for (let i = 0; i < 6; i++) {
        setTimeout(createBubbleVisual, i * 150);
      }
      
      // Shake cauldron
      cauldronWrapper.classList.add('bubbling');
      setTimeout(() => {
        if (addedIngredients.size < maxIngredients) {
          cauldronWrapper.classList.remove('bubbling');
        }
      }, 600);

      // Check if brew is complete!
      if (addedIngredients.size === maxIngredients) {
        setTimeout(triggerCompletedBrew, 1000);
      }
    }
  });
});

function triggerCompletedBrew() {
  cauldronWrapper.classList.add('bubbling');
  brewMessage.textContent = "Prophecy Brewed!";
  brewMessage.style.color = '#ff3366';
  
  cauldronQuote.innerHTML = `
    "Double, double toil and trouble;<br>
    Fire burn, and cauldron bubble.<br>
    Something wicked this way comes!"
  `;

  // Intense boiling bubbles
  const boilInterval = setInterval(() => {
    if (addedIngredients.size === maxIngredients) {
      createBubbleVisual();
      if (Math.random() < 0.3) playBubbleSound();
    } else {
      clearInterval(boilInterval);
    }
  }, 100);

  // Play thunder and flash screen to seal prophecy
  triggerThunder();

  // Reset shelf button state after 8 seconds
  setTimeout(() => {
    clearInterval(boilInterval);
    resetCauldron();
  }, 8000);
}

function resetCauldron() {
  addedIngredients.clear();
  cauldronWrapper.classList.remove('bubbling');
  brewMessage.textContent = "Brew is empty...";
  brewMessage.style.color = 'var(--crimson)';
  cauldronQuote.innerHTML = '"Double, double toil and trouble;<br>Fire burn, and cauldron bubble."';
  
  ingredientButtons.forEach(btn => {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  });
}


// ----------------------------------------------------
// 4. Soliloquy Annotations & Dagger Interaction
// ----------------------------------------------------

annotatedWords.forEach(word => {
  word.addEventListener('click', (e) => {
    // Prevent event bubbling to other layers
    e.stopPropagation();
    
    const wordText = e.target.textContent;
    const translation = e.target.getAttribute('data-translation');
    
    // Display in glossary HUD
    translationTitle.textContent = `Glossary: "${wordText}"`;
    translationText.innerHTML = `<strong>Definition:</strong> ${translation}`;
    
    // Synthesize tiny spell-like focus audio
    playFocusChime();
  });
});

function playFocusChime() {
  if (!audioInitialized || !isAudioPlaying) return;

  try {
    const chimeOsc = audioCtx.createOscillator();
    const chimeGain = audioCtx.createGain();

    chimeOsc.type = 'triangle';
    chimeOsc.frequency.setValueAtTime(650, audioCtx.currentTime);
    chimeOsc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);

    chimeGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    chimeGain.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.02);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(audioCtx.destination);

    chimeOsc.start(0);
    chimeOsc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    console.warn("Could not play focus chime:", e);
  }
}

// Ornate Dagger Interactions
daggerArtZone.addEventListener('click', () => {
  // Trigger dramatic heartbeat and red flash
  triggerDaggerStrike();
  
  // Display literary analysis
  translationTitle.textContent = "The Fatal Vision (Analysis)";
  translationText.innerHTML = `
    "Is this a dagger which I see before me?" Macbeth's mind, fevered by ambition and guilt, 
    hallucinates a bloody weapon directing him toward the murder of King Duncan. 
    It is the first of many psychological hauntings that plague him.
  `;
});

function triggerDaggerStrike() {
  if (!audioInitialized || !audioCtx) return;

  try {
    // 1. Synthesize heartbeat (double thud)
    playHeartbeat(0);
    playHeartbeat(0.4);

    // 2. Synthesize minor metallic hiss
    const hissOsc = audioCtx.createOscillator();
    const hissGain = audioCtx.createGain();
    const hissFilter = audioCtx.createBiquadFilter();

    hissOsc.type = 'triangle';
    hissOsc.frequency.setValueAtTime(100, audioCtx.currentTime);
    hissOsc.frequency.exponentialRampToValueAtTime(18, audioCtx.currentTime + 0.8);

    hissFilter.type = 'lowpass';
    hissFilter.frequency.value = 150;

    hissGain.gain.setValueAtTime(0, audioCtx.currentTime);
    hissGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
    hissGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

    hissOsc.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    hissOsc.start(0);
    hissOsc.stop(audioCtx.currentTime + 0.9);

    // Visual blood slash: briefly tint the page red
    const daggerZone = document.getElementById('dagger-art-zone');
    const prevBg = daggerZone.style.backgroundColor;
    daggerZone.style.transition = 'background-color 0.1s ease';
    daggerZone.style.backgroundColor = 'rgba(139, 14, 14, 0.25)';
    
    setTimeout(() => {
      daggerZone.style.transition = 'background-color 1.2s ease';
      daggerZone.style.backgroundColor = prevBg;
    }, 150);
  } catch (e) {
    console.warn("Could not play dagger strike sounds:", e);
  }
}

function playHeartbeat(delay) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, audioCtx.currentTime + delay);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + delay + 0.25);
  
  gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + delay + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.25);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + 0.35);
}

// ----------------------------------------------------
// 5. Initial Boot Hook
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  updateBookState();
});
