// Importando funções do SDK Modular do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGoFC1kncfLymg7ioHTNTM88mTeTV-2zA",
  authDomain: "site-institucional-e-blog.firebaseapp.com",
  databaseURL: "https://site-institucional-e-blog-default-rtdb.firebaseio.com",
  projectId: "site-institucional-e-blog",
  storageBucket: "site-institucional-e-blog.firebasestorage.app",
  messagingSenderId: "359592005429",
  appId: "1:359592005429:web:35fc6c2e299c8790a8067c"
};

// Inicializando o Firebase e Autenticação
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* =========================================================================
   CONFIGURAÇÕES GERAIS E ESTADOS DO SISTEMA
========================================================================= */
// TODO: Adicione aqui o SEU e-mail para ter permissões de excluir qualquer agendamento
const ADMIN_EMAILS = ["alessandroleonello2@gmail.com"]; 

// Variável que vai receber os dados do Firebase
let CONFIG_SISTEMA = null;

let currentUser = null;
let isAdmin = false;
let currentDate = new Date();
let todosAgendamentos = []; // Guarda TODOS os agendamentos na memória
let agendamentosDoDia = []; // Guarda os agendamentos do dia atual
let aulaSelecionada = null; // Guarda a aula sendo agendada no modal

/* =========================================================================
   CARREGAMENTO DE CONFIGURAÇÕES DO BANCO
========================================================================= */
async function carregarConfiguracoes() {
    const configPadrao = {
        salas: ["Laboratório de Informática 1", "Laboratório 2"],
        componentes: ["Matemática", "Português", "Ciências", "História", "Geografia", "Artes", "Robótica"],
        dispositivosMax: { notebooks: 30, tablets: 20, celulares: 40 },
        aulas: [
            { id: "aula_1", nome: "1ª Aula", horario: "07:00 - 07:50" },
            { id: "aula_2", nome: "2ª Aula", horario: "07:50 - 08:40" },
            { id: "aula_3", nome: "3ª Aula", horario: "08:40 - 09:30" },
            { id: "aula_4", nome: "4ª Aula", horario: "09:50 - 10:40" },
            { id: "aula_5", nome: "5ª Aula", horario: "10:40 - 11:30" },
            { id: "aula_6", nome: "6ª Aula", horario: "11:30 - 12:20" },
            { id: "aula_7", nome: "7ª Aula", horario: "13:30 - 14:20" },
            { id: "aula_8", nome: "8ª Aula", horario: "14:20 - 15:10" }
        ]
    };

    try {
        const docRef = doc(db, "configuracoes", "geral");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            CONFIG_SISTEMA = docSnap.data();
        } else {
            console.warn("Nenhuma configuração encontrada no banco. Usando dados padrão.");
            CONFIG_SISTEMA = configPadrao;
        }
    } catch (error) {
        console.error("Erro ao buscar configurações do sistema:", error);
        // Se der erro de permissão, usa o padrão para não quebrar a tela
        CONFIG_SISTEMA = configPadrao;
        alert("Erro de permissão no Firebase. As configurações padrão foram carregadas. Verifique as Regras de Segurança do Firestore.");
    }
}

