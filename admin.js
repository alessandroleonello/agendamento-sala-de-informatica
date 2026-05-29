// Importações necessárias do Firebase e da nossa UI
import { db } from './firebase-setup.js';
import { ui } from './ui.js';
import { doc, setDoc, getDocs, collection, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Importações do script principal (Estado do app)
import { ADMIN_EMAILS, CONFIG_SISTEMA, setConfigSistema, renderizarTabela, escapeHTML } from './script.js';

/* =========================================================================
   PAINEL DE ADMINISTRAÇÃO E CONFIGURAÇÕES
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
        await setDoc(doc(db, "configuracoes", "geral"), novaConfig);
        setConfigSistema(novaConfig); // Função chamada do script.js para atualizar o app todo
        Swal.fire("Sucesso!", "Configurações salvas com sucesso!", "success");
        renderizarTabela(); // Atualiza a tabela imediatamente
    } catch (error) {
        console.error("Erro ao salvar config:", error);
        Swal.fire("Erro!", "Erro ao salvar as configurações.", "error");
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
            
            const nomeSeguro = escapeHTML(u.nome);
            const emailSeguro = escapeHTML(u.email);
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
                <td style="display:flex; align-items:center; gap:10px;"><img src="${escapeHTML(u.foto)}" width="30" height="30" style="border-radius:50%; object-fit:cover;"> ${nomeSeguro}</td>
                <td>${emailSeguro}</td>
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

window.alterarNivelUsuario = async function(uid, novoRole, btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = "...";
    try {
        await updateDoc(doc(db, "usuarios", uid), { role: novoRole });
        carregarUsuariosParaAdmin(); // Recarrega a tabela visualmente após sucesso
    } catch (error) {
        console.error("Erro ao atualizar nível:", error);
        Swal.fire("Erro", "Erro ao alterar permissão do usuário.", "error");
        btnElement.disabled = false;
    }
}