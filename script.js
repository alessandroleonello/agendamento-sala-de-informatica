// Importando módulos locais (Modularização)
import { auth, db, provider } from './firebase-setup.js';
import { ui } from './ui.js';
import './admin.js'; // Inicializa os eventos do painel de administração

// Importando funções específicas do Firebase que usamos neste arquivo
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


/* =========================================================================
   CONFIGURAÇÕES GERAIS E ESTADOS DO SISTEMA
========================================================================= */
// TODO: Adicione aqui o SEU e-mail para ter permissões de excluir qualquer agendamento
export const ADMIN_EMAILS = ["alessandroleonello2@gmail.com"]; 

// Variável que vai receber os dados do Firebase
export let CONFIG_SISTEMA = null;
export function setConfigSistema(novaConfig) {
    CONFIG_SISTEMA = novaConfig;
}

let currentUser = null;
let isAdmin = false;
let currentDate = new Date();
let todosAgendamentos = []; // Guarda TODOS os agendamentos na memória
let agendamentosDoDia = []; // Guarda os agendamentos do dia atual
let aulaSelecionada = null; // Guarda a aula sendo agendada no modal
let agendamentoEmEdicao = null; // Guarda o agendamento caso seja edição
let unsubscribeAgendamentos = null; // Controle do listener do Firebase para evitar vazamento de memória

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
        Swal.fire("Aviso", "Erro de permissão no Firebase. As configurações padrão foram carregadas. Verifique as Regras de Segurança do Firestore.", "warning");
    }
}

/* =========================================================================
   AUTENTICAÇÃO
========================================================================= */

// Previne que o usuário clique em login antes do Firebase restaurar a sessão do F5
ui.btnGoogle.textContent = "Verificando sessão...";
ui.btnGoogle.disabled = true;

ui.btnGoogle.addEventListener('click', async () => {
    const btn = ui.btnGoogle;
    btn.textContent = "Aguardando login...";
    btn.disabled = true;
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Erro no login:", error);
        Swal.fire("Erro", "Falha no login: " + error.message, "error");
        btn.textContent = "Entrar com o Google";
        btn.disabled = false;
    }
});
ui.btnLogout.addEventListener('click', () => signOut(auth));

// Substitui a impressão da tela padrão por um relatório formal
ui.btnPrint.addEventListener('click', gerarRelatorioPDF);