/* =========================================================================
   CAPTURA DE ELEMENTOS DO DOM
========================================================================= */
const ui = {
    login: document.getElementById('login-container'),
    home: document.getElementById('home-container'),
    btnGoogle: document.getElementById('google-login-btn'),
    btnLogout: document.getElementById('logout-btn'),
    userName: document.getElementById('user-name'),
    userPhoto: document.getElementById('user-photo'),
    userRole: document.getElementById('user-role'),
    dateDisplay: document.getElementById('current-date-display'),
    btnPrint: document.getElementById('btn-print'),
    btnPrevDate: document.getElementById('prev-day-btn'),
    btnNextDate: document.getElementById('next-day-btn'),
    tbody: document.getElementById('schedule-tbody'),
    modal: document.getElementById('booking-modal'),
    btnCloseModal: document.getElementById('close-modal-btn'),
    form: document.getElementById('booking-form'),
    modalAulaInfo: document.getElementById('modal-aula-info'),
    // Admin Elements
    adminContainer: document.getElementById('admin-container'),
    btnAdminPanel: document.getElementById('btn-admin-panel'),
    btnAdminBack: document.getElementById('btn-admin-back'),
    btnAdminSave: document.getElementById('btn-admin-save'),
    adminNotes: document.getElementById('admin-notes'),
    adminTabs: document.getElementById('admin-tabs'),
    adminCels: document.getElementById('admin-cels'),
    adminSalas: document.getElementById('admin-salas'),
    adminComps: document.getElementById('admin-componentes'),
    adminAulas: document.getElementById('admin-aulas')
};

/* =========================================================================
   AUTENTICAÇÃO
========================================================================= */
ui.btnGoogle.addEventListener('click', async () => {
    const btn = ui.btnGoogle;
    btn.textContent = "Redirecionando...";
    btn.disabled = true;
    try {
        await signInWithRedirect(auth, provider);
    } catch (error) {
        console.error("Erro no login:", error);
        btn.textContent = "Entrar com o Google";
        btn.disabled = false;
    }
});
ui.btnLogout.addEventListener('click', () => signOut(auth));

// Aciona o recurso nativo de impressão/geração de PDF do navegador
ui.btnPrint.addEventListener('click', () => {
    window.print();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAdmin = ADMIN_EMAILS.includes(user.email);
        
        ui.userName.textContent = user.displayName;
        ui.userPhoto.src = user.photoURL;
        ui.userPhoto.classList.remove('hidden');
        ui.userRole.textContent = isAdmin ? 'Administrador' : 'Professor';
        if(isAdmin) ui.userRole.classList.add('admin');

        if(isAdmin) {
            ui.btnAdminPanel.classList.remove('hidden');
        } else {
            ui.btnAdminPanel.classList.add('hidden');
        }

        ui.login.classList.add('hidden');
        ui.home.classList.remove('hidden');
        
        // Feedback visual na tabela enquanto carrega as configurações
        ui.tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 30px; color: #666;">Carregando dados do sistema...</td></tr>';

        // Espera carregar a configuração do sistema antes de renderizar a tabela
        await carregarConfiguracoes();

        atualizarDataUI();
        iniciarListenerAgendamentos();
    } else {
        currentUser = null;
        ui.login.classList.remove('hidden');
        ui.home.classList.add('hidden');
    }
});

/* =========================================================================
   PAINEL DE ADMINISTRAÇÃO
========================================================================= */
ui.btnAdminPanel.addEventListener('click', () => {
    ui.home.classList.add('hidden');
    ui.adminContainer.classList.remove('hidden');

    // Preenche os campos com a configuração atual
    ui.adminNotes.value = CONFIG_SISTEMA.dispositivosMax.notebooks;
    ui.adminTabs.value = CONFIG_SISTEMA.dispositivosMax.tablets;
    ui.adminCels.value = CONFIG_SISTEMA.dispositivosMax.celulares;
    ui.adminSalas.value = CONFIG_SISTEMA.salas.join('\n');
    ui.adminComps.value = CONFIG_SISTEMA.componentes.join('\n');
    ui.adminAulas.value = CONFIG_SISTEMA.aulas.map(a => `${a.nome} ; ${a.horario}`).join('\n');

    // Carrega a lista de professores que já usaram o sistema
    carregarUsuariosParaAdmin();
});

ui.btnAdminBack.addEventListener('click', () => {
    ui.adminContainer.classList.add('hidden');
    ui.home.classList.remove('hidden');
});

