const output = document.querySelector('#output');
const jumpCount = document.querySelector('#jumpCount');
const connectBtn = document.querySelector('#connectBtn');
const avatar = document.querySelector('#avatar');
const musique = document.querySelector('#musique');

// ---- réglages ----
const BPM_MUSIQUE = 104;   // tempo de Let's Groove
const PAUSE_APRES = 2000;  // ms sans saut avant de couper la musique

// ---- animation GIF ----
let gifBlob = null;
let dureeGif = 580;
let urlActuelle = null;
let enCours = false;
let enAttente = 0;

function lireDureeGif(buffer) {
  const b = new Uint8Array(buffer);
  let total = 0;
  for (let i = 0; i < b.length - 5; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xF9 && b[i + 2] === 0x04) {
      const d = (b[i + 4] | (b[i + 5] << 8)) * 10;
      total += d <= 10 ? 100 : d;
    }
  }
  return total;
}

fetch("saut.gif")
  .then(r => r.arrayBuffer())
  .then(buf => {
    const d = lireDureeGif(buf);
    if (d > 0) dureeGif = d;
    gifBlob = new Blob([buf], { type: "image/gif" });
    console.log("Durée du GIF :", dureeGif, "ms");
  });

function jouerGif() {
  enCours = true;
  if (urlActuelle) URL.revokeObjectURL(urlActuelle);
  urlActuelle = URL.createObjectURL(gifBlob);
  avatar.src = urlActuelle;

  setTimeout(() => {
    enCours = false;
    if (enAttente > 0) {
      enAttente--;
      jouerGif();
    } else {
      setTimeout(() => {
        if (!enCours) avatar.src = "repos.png";
      }, 80);
    }
  }, dureeGif);
}

function sauter() {
  if (!gifBlob) return;
  if (enCours) {
    enAttente = Math.min(enAttente + 1, 2);
    return;
  }
  jouerGif();
}

// ---- effets visuels ----
function pulse() {
  jumpCount.classList.remove('pulse');
  void jumpCount.offsetWidth;
  jumpCount.classList.add('pulse');
}

function hop() {
  avatar.classList.remove('hop');
  void avatar.offsetWidth;
  avatar.classList.add('hop');
}

// ---- musique au rythme des sauts ----
let instants = [];
let timerPause = null;

function surSaut() {
  instants.push(Date.now());
  instants = instants.slice(-5);

  if (instants.length >= 2) {
    const intervalle = (instants[instants.length - 1] - instants[0]) / (instants.length - 1);
    const vitesse = (60000 / intervalle) / BPM_MUSIQUE;
    musique.playbackRate = Math.min(1.5, Math.max(0.75, vitesse));
  }

  musique.play().catch(() => {});

  clearTimeout(timerPause);
  timerPause = setTimeout(() => {
    musique.pause();
    instants = [];
  }, PAUSE_APRES);
}

// ---- port série ----
connectBtn.addEventListener('click', async function () {
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    connectBtn.disabled = true;
    output.textContent = "Connecté !";

    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lignes = buffer.split("\n");
        buffer = lignes.pop();

        for (const ligne of lignes) {
          const texte = ligne.trim();
          if (texte !== "") {
            jumpCount.textContent = texte;
            pulse();
            hop();
            sauter();
            surSaut();
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    console.error("Error opening serial port:", err);
  }
});