function gerarRelatorioPDF() {
    ui.loadingOverlay.classList.remove('hidden');
    ui.loadingText.textContent = "Gerando documento para impressão...";

    const dataFormatada = currentDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Agendamentos - ${dataFormatada}</title>
            <style>
                @page { margin: 15mm; size: A4 portrait; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; }
                .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
                .header img { max-width: 120px; margin-bottom: 10px; }
                .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #222; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #555; text-transform: capitalize; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
                th, td { border: 1px solid #666; padding: 8px 10px; text-align: left; }
                th { background-color: #e9ecef; font-weight: bold; text-transform: uppercase; font-size: 11px; }
                .aula-nome { font-weight: bold; font-size: 14px;}
                .livre { color: #888; font-style: italic; text-align: center; }
                .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #777; }
                .assinatura { margin-top: 60px; width: 250px; border-top: 1px solid #000; margin-left: auto; margin-right: auto; text-align: center; padding-top: 5px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="https://i.ibb.co/jPCXD3h1/pei-lurdita.jpg" alt="Logo da Escola">
                <h1>Agendamento - Sala de Informática</h1>
                <p>${dataFormatada}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="15%">Aula / Horário</th>
                        <th width="25%">Professor</th>
                        <th width="30%">Sala / Componente</th>
                        <th width="30%">Recursos Utilizados</th>
                    </tr>
                </thead>
                <tbody>
    `;

    CONFIG_SISTEMA.aulas.forEach(aula => {
        const ags = agendamentosDoDia.filter(a => a.aulaId === aula.id);
        // Ordena para que a Sala Maker apareça primeiro, mantendo o padrão da tela principal
        ags.sort((a, b) => (b.salaMaker ? 1 : 0) - (a.salaMaker ? 1 : 0));

        if (ags.length === 0) {
            html += `
                <tr>
                    <td><span class="aula-nome">${aula.nome}</span><br><small>${aula.horario}</small></td>
                    <td colspan="3" class="livre">Nenhum agendamento (Livre)</td>
                </tr>
            `;
        } else {
            ags.forEach((ag, index) => {
                const profNome = escapeHTML(ag.professorNome);
                const sala = escapeHTML(ag.sala);
                const comp = escapeHTML(ag.componente);
                
                let recursos = [];
                if(ag.salaMaker) recursos.push("🛠 Sala Maker");
                if(ag.notebooks > 0) recursos.push(`💻 ${ag.notebooks} Note`);
                if(ag.tablets > 0) recursos.push(`📱 ${ag.tablets} Tab`);
                if(ag.celulares > 0) recursos.push(`📱 ${ag.celulares} Cel`);
                if(ag.isFixo) recursos.push("🔁 Fixo");
                
                const recursosStr = recursos.length > 0 ? recursos.join(" | ") : "Apenas a sala";

                if (index === 0) {
                    html += `
                        <tr>
                            <td rowspan="${ags.length}"><span class="aula-nome">${aula.nome}</span><br><small>${aula.horario}</small></td>
                            <td><strong>${profNome}</strong></td>
                            <td>${sala}<br><small>${comp}</small></td>
                            <td>${recursosStr}</td>
                        </tr>
                    `;
                } else {
                    html += `
                        <tr>
                            <td><strong>${profNome}</strong></td>
                            <td>${sala}<br><small>${comp}</small></td>
                            <td>${recursosStr}</td>
                        </tr>
                    `;
                }
            });
        }
    });

    html += `
                </tbody>
            </table>
            <div class="assinatura">
                Assinatura do Responsável
            </div>
            <div class="footer">
                Documento gerado pelo Sistema de Agendamento em ${new Date().toLocaleString('pt-BR')}
            </div>
        </body>
        </html>
    `;

    // Em celulares, a impressão via iframe oculto costuma ser ignorada pelo navegador.
    // Usamos a detecção do dispositivo para decidir se abrimos uma nova aba ou usamos o iframe.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            
            setTimeout(() => {
                ui.loadingOverlay.classList.add('hidden');
                printWindow.focus();
                printWindow.print();
            }, 1500);
        } else {
            ui.loadingOverlay.classList.add('hidden');
            Swal.fire("Aviso", "Por favor, permita a abertura de pop-ups no seu navegador para visualizar o relatório.", "warning");
        }
    } else {
        // Criar uma janela oculta no corpo do site para computadores
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        // Aguarda um segundo e meio para garantir que o computador fez o download da imagem do logo antes de imprimir
        setTimeout(() => {
            ui.loadingOverlay.classList.add('hidden');
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            // Remove a janela oculta depois que a impressão termina ou é fechada
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 10000);
        }, 1500);
    }
}

// Exporta os agendamentos da tela para o formato Excel (CSV)
ui.btnExportCsv.addEventListener('click', () => {
    let csvContent = "Aula;Horario;Professor;Sala;Componente;Recursos Utilizados\n";

    CONFIG_SISTEMA.aulas.forEach(aula => {
        const ags = agendamentosDoDia.filter(a => a.aulaId === aula.id);
        ags.sort((a, b) => (b.salaMaker ? 1 : 0) - (a.salaMaker ? 1 : 0));

        if (ags.length === 0) {
            csvContent += `${aula.nome};${aula.horario};Livre;;;\n`;
        } else {
            ags.forEach(ag => {
                let recursos = [];
                if(ag.salaMaker) recursos.push("Sala Maker");
                if(ag.notebooks > 0) recursos.push(`${ag.notebooks} Note`);
                if(ag.tablets > 0) recursos.push(`${ag.tablets} Tab`);
                if(ag.celulares > 0) recursos.push(`${ag.celulares} Cel`);
                if(ag.isFixo) recursos.push("Fixo");
                
                const recursosStr = recursos.length > 0 ? recursos.join(" | ") : "Apenas a sala";
                csvContent += `${aula.nome};${aula.horario};${ag.professorNome};${ag.sala};${ag.componente};${recursosStr}\n`;
            });
        }
    });

    // Adiciona o BOM do UTF-8 para o Excel abrir com acentuação correta
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `agendamentos_${formatDateParaBanco(currentDate)}.csv`;
    link.click();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        isAdmin = ADMIN_EMAILS.includes(user.email);
        
        // Validação de e-mail institucional
        const isInstitucional = user.email.endsWith('@prof.educacao.sp.gov.br');
        if (!isInstitucional && !isAdmin) {
            Swal.fire("Acesso Negado!", "Este sistema é de uso restrito. Por favor, faça login utilizando o seu e-mail institucional (@prof.educacao.sp.gov.br).", "error");
            await signOut(auth); // Desloga o usuário imediatamente
            return; // Interrompe o fluxo e impede o acesso ao sistema
        }

        currentUser = user;
        
        // Salvar/Atualizar o usuário no banco para aparecer no painel Admin
        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    nome: user.displayName,
                    email: user.email,
                    foto: user.photoURL,
                    role: isAdmin ? 'admin' : 'user'
                });
            } else {
                await setDoc(userRef, { nome: user.displayName, foto: user.photoURL }, { merge: true });
                // Se o usuário foi promovido a admin pelo painel, garante o acesso dele aqui
                if (userSnap.data().role === 'admin') {
                    isAdmin = true;
                }
            }
        } catch (error) {
            console.error("Erro ao sincronizar usuário no banco:", error);
        }

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
        if (unsubscribeAgendamentos) {
            unsubscribeAgendamentos();
            unsubscribeAgendamentos = null;
        }
        currentUser = null;
        ui.login.classList.remove('hidden');
        ui.home.classList.add('hidden');
        ui.btnGoogle.textContent = "Entrar com o Google";
        ui.btnGoogle.disabled = false;
    }
});

/* =========================================================================
   NAVEGAÇÃO DE DATAS E RENDERIZAÇÃO
========================================================================= */

// Prevenção contra ataques XSS (Cross-Site Scripting)
export function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateParaBanco(date) {
    // Retorna "YYYY-MM-DD" no fuso local
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function atualizarDataUI() {
    const opcoes = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
    ui.dateDisplay.innerHTML = `${currentDate.toLocaleDateString('pt-BR', opcoes)} <span style="font-size: 0.8em; margin-left: 5px;">📅</span>`;
    // Mantém o DatePicker sincronizado com as setinhas de navegação
    ui.datePicker.value = formatDateParaBanco(currentDate);
}

ui.btnPrevDate.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    atualizarDataUI();
    iniciarListenerAgendamentos();
});

ui.btnNextDate.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    atualizarDataUI();
    iniciarListenerAgendamentos();
});

ui.datePicker.addEventListener('click', (e) => {
    try {
        if (typeof e.target.showPicker === 'function') {
            e.target.showPicker(); // Força o calendário a abrir no computador
        }
    } catch (error) {}
});

ui.datePicker.addEventListener('change', (e) => {
    if (!e.target.value) return;
    // O valor do input date é sempre "YYYY-MM-DD"
    const [ano, mes, dia] = e.target.value.split('-');
    // Evita problema de fuso horário passando o ano, mês (0-11) e dia pro construtor do JS
    currentDate = new Date(ano, mes - 1, dia);
    
    atualizarDataUI();
    iniciarListenerAgendamentos();
});

ui.filterMyBookings.addEventListener('change', () => {
    renderizarTabela();
});

/* =========================================================================
   BANCO DE DADOS E TABELA
========================================================================= */
function iniciarListenerAgendamentos() {
    if (unsubscribeAgendamentos) {
        unsubscribeAgendamentos(); // Cancela a escuta do dia anterior para economizar banda
    }

    const dataString = formatDateParaBanco(currentDate);
    const dataFixo = `FIXO-${currentDate.getDay()}`;

    const q = query(
        collection(db, "agendamentos"), 
        where("data", "in", [dataString, dataFixo])
    );

    ui.tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 30px; color: #666;">Buscando agendamentos da data...</td></tr>';

    // Baixa APENAS os agendamentos da data que está na tela no momento
    unsubscribeAgendamentos = onSnapshot(q, (snapshot) => {
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

export function renderizarTabela() {
    ui.tbody.innerHTML = '';
    const mostrarApenasMeus = ui.filterMyBookings.checked;

    let linhasExibidas = 0;

    CONFIG_SISTEMA.aulas.forEach(aula => {
        const tr = document.createElement('tr');
        
        // Coluna 1: Aula e Horário
        const tdInfo = document.createElement('td');
        tdInfo.innerHTML = `${aula.nome}<br><small style="color:#666">${aula.horario}</small>`;
        tr.appendChild(tdInfo);

        // Coluna 2: Agendamentos
        const tdAgendamentos = document.createElement('td');
        const agendamentosDestaAula = agendamentosDoDia.filter(ag => ag.aulaId === aula.id);
        
        let agsParaMostrar = agendamentosDestaAula;
        if (mostrarApenasMeus) {
            agsParaMostrar = agsParaMostrar.filter(ag => ag.uid === currentUser.uid);
            
            // Se o filtro estiver ativo e o professor não tiver agendamento nesta aula, oculta a linha inteira
            if (agsParaMostrar.length === 0) return;
        }

        linhasExibidas++;

        // Ordena para que a Sala Maker apareça sempre primeiro
        agsParaMostrar.sort((a, b) => (b.salaMaker ? 1 : 0) - (a.salaMaker ? 1 : 0));

        agsParaMostrar.forEach(ag => {
            // Limpando os textos para evitar injeção de códigos maliciosos
            const profNomeSeguro = escapeHTML(ag.professorNome);
            const salaSegura = escapeHTML(ag.sala);
            const compSeguro = escapeHTML(ag.componente);

            const card = document.createElement('div');
            card.className = 'booking-card';
            
            let devicesHtml = '';
            if(ag.notebooks > 0) devicesHtml += `<span class="detail-badge">💻 ${ag.notebooks} Note</span>`;
            if(ag.tablets > 0) devicesHtml += `<span class="detail-badge">📱 ${ag.tablets} Tab</span>`;
            if(ag.celulares > 0) devicesHtml += `<span class="detail-badge">📱 ${ag.celulares} Cel</span>`;
            
            const podeDeletar = isAdmin || ag.uid === currentUser.uid;
            const btnEdit = podeDeletar ? `<button class="btn-edit" onclick="editarAgendamento('${ag.id}')" title="Editar">✏️</button>` : '';
            const deleteBtn = podeDeletar ? `<button class="btn-delete" onclick="deletarAgendamento('${ag.id}', this)">X</button>` : '';

            card.innerHTML = `
                <div class="booking-info">
                    <strong>${profNomeSeguro} ${ag.isFixo ? '🔁' : ''}</strong>
                    <div class="booking-details">
                        <span class="detail-badge">${salaSegura} - ${compSeguro}</span>
                        ${ag.salaMaker ? `<span class="detail-badge maker">🛠 Sala Maker</span>` : ''}
                        ${ag.isFixo ? `<span class="detail-badge fixo">Fixo</span>` : ''}
                        ${devicesHtml}
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    ${btnEdit}
                    ${deleteBtn}
                </div>
            `;
            tdAgendamentos.appendChild(card);
        });
        
        if(agsParaMostrar.length === 0) {
            tdAgendamentos.innerHTML = '<span style="color:#999; font-style:italic">Livre</span>';
        }
        tr.appendChild(tdAgendamentos);

        // Coluna 3: Ação (Botão +)
        const tdAcao = document.createElement('td');
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add';
        btnAdd.innerHTML = '+';
        btnAdd.onclick = () => {
            agendamentoEmEdicao = null; // Garante que é um NOVO agendamento
            abrirModalAgendamento(aula);
        };
        tdAcao.appendChild(btnAdd);

        tr.appendChild(tdAcao);
        ui.tbody.appendChild(tr);
    });

    if (mostrarApenasMeus && linhasExibidas === 0) {
        ui.tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 30px; color: #666; font-style: italic;">Você não possui nenhum agendamento neste dia.</td></tr>';
    }
}

/* =========================================================================
   MODAL E AGENDAMENTO
========================================================================= */
function abrirModalAgendamento(aula) {
    aulaSelecionada = aula;
    
    ui.modalTitle.textContent = agendamentoEmEdicao ? "Editar Agendamento" : "Novo Agendamento";

    // Cálculos de disponibilidade baseados nos agendamentos JÁ FEITOS para esta aula hoje
    const agsDaAula = agendamentosDoDia.filter(ag => ag.aulaId === aula.id);
    
    let makerOcupada = agsDaAula.some(ag => ag.salaMaker === true);
    let notesUsados = agsDaAula.reduce((acc, ag) => acc + (ag.notebooks || 0), 0);
    let tabsUsados = agsDaAula.reduce((acc, ag) => acc + (ag.tablets || 0), 0);
    let celsUsados = agsDaAula.reduce((acc, ag) => acc + (ag.celulares || 0), 0);
    
    // Mapeia quais salas físicas já foram escolhidas nesta aula
    let salasOcupadas = agsDaAula.map(ag => ag.sala);

    // Se estiver editando, devolvemos os dispositivos/sala do agendamento atual para a conta de disponibilidade
    if (agendamentoEmEdicao) {
        notesUsados -= (agendamentoEmEdicao.notebooks || 0);
        tabsUsados -= (agendamentoEmEdicao.tablets || 0);
        celsUsados -= (agendamentoEmEdicao.celulares || 0);
        makerOcupada = agsDaAula.some(ag => ag.id !== agendamentoEmEdicao.id && ag.salaMaker === true);
        
        // Remove a sala que estamos editando da lista de salas ocupadas para permitir mantê-la
        const indexSala = salasOcupadas.indexOf(agendamentoEmEdicao.sala);
        if (indexSala > -1) salasOcupadas.splice(indexSala, 1);
    }

    let notesDisp = CONFIG_SISTEMA.dispositivosMax.notebooks - notesUsados;
    let tabsDisp = CONFIG_SISTEMA.dispositivosMax.tablets - tabsUsados;
    let celsDisp = CONFIG_SISTEMA.dispositivosMax.celulares - celsUsados;

    ui.modalAulaInfo.innerHTML = `${agendamentoEmEdicao ? 'Editando agendamento' : 'Criando agendamento(s)'} para o dia <strong>${currentDate.toLocaleDateString()}</strong>`;

    // Se estiver editando ou NÃO for admin, bloqueia a seleção múltipla.
    const checkboxesAulas = (agendamentoEmEdicao || !isAdmin) 
        ? `<div class="form-group">
            <label>Aula</label>
            <input type="text" value="${aula.nome} (${aula.horario})" disabled style="background: #e9ecef; cursor: not-allowed;">
           </div>`
        : `<div class="form-group">
            <label>Aulas para agendar simultaneamente</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8f9fa; padding: 10px; border-radius: 5px; border: 1px solid var(--border-color);">
                ${CONFIG_SISTEMA.aulas.map(a => `
                    <label style="display: flex; align-items: center; gap: 5px; font-weight: normal; font-size: 13px; cursor: pointer; margin: 0;">
                        <input type="checkbox" name="aulas-multi" value="${a.id}" ${a.id === aula.id ? 'checked' : ''} style="width: 16px; height: 16px; margin: 0;">
                        ${a.nome}
                    </label>
                `).join('')}
            </div>
           </div>`;

    const preFixo = agendamentoEmEdicao && agendamentoEmEdicao.isFixo ? 'checked' : '';
    const preProf = agendamentoEmEdicao ? agendamentoEmEdicao.professorNome : currentUser.displayName;
    const preSala = agendamentoEmEdicao ? agendamentoEmEdicao.sala : '';
    const preComp = agendamentoEmEdicao ? agendamentoEmEdicao.componente : '';
    const preMaker = agendamentoEmEdicao && agendamentoEmEdicao.salaMaker ? 'checked' : '';
    const preNotes = agendamentoEmEdicao ? (agendamentoEmEdicao.notebooks || 0) : 0;
    const preTabs = agendamentoEmEdicao ? (agendamentoEmEdicao.tablets || 0) : 0;
    const preCels = agendamentoEmEdicao ? (agendamentoEmEdicao.celulares || 0) : 0;

    // Opção exclusiva para administradores de criar agendamento fixo
    const diaSemanaNome = currentDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const checkboxFixo = isAdmin ? `
        <div class="checkbox-group" style="background: #fff3cd; padding: 10px; border-radius: 5px; border: 1px solid #ffeeba;">
            <input type="checkbox" id="input-fixo" ${preFixo}>
            <label for="input-fixo" style="color: #856404; font-weight: bold; margin: 0;">
                🔁 Agendamento Fixo (Toda ${diaSemanaNome})
            </label>
        </div>
    ` : '';

    // Opção exclusiva para administradores: alterar o nome do professor
    const inputNomeProfessor = isAdmin ? `
        <div class="form-group">
            <label>Professor(a)</label>
            <input type="text" id="input-prof-nome" value="${preProf}" required>
        </div>
    ` : '';

    // Construindo o formulário dinamicamente para ter os selects sempre atualizados
    ui.form.innerHTML = `
        ${checkboxesAulas}
        ${inputNomeProfessor}
        <div class="form-group">
            <label>Sala de Destino</label>
            <select id="input-sala" required>
                <option value="">Selecione a sala...</option>
                ${CONFIG_SISTEMA.salas.map(s => {
                    const isOcupada = salasOcupadas.includes(s);
                    const selected = s === preSala ? 'selected' : '';
                    const disabled = isOcupada ? 'disabled' : '';
                    return `<option value="${s}" ${selected} ${disabled}>${isOcupada ? s + ' (Já ocupada)' : s}</option>`;
                }).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Componente Curricular</label>
            <select id="input-comp" required>
                <option value="">Selecione...</option>
                ${[...CONFIG_SISTEMA.componentes].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(c => `<option value="${c}" ${c === preComp ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>
        
        <div class="checkbox-group">
            <input type="checkbox" id="input-maker" ${preMaker} ${makerOcupada ? 'disabled' : ''}>
            <label for="input-maker">
                Utilizar Sala Maker ${makerOcupada ? '(Já reservada por outro professor nesta aula)' : ''}
            </label>
        </div>

        <label style="display:block; font-weight:bold; margin-bottom:10px;">Dispositivos Disponíveis:</label>
        <div class="devices-grid">
            <div class="form-group device-item">
                <label>Notebooks (Máx: ${notesDisp})</label>
                <input type="number" id="input-notes" min="0" max="${notesDisp}" value="${preNotes}">
            </div>
            <div class="form-group device-item">
                <label>Tablets (Máx: ${tabsDisp})</label>
                <input type="number" id="input-tabs" min="0" max="${tabsDisp}" value="${preTabs}">
            </div>
            <div class="form-group device-item">
                <label>Celulares (Máx: ${celsDisp})</label>
                <input type="number" id="input-cels" min="0" max="${celsDisp}" value="${preCels}">
            </div>
        </div>
        
        ${checkboxFixo}

        <button type="submit" style="width: 100%;">${agendamentoEmEdicao ? 'Salvar Alterações' : 'Confirmar Agendamento'}</button>
    `;

    ui.modal.classList.remove('hidden');
}

ui.btnCloseModal.addEventListener('click', () => {
    ui.modal.classList.add('hidden');
    agendamentoEmEdicao = null;
});

ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const qtdNotes = parseInt(document.getElementById('input-notes').value) || 0;
    const qtdTabs = parseInt(document.getElementById('input-tabs').value) || 0;
    const qtdCels = parseInt(document.getElementById('input-cels').value) || 0;

    if (qtdNotes === 0 && qtdTabs === 0 && qtdCels === 0) {
        Swal.fire("Atenção", "É necessário selecionar pelo menos 1 dispositivo (Notebook, Tablet ou Celular) para realizar o agendamento.", "warning");
        return; // Interrompe a execução aqui
    }

    const btn = ui.form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Salvando...";

    let aulasSelecionadasIds = [];
    if (agendamentoEmEdicao || !isAdmin) {
        aulasSelecionadasIds.push(aulaSelecionada.id);
    } else {
        const checkboxes = document.querySelectorAll('input[name="aulas-multi"]:checked');
        checkboxes.forEach(cb => aulasSelecionadasIds.push(cb.value));
    }

    if (aulasSelecionadasIds.length === 0) {
        Swal.fire("Atenção", "Selecione pelo menos uma aula.", "warning");
        btn.disabled = false;
        btn.textContent = agendamentoEmEdicao ? "Salvar Alterações" : "Confirmar Agendamento";
        return;
    }

    let acaoEdicaoFixo = null;
    if (agendamentoEmEdicao && agendamentoEmEdicao.isFixo) {
        const result = await Swal.fire({
            title: 'Editar Agendamento Fixo',
            text: 'Este é um agendamento FIXO. O que deseja alterar?',
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Apenas Hoje',
            denyButtonText: 'Todas as Repetições',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            acaoEdicaoFixo = 'hoje';
        } else if (result.isDenied) {
            acaoEdicaoFixo = 'todas';
        } else {
            btn.disabled = false;
            btn.textContent = "Salvar Alterações";
            return; // Interrompe caso ele desista de editar
        }
    }

    try {
        ui.loadingOverlay.classList.remove('hidden');
        ui.loadingText.textContent = "Verificando disponibilidade...";

        // Se o admin marcou como fixo, a data vira "FIXO-diaDaSemana". Senão, vira a data normal.
        const checkFixo = document.getElementById('input-fixo');
        let isFixoAdmin = isAdmin && checkFixo && checkFixo.checked;
        let dataFormatada = isFixoAdmin ? `FIXO-${currentDate.getDay()}` : formatDateParaBanco(currentDate);
        
        if (acaoEdicaoFixo === 'hoje') {
            isFixoAdmin = false;
            dataFormatada = formatDateParaBanco(currentDate);
        }

        // DOUBLE CHECK: Busca TODOS os agendamentos do dia atual para validar múltiplas aulas de uma vez
        const q = query(
            collection(db, "agendamentos"), 
            where("data", "in", [dataFormatada, `FIXO-${currentDate.getDay()}`])
        );
        const serverSnap = await getDocs(q);
        const agendamentosServidor = serverSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const salaEscolhida = document.getElementById('input-sala').value;
        const makerEscolhido = document.getElementById('input-maker').checked;

        // Valida disponibilidade para CADA aula selecionada individualmente
        for (const aulaId of aulasSelecionadasIds) {
            let serverNotes = 0, serverTabs = 0, serverCels = 0;
            let serverMaker = false, serverSalas = [];
            
            const agsAula = agendamentosServidor.filter(ag => ag.aulaId === aulaId);
            
            agsAula.forEach(ag => {
                if (agendamentoEmEdicao && ag.id === agendamentoEmEdicao.id) return;
                if (ag.isFixo && ag.excecoes && ag.excecoes.includes(formatDateParaBanco(currentDate))) return;
                
                serverNotes += (ag.notebooks || 0);
                serverTabs += (ag.tablets || 0);
                serverCels += (ag.celulares || 0);
                serverSalas.push(ag.sala);
                if (ag.salaMaker) serverMaker = true;
            });

            const nomeAula = CONFIG_SISTEMA.aulas.find(a => a.id === aulaId)?.nome || aulaId;

            if (serverSalas.includes(salaEscolhida)) throw new Error(`A sala ${salaEscolhida} já está reservada por outro professor na ${nomeAula}!`);
            if (makerEscolhido && serverMaker) throw new Error(`A Sala Maker já está reservada por outro professor na ${nomeAula}!`);
            if (serverNotes + qtdNotes > CONFIG_SISTEMA.dispositivosMax.notebooks) throw new Error(`Notebooks esgotados na ${nomeAula}! Restam apenas ${CONFIG_SISTEMA.dispositivosMax.notebooks - serverNotes}.`);
            if (serverTabs + qtdTabs > CONFIG_SISTEMA.dispositivosMax.tablets) throw new Error(`Tablets esgotados na ${nomeAula}! Restam apenas ${CONFIG_SISTEMA.dispositivosMax.tablets - serverTabs}.`);
            if (serverCels + qtdCels > CONFIG_SISTEMA.dispositivosMax.celulares) throw new Error(`Celulares esgotados na ${nomeAula}! Restam apenas ${CONFIG_SISTEMA.dispositivosMax.celulares - serverCels}.`);
        }

        ui.loadingText.textContent = "Salvando agendamento...";

        // Se for admin, pega o nome digitado. Se for professor, usa o nome do perfil logado.
        const nomeDoProfessor = isAdmin ? document.getElementById('input-prof-nome').value : currentUser.displayName;

        if (agendamentoEmEdicao) {
            if (acaoEdicaoFixo === 'hoje') {
                // 1. Adiciona exceção no original para ele não aparecer hoje
                await updateDoc(doc(db, "agendamentos", agendamentoEmEdicao.id), {
                    excecoes: arrayUnion(formatDateParaBanco(currentDate))
                });
                
                // 2. Cria um novo agendamento não-fixo apenas para hoje
                const dadosAgendamento = {
                    data: dataFormatada,
                    isFixo: false,
                    aulaId: aulasSelecionadasIds[0],
                    professorNome: nomeDoProfessor,
                    sala: salaEscolhida,
                    componente: document.getElementById('input-comp').value,
                    salaMaker: makerEscolhido,
                    notebooks: qtdNotes,
                    tablets: qtdTabs,
                    celulares: qtdCels,
                    uid: currentUser.uid,
                    criadoEm: new Date().toISOString()
                };
                await addDoc(collection(db, "agendamentos"), dadosAgendamento);
            } else {
                // Atualiza o documento existente normalmente
                const dadosAgendamento = {
                    data: dataFormatada,
                    isFixo: isFixoAdmin || false,
                    aulaId: aulasSelecionadasIds[0],
                    professorNome: nomeDoProfessor,
                    sala: salaEscolhida,
                    componente: document.getElementById('input-comp').value,
                    salaMaker: makerEscolhido,
                    notebooks: qtdNotes,
                    tablets: qtdTabs,
                    celulares: qtdCels,
                    editadoEm: new Date().toISOString()
                };
                await updateDoc(doc(db, "agendamentos", agendamentoEmEdicao.id), dadosAgendamento);
            }
        } else {
            // Cria um novo documento PARA CADA aula selecionada
            const promises = aulasSelecionadasIds.map(aulaId => {
                const dadosAgendamento = {
                    data: dataFormatada,
                    isFixo: isFixoAdmin || false,
                    aulaId: aulaId,
                    professorNome: nomeDoProfessor,
                    sala: salaEscolhida,
                    componente: document.getElementById('input-comp').value,
                    salaMaker: makerEscolhido,
                    notebooks: qtdNotes,
                    tablets: qtdTabs,
                    celulares: qtdCels,
                    uid: currentUser.uid,
                    criadoEm: new Date().toISOString()
                };
                return addDoc(collection(db, "agendamentos"), dadosAgendamento);
            });
            await Promise.all(promises);
        }

        ui.modal.classList.add('hidden');
        agendamentoEmEdicao = null; // Limpa estado de edição após sucesso
    } catch (error) {
        console.error("Erro ao agendar:", error);
        Swal.fire("Erro!", error.message || "Erro ao realizar o agendamento. Tente novamente.", "error");
    } finally {
        ui.loadingOverlay.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = agendamentoEmEdicao ? "Salvar Alterações" : "Confirmar Agendamento";
    }
});

// Expondo função global para o botão de editar renderizado dinamicamente
window.editarAgendamento = function(idAgendamento) {
    const agendamento = agendamentosDoDia.find(a => a.id === idAgendamento);
    if (!agendamento) return;

    const aula = CONFIG_SISTEMA.aulas.find(a => a.id === agendamento.aulaId);
    agendamentoEmEdicao = agendamento;
    abrirModalAgendamento(aula);
}

// Expondo função para o escopo global (já que o botão X é renderizado via string no innerHTML)
window.deletarAgendamento = async function(idAgendamento, btnElement) {
    const agendamento = agendamentosDoDia.find(a => a.id === idAgendamento);
    if (!agendamento) return;

    if (agendamento.isFixo) {
        const result = await Swal.fire({
            title: 'Agendamento Fixo',
            text: 'Este é um agendamento FIXO. O que deseja cancelar?',
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Apenas Hoje',
            denyButtonText: 'Todas as Repetições',
            cancelButtonText: 'Sair'
        });
        
        if (result.isConfirmed) { // Clicou em "Apenas Hoje"
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
                Swal.fire("Erro", "Erro ao cancelar o agendamento para o dia de hoje.", "error");
                btnElement.textContent = "X";
                btnElement.disabled = false;
            }
        } else if (result.isDenied) { // Clicou em "Todas as Repetições"
            const deleteResult = await Swal.fire({
                title: 'Atenção',
                text: 'Tem certeza que deseja APAGAR COMPLETAMENTE esse agendamento do sistema?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, apagar tudo',
                cancelButtonText: 'Cancelar'
            });
            if (deleteResult.isConfirmed) {
                executarDelecao(idAgendamento, btnElement);
            }
        }
    } else {
        const result = await Swal.fire({
            title: 'Cancelar agendamento?',
            text: "Tem certeza que deseja cancelar este agendamento?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, cancelar',
            cancelButtonText: 'Voltar'
        });
        if (result.isConfirmed) {
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
        Swal.fire("Erro", "Erro ao cancelar agendamento.", "error");
        btnElement.textContent = "X";
        btnElement.disabled = false;
    }
}