ui.btnAdminSave.addEventListener('click', async () => {
    const btn = ui.btnAdminSave;
    btn.textContent = "Salvando...";
    btn.disabled = true;

    const novasSalas = ui.adminSalas.value.split('\n').map(s => s.trim()).filter(s => s !== '');
    const novosComps = ui.adminComps.value.split('\n').map(c => c.trim()).filter(c => c !== '');
    const novasAulasStr = ui.adminAulas.value.split('\n').map(a => a.trim()).filter(a => a !== '');
    
    const novasAulas = novasAulasStr.map((linha, i) => {
        const partes = linha.split(';');
        return { id: `aula_${i+1}`, nome: (partes[0] || `Aula ${i+1}`).trim(), horario: (partes[1] || '').trim() };
    });

    const novaConfig = {
        salas: novasSalas,
        componentes: novosComps,
        aulas: novasAulas,
        dispositivosMax: {
            notebooks: parseInt(ui.adminNotes.value) || 0,
            tablets: parseInt(ui.adminTabs.value) || 0,
            celulares: parseInt(ui.adminCels.value) || 0
        }
    };

    try {
        // Sobrescreve (ou cria) o documento "geral" na coleção "configuracoes"
        await setDoc(doc(db, "configuracoes", "geral"), novaConfig);
        CONFIG_SISTEMA = novaConfig; // Atualiza localmente
        alert("Configurações salvas com sucesso!");
        renderizarTabela(); // Atualiza a tabela imediatamente
    } catch (error) {
        console.error("Erro ao salvar config:", error);
        alert("Erro ao salvar configurações.");
    } finally {
        btn.textContent = "Salvar Configurações no Banco de Dados";
        btn.disabled = false;
    }
});

async function carregarUsuariosParaAdmin() {
    ui.adminUsersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#666;">Carregando usuários...</td></tr>';
    try {
        const usersSnap = await getDocs(collection(db, "usuarios"));
        ui.adminUsersTbody.innerHTML = '';
        
        usersSnap.forEach(docSnap => {
            const u = docSnap.data();
            const tr = document.createElement('tr');
            const isSuperAdmin = ADMIN_EMAILS.includes(u.email);
            
            let acaoHtml = '';
            if (isSuperAdmin) {
                acaoHtml = '<span style="color: #999; font-size:12px;">Super Admin (Fixo)</span>';
            } else if (u.role === 'admin') {
                acaoHtml = `<button class="btn-secondary" style="font-size:12px; padding:5px 10px;" onclick="alterarNivelUsuario('${docSnap.id}', 'user', this)">Rebaixar para Professor</button>`;
            } else {
                acaoHtml = `<button class="btn-secondary" style="font-size:12px; padding:5px 10px;" onclick="alterarNivelUsuario('${docSnap.id}', 'admin', this)">Promover a Admin</button>`;
            }

            tr.innerHTML = `
                <td style="display:flex; align-items:center; gap:10px;"><img src="${u.foto}" width="30" height="30" style="border-radius:50%; object-fit:cover;"> ${u.nome}</td>
                <td>${u.email}</td>
                <td><span class="badge ${u.role === 'admin' ? 'admin' : ''}">${u.role === 'admin' ? 'Administrador' : 'Professor'}</span></td>
                <td>${acaoHtml}</td>
            `;
            ui.adminUsersTbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        ui.adminUsersTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao carregar usuários. Verifique as regras do Firebase.</td></tr>';
    }
}

/* =========================================================================
   NAVEGAÇÃO DE DATAS E RENDERIZAÇÃO
========================================================================= */
function formatDateParaBanco(date) {
    // Retorna "YYYY-MM-DD" no fuso local
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function atualizarDataUI() {
    const opcoes = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
    ui.dateDisplay.textContent = currentDate.toLocaleDateString('pt-BR', opcoes);
}

ui.btnPrevDate.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    atualizarDataUI();
    carregarAgendamentosDoDia();
});

ui.btnNextDate.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    atualizarDataUI();
    carregarAgendamentosDoDia();
});

