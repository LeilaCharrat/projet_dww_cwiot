// les elements de la page
const output = document.querySelector('#output');
const jumpCount = document.querySelector('#jumpCount');
const connectBtn = document.querySelector('#connectBtn');
const avatar = document.querySelector('#avatar');
const musique = document.querySelector('#musique');

// reglages
const BPM_MUSIQUE = 104;   // le tempo de Let's Groove
const PAUSE_APRES = 2000;  // la musique s'arrete apres 2 secondes sans saut

// ---- animation de l'avatar ----
let gifBlob = null;
let dureeGif = 580;
let urlActuelle = null;
let enCours = false;   // vrai quand le gif joue
let enAttente = 0;     // sauts qui attendent la fin du gif

// calcule la duree du gif en additionnant le delai de chaque image
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

// on charge le gif une seule fois au debut
fetch("saut.gif")
  .then(r => r.arrayBuffer())
  .then(buf => {
    const d = lireDureeGif(buf);
    if (d > 0) dureeGif = d;
    gifBlob = new Blob([buf], { type: "image/gif" });
    console.log("Duree du GIF :", dureeGif, "ms");
  });

function jouerGif() {
  enCours = true;
  if (urlActuelle) URL.revokeObjectURL(urlActuelle);
  urlActuelle = URL.createObjectURL(gifBlob);   // nouvelle url = le gif repart du debut
  avatar.src = urlActuelle;

  setTimeout(() => {
    enCours = false;
    if (enAttente > 0) {
      enAttente--;
      jouerGif();   // un saut attendait, on rejoue
    } else {
      setTimeout(() => {
        if (!enCours) avatar.src = "repos.png";   // retour a l'image d'arret
      }, 80);
    }
  }, dureeGif);
}

// appelee a chaque saut
function sauter() {
  if (!gifBlob) return;
  if (enCours) {
    enAttente = Math.min(enAttente + 1, 2);   // 2 max sinon l'avatar est en retard
    return;
  }
  jouerGif();
}

// ---- petits effets ----
function pulse() {
  jumpCount.classList.remove('pulse');
  void jumpCount.offsetWidth;   // astuce pour relancer l'animation css
  jumpCount.classList.add('pulse');
}

function hop() {
  avatar.classList.remove('hop');
  void avatar.offsetWidth;
  avatar.classList.add('hop');
}

// ---- musique ----
let instants = [];
let timerPause = null;

function surSaut() {
  instants.push(Date.now());
  instants = instants.slice(-5);   // on garde les 5 derniers sauts

  if (instants.length >= 2) {
    // temps moyen entre les sauts -> vitesse de la musique
    const intervalle = (instants[instants.length - 1] - instants[0]) / (instants.length - 1);
    const vitesse = (60000 / intervalle) / BPM_MUSIQUE;
    musique.playbackRate = Math.min(1.5, Math.max(0.75, vitesse));
  }

  musique.play().catch(() => {});

  // plus de saut pendant 2s = pause
  clearTimeout(timerPause);
  timerPause = setTimeout(() => {
    musique.pause();
    instants = [];
  }, PAUSE_APRES);
}

// ---- connexion a l'arduino ----
connectBtn.addEventListener('click', async function () {
  try {
    // on choisit le port (COM3)
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });   // meme vitesse que l'arduino

    connectBtn.disabled = true;
    output.textContent = "Connecté !";

    // on transforme les donnees en texte
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let buffer = "";   // le texte pas fini

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lignes = buffer.split("\n");   // une ligne = un saut
        buffer = lignes.pop();               // on garde la ligne pas finie

        for (const ligne of lignes) {
          const texte = ligne.trim();
          if (texte !== "") {
            jumpCount.textContent = texte;   // on affiche le nouveau total
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