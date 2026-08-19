const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SISTEMA DE ZOOM AUTOMÁTICO ---
function ajustarTamanhoTela() {
    const wrapper = document.getElementById('game-wrapper');
    const escala = Math.min(
        (window.innerWidth * 0.95) / 320, 
        (window.innerHeight * 0.95) / 480
    );
    wrapper.style.transform = `scale(${escala})`;
}
ajustarTamanhoTela();
window.addEventListener('resize', ajustarTamanhoTela);

// --- CARREGANDO AS IMAGENS ---
const imagemJorge = new Image();
imagemJorge.src = 'images/jorge.png';

const imagemFundo = new Image();
imagemFundo.src = 'images/fundo.png'; 

const imagemCano = new Image();
imagemCano.src = 'images/cano.png'; 

// --- CARREGANDO OS ÁUDIOS ---
const somPulo = new Audio('https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/audio/wing.wav');
const somBateu = new Audio('https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/audio/hit.wav');
const musicaFundo = new Audio('audio/musica.mp3'); 

musicaFundo.loop = true;
musicaFundo.volume = 0.3; 
musicaFundo.preload = 'auto';
somPulo.volume = 0.5;
somBateu.volume = 0.5;

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDj11GWGrm_hCZ_cR9Iho0cCDwRi-9lgMs",
    authDomain: "flappyjorge-6df51.firebaseapp.com",
    databaseURL: "https://flappyjorge-6df51-default-rtdb.firebaseio.com",
    projectId: "flappyjorge-6df51",
    storageBucket: "flappyjorge-6df51.firebasestorage.app",
    messagingSenderId: "567350536944",
    appId: "1:567350536944:web:a5ed99b38d16a00d087035",
    measurementId: "G-1GCCZ24ENK"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// --- CONTROLE DE TELAS E ELEMENTOS ---
const telaLogin = document.getElementById('tela-login');
const boxLogin = document.getElementById('box-login');
const boxRegistro = document.getElementById('box-registro');
const boxPlay = document.getElementById('box-play');

const btnLogin = document.getElementById('btn-login');
const btnAbrirRegistro = document.getElementById('btn-abrir-registro');
const btnRegistrar = document.getElementById('btn-registrar');
const btnVoltarLogin = document.getElementById('btn-voltar-login');
const btnIniciarJogo = document.getElementById('btn-iniciar-jogo');
const btnDeslogar = document.getElementById('btn-deslogar');
const msgBoasVindas = document.getElementById('msg-boasvindas');

const dominioFalso = "@nivel25.com";

// --- CONTROLE DE MUTE E MÚSICA INFINITA ---
const btnSom = document.getElementById('btn-som');
let somLigado = true;

if (btnSom) {
    btnSom.addEventListener('click', () => {
        somLigado = !somLigado;
        musicaFundo.muted = !somLigado;
        somPulo.muted = !somLigado;
        somBateu.muted = !somLigado;
        
        btnSom.innerText = somLigado ? "🔊" : "🔇";

        if (somLigado && musicaFundo.paused) {
            musicaFundo.play().catch(()=>{});
        }
    });
}

document.body.addEventListener('click', () => {
    if (somLigado && musicaFundo.paused) {
        musicaFundo.play().catch(()=>{});
    }
}, { once: true });

// --- PAUSA A MÚSICA AO MINIMIZAR/TROCAR DE ABA ---
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        musicaFundo.pause();
    } else {
        if (somLigado) {
            musicaFundo.play().catch(()=>{});
        }
    }
});


// --- VARIÁVEIS DO JOGO E TRAVA DE FPS ---
let jogoAcabou = false;
let jogoIniciado = false;
let contagem = -1; 
let pontuacao = 0;
let nomeDoJogadorAtual = "";
let usuarioAtualUID = null;

let ultimoTempo = 0;
const intervaloFPS = 1000 / 60; 

let jorge = {
    x: 40,
    y: 150,
    width: 50,  
    height: 34, 
    velocidade: 0,
    gravidade: 0.5, 
    forcaPulo: -8   
};