/* =========================================================================
   BANCO DE DADOS E TABELA
========================================================================= */
function iniciarListenerAgendamentos() {
    // Baixa todos os agendamentos e os mantém atualizados em tempo real na memória
    onSnapshot(collection(db, "agendamentos"), (snapshot) => {
        todosAgendamentos = [];
        snapshot.forEach((doc) => {
            todosAgendamentos.push({ id: doc.id, ...doc.data() });
        });
        // Sempre que houver uma atualização no banco, atualiza a tela atual
        carregarAgendamentosDoDia();
    });
}

function carregarAgendamentosDoDia() {
    const dataString = formatDateParaBanco(currentDate);
    const dataFixo = `FIXO-${currentDate.getDay()}`; // Pega o dia da semana de 0 (Dom) a 6 (Sáb)

    // Filtra localmente de forma ultra-rápida (instantânea)
    agendamentosDoDia = todosAgendamentos.filter(ag => {
        if (ag.data !== dataString && ag.data !== dataFixo) return false;
        // Se for um agendamento fixo, mas a data de hoje estiver nas "exceções", ele ignora
        if (ag.isFixo && ag.excecoes && ag.excecoes.includes(dataString)) return false;
        return true;
    });

    renderizarTabela();
}

function renderizarTabela() {
    ui.tbody.innerHTML = '';

    CONFIG_SISTEMA.aulas.forEach(aula => {
        const tr = document.createElement('tr');
        
        // Coluna 1: Aula e Horário
        const tdInfo = document.createElement('td');
        tdInfo.innerHTML = `${aula.nome}<br><small style="color:#666">${aula.horario}</small>`;
        tr.appendChild(tdInfo);

        // Coluna 2: Agendamentos
        const tdAgendamentos = document.createElement('td');
        const agendamentosDestaAula = agendamentosDoDia.filter(ag => ag.aulaId === aula.id);
        
        agendamentosDestaAula.forEach(ag => {
            const card = document.createElement('div');
            card.className = 'booking-card';
            
            let devicesHtml = '';
            if(ag.notebooks > 0) devicesHtml += `<span class="detail-badge">💻 ${ag.notebooks} Note</span>`;
            if(ag.tablets > 0) devicesHtml += `<span class="detail-badge">📱 ${ag.tablets} Tab</span>`;
            if(ag.celulares > 0) devicesHtml += `<span class="detail-badge">📱 ${ag.celulares} Cel</span>`;
            
            const podeDeletar = isAdmin || ag.uid === currentUser.uid;
            const deleteBtn = podeDeletar ? `<button class="btn-delete" onclick="deletarAgendamento('${ag.id}', this)">X</button>` : '';

            card.innerHTML = `
                <div class="booking-info">
                    <strong>${ag.professorNome} ${ag.isFixo ? '🔁' : ''}</strong>
                    <div class="booking-details">
                        <span class="detail-badge">${ag.sala} - ${ag.componente}</span>
                        ${ag.salaMaker ? `<span class="detail-badge maker">🛠 Sala Maker</span>` : ''}
                        ${ag.isFixo ? `<span class="detail-badge fixo">Fixo</span>` : ''}
                        ${devicesHtml}
                    </div>
                </div>
                ${deleteBtn}
            `;
            tdAgendamentos.appendChild(card);
        });
        
        if(agendamentosDestaAula.length === 0) {
            tdAgendamentos.innerHTML = '<span style="color:#999; font-style:italic">Livre</span>';
        }
        tr.appendChild(tdAgendamentos);

        // Coluna 3: Ação (Botão +)
        const tdAcao = document.createElement('td');
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add';
        btnAdd.innerHTML = '+';
        btnAdd.onclick = () => abrirModalAgendamento(aula);
        tdAcao.appendChild(btnAdd);

        tr.appendChild(tdAcao);
        ui.tbody.appendChild(tr);
    });
}

