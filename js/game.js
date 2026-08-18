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
const somPonto = new Audio('https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/audio/point.wav');
const somBateu = new Audio('https://raw.githubusercontent.com/samuelcust/flappy-bird-assets/master/audio/hit.wav');
const musicaFundo = new Audio('audio/musica.mp3'); 

musicaFundo.loop = true;
musicaFundo.volume = 0.3; 
musicaFundo.preload = 'auto';
somPulo.volume = 0.5;
somPonto.volume = 0.5;
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

// --- CONTROLE DE MUTE ---
const btnSom = document.getElementById('btn-som');
let somLigado = true;

if (btnSom) {
    btnSom.addEventListener('click', () => {
        somLigado = !somLigado;
        
        // Muta ou desmuta todos os áudios
        musicaFundo.muted = !somLigado;
        somPulo.muted = !somLigado;
        somPonto.muted = !somLigado;
        somBateu.muted = !somLigado;
        
        // Troca o ícone
        btnSom.innerText = somLigado ? "🔊" : "🔇";
    });
}


const dominioFalso = "@nivel25.com";

// --- VARIÁVEIS DO JOGO ---
let jogoAcabou = false;
let jogoIniciado = false;
let pontuacao = 0;
let nomeDoJogadorAtual = "";
let usuarioAtualUID = null;

// O Jorge
let jorge = {
    x: 40,
    y: 150,
    width: 50,  
    height: 34, 
    velocidade: 0,
    gravidade: 0.5, 
    forcaPulo: -8   
};

// Os Obstáculos
let canos = [];
const larguraCano = 75; 
const espacoEntreCanos = 145; 
let velocidadeCanos = 2; 
const velocidadeMaxima = 4.5; 
let framesDesdeUltimoCano = 0; 

// --- RANKING ONLINE EM TEMPO REAL (FIREBASE) ---
function salvarPontuacaoFirebase() {
    if (pontuacao > 0 && usuarioAtualUID) {
        const userRef = db.ref('ranking/' + usuarioAtualUID);
        
        userRef.once('value').then((snapshot) => {
            const dados = snapshot.val();
            // Salva apenas se for um recorde novo do jogador
            if (!dados || pontuacao > dados.pontos) {
                userRef.set({
                    nome: nomeDoJogadorAtual,
                    pontos: pontuacao
                });
            }
        });
    }
}

// Ouvinte em tempo real: qualquer pontuação nova no Firebase atualiza o Top 5
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
        const top5 = rankingArray.slice(0, 5);

        top5.forEach((jogador, index) => {
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

btnAbrirRegistro.addEventListener('click', () => {
    boxLogin.style.display = 'none';
    boxRegistro.style.display = 'flex';
});

btnVoltarLogin.addEventListener('click', () => {
    boxRegistro.style.display = 'none';
    boxLogin.style.display = 'flex';
});

btnRegistrar.addEventListener('click', () => {
    const user = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-displayname').value.trim().toUpperCase();
    const pass = document.getElementById('reg-password').value;
    
    if(!user || !displayName || !pass) {
        alert("Preencha todos os campos!");
        return;
    }

    const idJogador = displayName.replace(/\s+/g, '').toLowerCase();
    const uFormatado = user.replace(/\s+/g, '').toLowerCase();
    const emailFake = uFormatado + dominioFalso;

    db.ref('nicksReservados/' + idJogador).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                alert(`O Nome "${displayName}" já está em uso! Escolha outro.`);
            } else {
                return auth.createUserWithEmailAndPassword(emailFake, pass)
                    .then((userCredential) => {
                        return userCredential.user.updateProfile({
                            displayName: displayName
                        }).then(() => {
                            return db.ref('nicksReservados/' + idJogador).set(user);
                        });
                    });
            }
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                alert("Esse USUÁRIO de login já existe! Escolha outro.");
            } else if (error.code === 'auth/weak-password') {
                alert("A senha precisa ter no mínimo 6 dígitos.");
            } else {
                alert("Erro ao criar conta: " + error.message);
            }
        });
});

btnLogin.addEventListener('click', () => {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if(user && pass) {
        const uFormatado = user.replace(/\s+/g, '').toLowerCase();
        const emailFake = uFormatado + dominioFalso;
        
        auth.signInWithEmailAndPassword(emailFake, pass)
            .catch(() => {
                alert("Usuário ou senha incorretos!");
            });
    } else {
        alert("Preencha o Usuário e a Senha!");
    }
});

btnDeslogar.addEventListener('click', () => {
    auth.signOut();
});

btnIniciarJogo.addEventListener('click', () => {
    telaLogin.style.display = 'none';
    
    jorge.y = 150;
    jorge.velocidade = 0;
    canos = [];
    framesDesdeUltimoCano = 0;
    pontuacao = 0;
    velocidadeCanos = 2;
    jogoAcabou = false;
    jogoIniciado = true;
    
    somPulo.play().catch(()=>{});
    somPulo.pause();
    somPulo.currentTime = 0;
    musicaFundo.currentTime = 0;
    musicaFundo.play().catch(()=>{});

    gameLoop();
});

// --- CONTROLES E FÍSICA ---
function pular() {
    if (!jogoIniciado) return; 

    if (jogoAcabou) {
        salvarPontuacaoFirebase();
        
        telaLogin.style.display = 'flex';
        boxLogin.style.display = 'none';
        boxRegistro.style.display = 'none';
        boxPlay.style.display = 'flex';
        
        jogoAcabou = false;
        jogoIniciado = false;
        
        musicaFundo.pause();
        musicaFundo.currentTime = 0;
        return;
    }
    
    jorge.velocidade = jorge.forcaPulo;
    somPulo.currentTime = 0;
    somPulo.play().catch(()=>{}); 
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
                
                if (!jogoAcabou) { somBateu.play().catch(()=>{}); }
                jogoAcabou = true;
            }
        }

        if (cano.x + larguraCano < jorge.x && !cano.passou) {
            pontuacao++;
            cano.passou = true;
            somPonto.currentTime = 0;
            somPonto.play().catch(()=>{}); 
            if (velocidadeCanos < velocidadeMaxima) { velocidadeCanos += 0.15; }
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
        if (!jogoAcabou) { somBateu.play().catch(()=>{}); }
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

function gameLoop() {
    if (!jogoIniciado) return; 

    if (imagemFundo.complete && imagemFundo.naturalHeight !== 0) {
        ctx.drawImage(imagemFundo, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!jogoAcabou) {
        atualizarFisica();
        gerenciarCanos(); 
        desenharJorge();
        desenharPlacar();
        requestAnimationFrame(gameLoop);
    } else {
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
    }
}

// Eventos de clique e toque
canvas.addEventListener('mousedown', pular);
canvas.addEventListener('touchstart', function(e) { e.preventDefault(); pular(); }, { passive: false });
document.addEventListener('keydown', function(e) { if(e.code === 'Space') { e.preventDefault(); pular(); } });