let canos = [];
const larguraCano = 75; 
const espacoEntreCanos = 145; 
let velocidadeCanos = 2; 
const velocidadeMaxima = 4.5; 
let framesDesdeUltimoCano = 0; 

// --- RANKING ONLINE EM TEMPO REAL ---
function salvarPontuacaoFirebase() {
    if (pontuacao > 0 && usuarioAtualUID) {
        const nomeCorreto = auth.currentUser ? (auth.currentUser.displayName || nomeDoJogadorAtual) : nomeDoJogadorAtual;
        
        const userRef = db.ref('ranking/' + usuarioAtualUID);
        
        userRef.once('value').then((snapshot) => {
            const dados = snapshot.val();
            if (!dados || pontuacao > dados.pontos) {
                userRef.set({ nome: nomeCorreto, pontos: pontuacao });
            }
        });
    }
}

function escutarRankingFirebase() {
    const listaRanking = document.getElementById('lista-ranking');
    db.ref('ranking').on('value', (snapshot) => {
        const dados = snapshot.val();
        listaRanking.innerHTML = '';
        
        if (!dados) {
            listaRanking.innerHTML = '<li style="justify-content:center;">Sem recordes ainda</li>';
            return;
        }

        const rankingArray = Object.values(dados);
        rankingArray.sort((a, b) => b.pontos - a.pontos);
        rankingArray.slice(0, 5).forEach((jogador, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${index + 1}º ${jogador.nome.substring(0, 9)}</span><span>${jogador.pontos} XP</span>`;
            listaRanking.appendChild(li);
        });
    });
}
escutarRankingFirebase();

// --- AUTENTICAÇÃO E SESSÃO ---
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioAtualUID = user.uid;
        nomeDoJogadorAtual = user.displayName || "JOGADOR";
        msgBoasVindas.innerText = `PILOTO: ${nomeDoJogadorAtual}`;
        boxLogin.style.display = 'none';
        boxRegistro.style.display = 'none';
        boxPlay.style.display = 'flex';
        telaLogin.style.display = 'flex';
    } else {
        usuarioAtualUID = null;
        boxPlay.style.display = 'none';
        boxRegistro.style.display = 'none';
        boxLogin.style.display = 'flex';
    }
});

btnAbrirRegistro.addEventListener('click', () => { boxLogin.style.display = 'none'; boxRegistro.style.display = 'flex'; });
btnVoltarLogin.addEventListener('click', () => { boxRegistro.style.display = 'none'; boxLogin.style.display = 'flex'; });

btnRegistrar.addEventListener('click', () => {
    const user = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-displayname').value.trim().toUpperCase();
    const pass = document.getElementById('reg-password').value;
    
    if(!user || !displayName || !pass) { alert("Preencha todos os campos!"); return; }

    const idJogador = displayName.replace(/\s+/g, '').toLowerCase();
    const emailFake = user.replace(/\s+/g, '').toLowerCase() + dominioFalso;

    db.ref('nicksReservados/' + idJogador).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            alert(`O Nome "${displayName}" já está em uso! Escolha outro.`);
        } else {
            return auth.createUserWithEmailAndPassword(emailFake, pass).then((userCredential) => {
                return userCredential.user.updateProfile({ displayName: displayName }).then(() => {
                    nomeDoJogadorAtual = displayName;
                    msgBoasVindas.innerText = `PILOTO: ${nomeDoJogadorAtual}`;
                    
                    return db.ref('nicksReservados/' + idJogador).set(user);
                });
            });
        }
    }).catch((error) => { alert("Erro ao criar conta: " + error.message); });
});

btnLogin.addEventListener('click', () => {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if(user && pass) {
        const emailFake = user.replace(/\s+/g, '').toLowerCase() + dominioFalso;
        auth.signInWithEmailAndPassword(emailFake, pass).catch(() => { alert("Usuário ou senha incorretos!"); });
    } else { alert("Preencha o Usuário e a Senha!"); }
});

btnDeslogar.addEventListener('click', () => { auth.signOut(); });

// --- LÓGICA DE INICIAR O JOGO E CONTAGEM (3, 2, 1, GO!) ---
btnIniciarJogo.addEventListener('click', () => {
    telaLogin.style.display = 'none';
    
    jorge.y = 150;
    jorge.velocidade = 0;
    canos = [];
    framesDesdeUltimoCano = 0;
    pontuacao = 0;
    velocidadeCanos = 2; 
    jogoAcabou = false;
    jogoIniciado = false; 
    
    contagem = 3; 
    
    if (somLigado) { musicaFundo.play().catch(()=>{}); }

    ultimoTempo = performance.now();
    requestAnimationFrame(gameLoop);

    let intervalo = setInterval(() => {
        contagem--;
        if (contagem < 0) {
            clearInterval(intervalo);
            jogoIniciado = true; 
            pular(); 
        }
    }, 1000);
});

// --- CONTROLES E FÍSICA ---
function pular() {
    if (contagem >= 0) return; 

    if (jogoAcabou) {
        salvarPontuacaoFirebase();
        telaLogin.style.display = 'flex';
        boxLogin.style.display = 'none';
        boxRegistro.style.display = 'none';
        boxPlay.style.display = 'flex';
        jogoAcabou = false;
        jogoIniciado = false;
        contagem = -1;
        return;
    }
    
    if (!jogoIniciado) return;

    jorge.velocidade = jorge.forcaPulo;
    somPulo.currentTime = 0;
    if (somLigado) { somPulo.play().catch(()=>{}); } 
}

function gerenciarCanos() {
    framesDesdeUltimoCano++;
    let framesParaNovoCano = Math.floor(200 / velocidadeCanos);

    if (framesDesdeUltimoCano >= framesParaNovoCano) {
        let alturaTopo = Math.max(50, Math.random() * (canvas.height - espacoEntreCanos - 50));
        canos.push({ x: canvas.width, alturaTopo: alturaTopo, passou: false });
        framesDesdeUltimoCano = 0; 
    }

    for (let i = 0; i < canos.length; i++) {
        let cano = canos[i];
        cano.x -= velocidadeCanos;

        if (imagemCano.complete && imagemCano.naturalHeight !== 0) {
            let proporcao = imagemCano.naturalHeight / imagemCano.naturalWidth;
            let alturaDesenhada = larguraCano * proporcao;
            ctx.save();
            ctx.translate(cano.x + (larguraCano / 2), cano.alturaTopo);
            ctx.rotate(Math.PI); 
            ctx.drawImage(imagemCano, -larguraCano / 2, 0, larguraCano, alturaDesenhada);
            ctx.restore();
            ctx.drawImage(imagemCano, cano.x, cano.alturaTopo + espacoEntreCanos, larguraCano, alturaDesenhada);
        } else {
            ctx.fillStyle = '#1a5299';
            ctx.fillRect(cano.x, 0, larguraCano, cano.alturaTopo);
            ctx.fillRect(cano.x, cano.alturaTopo + espacoEntreCanos, larguraCano, canvas.height);
        }

        const hitboxCano = 12; 
        const hitboxJorge = 8; 

        if (jorge.x + jorge.width - hitboxJorge > cano.x + hitboxCano && 
            jorge.x + hitboxJorge < cano.x + larguraCano - hitboxCano) {
            
            if (jorge.y + hitboxJorge < cano.alturaTopo || 
                jorge.y + jorge.height - hitboxJorge > cano.alturaTopo + espacoEntreCanos) {
                
                if (!jogoAcabou && somLigado) { somBateu.play().catch(()=>{}); }
                jogoAcabou = true;
            }
        }

        // --- SISTEMA DE PONTUAÇÃO E DIFICULDADE DINÂMICA ---
        if (cano.x + larguraCano < jorge.x && !cano.passou) {
            pontuacao++;
            cano.passou = true;
            
            if (velocidadeCanos < velocidadeMaxima) {
                if (pontuacao < 50) {
                    velocidadeCanos += 0.02; 
                } else {
                    velocidadeCanos += 0.05; 
                }
            }
        }

        if (cano.x + larguraCano < 0) {
            canos.shift();
            i--; 
        }
    }
}

function atualizarFisica() {
    jorge.velocidade += jorge.gravidade;
    jorge.y += jorge.velocidade;

    if (jorge.y + jorge.height >= canvas.height) {
        jorge.y = canvas.height - jorge.height;
        if (!jogoAcabou && somLigado) { somBateu.play().catch(()=>{}); }
        jogoAcabou = true;
    }
    if (jorge.y <= 0) { jorge.y = 0; jorge.velocidade = 0; }
}

function desenharJorge() {
    if (imagemJorge.complete && imagemJorge.naturalHeight !== 0) {
        ctx.drawImage(imagemJorge, jorge.x, jorge.y, jorge.width, jorge.height);
    } else {
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(jorge.x, jorge.y, jorge.width, jorge.height);
    }
}

function desenharPlacar() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px sans-serif'; 
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.fillText(pontuacao, canvas.width / 2 - 10, 50);
    ctx.strokeText(pontuacao, canvas.width / 2 - 10, 50);
}

function desenharGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = '16px "Press Start 2P", monospace'; 
    ctx.textAlign = 'center';
    
    ctx.fillText('FIM DE JOGO', canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillText(`XP: ${pontuacao}`, canvas.width / 2, canvas.height / 2 + 20);
    
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('TOQUE PARA VOLTAR', canvas.width / 2, canvas.height / 2 + 70);
    
    ctx.textAlign = 'left'; 
}

function gameLoop(tempoAtual) {
    if (!jogoIniciado && contagem < 0 && !jogoAcabou) return; 

    let idAnimacao = requestAnimationFrame(gameLoop);

    if (!tempoAtual) tempoAtual = performance.now();
    let delta = tempoAtual - ultimoTempo;
    
    if (delta < intervaloFPS) return;
    ultimoTempo = tempoAtual - (delta % intervaloFPS);

    if (imagemFundo.complete && imagemFundo.naturalHeight !== 0) {
        ctx.drawImage(imagemFundo, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (contagem >= 0) {
        desenharJorge(); 
        ctx.fillStyle = '#fff';
        ctx.font = '40px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        let textoAviso = contagem === 0 ? "GO!" : contagem;
        ctx.strokeText(textoAviso, canvas.width / 2, canvas.height / 2 + 15);
        ctx.fillText(textoAviso, canvas.width / 2, canvas.height / 2 + 15);
        ctx.textAlign = 'left';
        return;
    }

    if (!jogoAcabou) {
        atualizarFisica();
        gerenciarCanos(); 
        desenharJorge();
        desenharPlacar();
    } 
    else {
        for (let i = 0; i < canos.length; i++) {
            if (imagemCano.complete && imagemCano.naturalHeight !== 0) {
                let proporcao = imagemCano.naturalHeight / imagemCano.naturalWidth;
                let alturaDesenhada = larguraCano * proporcao;
                ctx.save();
                ctx.translate(canos[i].x + (larguraCano / 2), canos[i].alturaTopo);
                ctx.rotate(Math.PI); 
                ctx.drawImage(imagemCano, -larguraCano / 2, 0, larguraCano, alturaDesenhada);
                ctx.restore();
                ctx.drawImage(imagemCano, canos[i].x, canos[i].alturaTopo + espacoEntreCanos, larguraCano, alturaDesenhada);
            }
        }
        desenharJorge();
        desenharGameOver();
        cancelAnimationFrame(idAnimacao);
    }
}

canvas.addEventListener('mousedown', pular);
canvas.addEventListener('touchstart', function(e) { e.preventDefault(); pular(); }, { passive: false });
document.addEventListener('keydown', function(e) { if(e.code === 'Space') { e.preventDefault(); pular(); } });