/* =========================================================================
   MODAL E AGENDAMENTO
========================================================================= */
function abrirModalAgendamento(aula) {
    aulaSelecionada = aula;
    
    // Cálculos de disponibilidade baseados nos agendamentos JÁ FEITOS para esta aula hoje
    const agsDaAula = agendamentosDoDia.filter(ag => ag.aulaId === aula.id);
    
    let makerOcupada = agsDaAula.some(ag => ag.salaMaker === true);
    let notesUsados = agsDaAula.reduce((acc, ag) => acc + (ag.notebooks || 0), 0);
    let tabsUsados = agsDaAula.reduce((acc, ag) => acc + (ag.tablets || 0), 0);
    let celsUsados = agsDaAula.reduce((acc, ag) => acc + (ag.celulares || 0), 0);

    let notesDisp = CONFIG_SISTEMA.dispositivosMax.notebooks - notesUsados;
    let tabsDisp = CONFIG_SISTEMA.dispositivosMax.tablets - tabsUsados;
    let celsDisp = CONFIG_SISTEMA.dispositivosMax.celulares - celsUsados;

    ui.modalAulaInfo.innerHTML = `Agendando para: <strong>${aula.nome} (${aula.horario})</strong> no dia ${currentDate.toLocaleDateString()}`;

    // Opção exclusiva para administradores de criar agendamento fixo
    const diaSemanaNome = currentDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const checkboxFixo = isAdmin ? `
        <div class="checkbox-group" style="background: #fff3cd; padding: 10px; border-radius: 5px; border: 1px solid #ffeeba;">
            <input type="checkbox" id="input-fixo">
            <label for="input-fixo" style="color: #856404; font-weight: bold; margin: 0;">
                🔁 Agendamento Fixo (Toda ${diaSemanaNome})
            </label>
        </div>
    ` : '';

    // Opção exclusiva para administradores: alterar o nome do professor
    const inputNomeProfessor = isAdmin ? `
        <div class="form-group">
            <label>Professor(a)</label>
            <input type="text" id="input-prof-nome" value="${currentUser.displayName}" required>
        </div>
    ` : '';

    // Construindo o formulário dinamicamente para ter os selects sempre atualizados
    ui.form.innerHTML = `
        ${inputNomeProfessor}
        <div class="form-group">
            <label>Sala de Destino</label>
            <select id="input-sala" required>
                <option value="">Selecione a sala...</option>
                ${CONFIG_SISTEMA.salas.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Componente Curricular</label>
            <select id="input-comp" required>
                <option value="">Selecione...</option>
                ${CONFIG_SISTEMA.componentes.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
        </div>
        
        <div class="checkbox-group">
            <input type="checkbox" id="input-maker" ${makerOcupada ? 'disabled' : ''}>
            <label for="input-maker">
                Utilizar Sala Maker ${makerOcupada ? '(Já reservada por outro professor nesta aula)' : ''}
            </label>
        </div>

        <label style="display:block; font-weight:bold; margin-bottom:10px;">Dispositivos Disponíveis:</label>
        <div class="devices-grid">
            <div class="form-group device-item">
                <label>Notebooks (Máx: ${notesDisp})</label>
                <input type="number" id="input-notes" min="0" max="${notesDisp}" value="0">
            </div>
            <div class="form-group device-item">
                <label>Tablets (Máx: ${tabsDisp})</label>
                <input type="number" id="input-tabs" min="0" max="${tabsDisp}" value="0">
            </div>
            <div class="form-group device-item">
                <label>Celulares (Máx: ${celsDisp})</label>
                <input type="number" id="input-cels" min="0" max="${celsDisp}" value="0">
            </div>
        </div>
        
        ${checkboxFixo}

        <button type="submit" style="width: 100%;">Confirmar Agendamento</button>
    `;

    ui.modal.classList.remove('hidden');
}

ui.btnCloseModal.addEventListener('click', () => {
    ui.modal.classList.add('hidden');
});

ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = ui.form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
        // Se o admin marcou como fixo, a data vira "FIXO-diaDaSemana". Senão, vira a data normal.
        const checkFixo = document.getElementById('input-fixo');
        const isFixoAdmin = isAdmin && checkFixo && checkFixo.checked;
        const dataFormatada = isFixoAdmin ? `FIXO-${currentDate.getDay()}` : formatDateParaBanco(currentDate);
        
        // Se for admin, pega o nome digitado. Se for professor, usa o nome do perfil logado.
        const nomeDoProfessor = isAdmin ? document.getElementById('input-prof-nome').value : currentUser.displayName;

        // Criando o documento do agendamento
        await addDoc(collection(db, "agendamentos"), {
            data: dataFormatada,
            isFixo: isFixoAdmin || false,
            aulaId: aulaSelecionada.id,
            uid: currentUser.uid,
            professorNome: nomeDoProfessor,
            sala: document.getElementById('input-sala').value,
            componente: document.getElementById('input-comp').value,
            salaMaker: document.getElementById('input-maker').checked,
            notebooks: parseInt(document.getElementById('input-notes').value) || 0,
            tablets: parseInt(document.getElementById('input-tabs').value) || 0,
            celulares: parseInt(document.getElementById('input-cels').value) || 0,
            criadoEm: new Date().toISOString()
        });

        ui.modal.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao agendar:", error);
        alert("Erro ao realizar o agendamento. Tente novamente.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Confirmar Agendamento";
    }
});

// Expondo função para o escopo global (já que o botão X é renderizado via string no innerHTML)
window.deletarAgendamento = async function(idAgendamento, btnElement) {
    const agendamento = agendamentosDoDia.find(a => a.id === idAgendamento);
    if (!agendamento) return;

    if (agendamento.isFixo) {
        const resp = prompt("Este é um agendamento FIXO.\n\nDigite 1 para cancelar APENAS a aula de hoje.\nDigite 2 para cancelar TODAS as repetições futuras e passadas.\n\n(Deixe em branco ou clique em Cancelar para sair)");
        
        if (resp === '1') {
            btnElement.textContent = "...";
            btnElement.disabled = true;
            try {
                const dataString = formatDateParaBanco(currentDate);
                // Adiciona o dia de hoje no array de exceções desse agendamento
                await updateDoc(doc(db, "agendamentos", idAgendamento), {
                    excecoes: arrayUnion(dataString)
                });
            } catch (error) {
                console.error("Erro ao criar exceção:", error);
                alert("Erro ao cancelar o agendamento para o dia de hoje.");
                btnElement.textContent = "X";
                btnElement.disabled = false;
            }
        } else if (resp === '2') {
            if (confirm("Tem certeza que deseja APAGAR COMPLETAMENTE esse agendamento do sistema?")) {
                executarDelecao(idAgendamento, btnElement);
            }
        }
    } else {
        if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
            executarDelecao(idAgendamento, btnElement);
        }
    }
}

async function executarDelecao(idAgendamento, btnElement) {
    btnElement.textContent = "...";
    btnElement.disabled = true;
    try {
        await deleteDoc(doc(db, "agendamentos", idAgendamento));
    } catch(error) {
        console.error("Erro ao deletar:", error);
        alert("Erro ao cancelar agendamento.");
        btnElement.textContent = "X";
        btnElement.disabled = false;
    }
}

window.alterarNivelUsuario = async function(uid, novoRole, btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = "...";
    try {
        await updateDoc(doc(db, "usuarios", uid), { role: novoRole });
        carregarUsuariosParaAdmin(); // Recarrega a tabela visualmente após sucesso
    } catch (error) {
        console.error("Erro ao atualizar nível:", error);
        alert("Erro ao alterar permissão.");
        btnElement.disabled = false;
    }
}