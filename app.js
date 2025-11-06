document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores de Elementos ---
    const addDriverForm = document.getElementById('add-driver-form');
    const driverNameInput = document.getElementById('driver-name');
    const driverListBody = document.getElementById('driver-list');
    const resetQuinzenaBtn = document.getElementById('reset-quinzena');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-freight-form');
    const editValueInput = document.getElementById('edit-freight-value');
    const searchInput = document.getElementById('search-driver');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    const shareModal = document.getElementById('share-modal');
    const sharePositionsBtn = document.getElementById('share-positions-btn');
    const shareTextarea = document.getElementById('share-text');
    const copyShareTextBtn = document.getElementById('copy-share-text-btn');
    const explainRulesBtn = document.getElementById('explain-rules-btn');
    const rulesModal = document.getElementById('rules-modal');
    const rulesTextarea = document.getElementById('rules-text');
    const copyRulesTextBtn = document.getElementById('copy-rules-text-btn');


    // --- Estado da Aplicação ---
    let drivers = [];
    const STORAGE_KEY = 'freightSystemDrivers';

    // --- Funções Principais ---

    /**
     * Carrega os motoristas do Local Storage.
     */
    function loadDrivers() {
        try {
            const driversJson = localStorage.getItem(STORAGE_KEY);
            if (driversJson) {
                drivers = JSON.parse(driversJson);
                // Migração de dados para o novo formato com histórico de fretes
                drivers.forEach(driver => {
                    if (!driver.freights) {
                        driver.freights = driver.accumulatedRevenue > 0 ? [{ id: new Date(driver.lastFreightDate).getTime(), value: driver.accumulatedRevenue, date: driver.lastFreightDate }] : [];
                    }
                });
            } else {
                drivers = [];
            }
        } catch (e) {
            console.error("Erro ao carregar dados do Local Storage:", e);
            drivers = [];
        }
    }

    /**
     * Salva o estado atual dos motoristas no Local Storage.
     */
    function saveDrivers() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(drivers));
        } catch (e) {
            console.error("Erro ao salvar dados no Local Storage:", e);
        }
    }

    /**
     * A função central: Renderiza toda a UI com base no estado 'drivers'.
     */
    function render() {
        // Limpa a lista atual
        driverListBody.innerHTML = '';

        // Ordena os motoristas
        sortDrivers();

        if (drivers.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="6" style="text-align:center; padding: 2rem;">Nenhum motorista cadastrado.</td>`;
            driverListBody.appendChild(tr);
            return;
        }

        // Renderiza a tabela
        drivers.forEach((driver, index) => {
            // Calcula o faturamento e a última data a partir do histórico
            const accumulatedRevenue = driver.freights.reduce((sum, freight) => sum + freight.value, 0);
            const lastFreight = driver.freights.length > 0 ? driver.freights[driver.freights.length - 1] : null;
            const lastFreightDate = lastFreight ? new Date(lastFreight.date) : null;

            const tr = document.createElement('tr');
            
            const formattedRevenue = accumulatedRevenue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            const formattedDate = lastFreightDate
                ? lastFreightDate.toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })
                : '---';

            // Cria o histórico de fretes (inicialmente oculto)
            // Invertemos a ordem para mostrar os mais recentes primeiro
            const historyContent = driver.freights.length > 0 ? `
                <div class="freight-history">
                    <h4>Histórico de Lançamentos:</h4>
                    <ul class="freight-history-list">
                        ${driver.freights.map(f => {
                            const freightDate = new Date(f.date);
                            const formattedFreightDate = freightDate.toLocaleDateString('pt-BR', {
                                weekday: 'long', day: '2-digit', month: '2-digit'
                            });

                            return `<li class="freight-item" data-freight-id="${f.id}">
                                <div class="freight-item-details">
                                    <span class="freight-item-value">${f.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    <span class="freight-item-date">${formattedFreightDate}</span>
                                </div>
                                <span class="freight-item-actions">
                                    <button class="edit-freight-btn" title="Editar"><span class="material-symbols-outlined">edit</span></button>
                                    <button class="delete-freight-btn" title="Excluir"><span class="material-symbols-outlined">delete</span></button>
                                </span>
                            </li>`;
                        }).reverse().join('')}
                    </ul>
                </div>
            ` : '';

            const historyToggle = driver.freights.length > 0 ? `
                <button class="history-toggle-btn">
                    <span class="material-symbols-outlined" style="font-size: 1em;">visibility</span>
                    Ver Histórico
                </button>
            ` : '';


            tr.innerHTML = `
                <td>${index + 1}º</td>
                <td>${driver.name}</td>
                <td>${formattedRevenue}</td>
                <td>${formattedDate}</td>
                <td>
                    <form class="freight-register-form" data-id="${driver.id}">
                        <input type="number" class="freight-value-input" placeholder="R$" min="0.01" step="0.01" required>
                        <button type="submit" class="btn btn-small-success">Lançar</button>
                    </form>
                    ${historyToggle}
                    <div class="history-container" style="display: none;">${historyContent}</div>
                </td>
                <td>
                    <button class="btn btn-small-danger" data-id="${driver.id}">Remover</button>
                </td>
            `;

            tr.dataset.driverName = driver.name.toLowerCase(); // Atributo para busca
            // Adiciona listener para o botão de REMOVER
            tr.querySelector('.btn-small-danger').addEventListener('click', () => {
                removeDriver(driver.id);
            });

            // Adiciona listener para o formulário de LANÇAR FRETE
            tr.querySelector('.freight-register-form').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = e.target.querySelector('.freight-value-input');
                const value = parseFloat(input.value);
                registerFreightForDriver(driver.id, value);
            });

            // Adiciona listener para o botão de MOSTRAR/ESCONDER HISTÓRICO
            const historyContainer = tr.querySelector('.history-container');
            const toggleBtn = tr.querySelector('.history-toggle-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const isVisible = historyContainer.style.display === 'block';
                    historyContainer.style.display = isVisible ? 'none' : 'block';
                    toggleBtn.innerHTML = isVisible 
                        ? `<span class="material-symbols-outlined" style="font-size: 1em;">visibility</span> Ver Histórico`
                        : `<span class="material-symbols-outlined" style="font-size: 1em;">visibility_off</span> Ocultar Histórico`;
                });
            }

            // Adiciona listeners para os botões de EDITAR e DELETAR frete
            if (historyContainer) {
                historyContainer.querySelectorAll('.edit-freight-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const freightId = e.target.closest('.freight-item').dataset.freightId;
                        openEditModal(driver.id, Number(freightId));
                    });
                });
                historyContainer.querySelectorAll('.delete-freight-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const freightId = e.target.closest('.freight-item').dataset.freightId;
                        removeFreight(driver.id, Number(freightId));
                    });
                });
            }

            driverListBody.appendChild(tr);
        });
    }

    /**
     * Filtra a tabela de motoristas com base no texto de busca.
     */
    function filterTable() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const rows = driverListBody.querySelectorAll('tr');

        rows.forEach(row => {
            // Ignora a linha de "nenhum motorista"
            if (row.children.length === 1 && row.children[0].colSpan === 6) return;

            const driverName = row.dataset.driverName;
            const isVisible = driverName.includes(searchTerm);
            
            row.style.display = isVisible ? '' : 'none';
            // Adiciona/remove uma classe de destaque se a busca for exata ou quase
            row.classList.toggle('highlighted', searchTerm && isVisible);
        });
    }

    /**
     * Ordena a lista de motoristas.
     * Critério 1: Menor faturamento acumulado.
     * Critério 2 (Desempate): Data do último frete (quem recebeu há mais tempo, tem prioridade).
     */
    function sortDrivers() {
        drivers.sort((a, b) => {
            const revenueA = a.freights.reduce((sum, f) => sum + f.value, 0);
            const revenueB = b.freights.reduce((sum, f) => sum + f.value, 0);

            if (revenueA < revenueB) return -1;
            if (revenueA > revenueB) return 1;

            const lastFreightA = a.freights.length > 0 ? a.freights[a.freights.length - 1] : null;
            const lastFreightB = b.freights.length > 0 ? b.freights[b.freights.length - 1] : null;
            const dateA = lastFreightA ? new Date(lastFreightA.date).getTime() : 0;
            const dateB = lastFreightB ? new Date(lastFreightB.date).getTime() : 0;
            
            return dateA - dateB; // O menor timestamp (mais antigo) vem primeiro
        });
    }

    /**
     * Adiciona um novo motorista.
     */
    function addDriver(name) {
        if (!name.trim()) {
            alert('Por favor, insira um nome válido.');
            return;
        }

        const isDuplicate = drivers.some(driver => driver.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
            alert('Já existe um motorista com esse nome.');
            return;
        }

        const newDriver = {
            id: Date.now(),
            name: name.trim(),
            freights: [] // Novo: histórico de fretes
        };

        drivers.push(newDriver);
        saveDrivers();
        render();

        driverNameInput.value = '';
        driverNameInput.focus();
    }

    /**
     * Remove um motorista pelo ID.
     */
    function removeDriver(id) {
        const driver = drivers.find(d => d.id === id);
        if (confirm(`Tem certeza que deseja remover ${driver.name}? Esta ação não pode ser desfeita.`)) {
            drivers = drivers.filter(d => d.id !== id);
            saveDrivers();
            render();
        }
    }

    /**
     * Registra um novo frete para um motorista específico.
     */
    function registerFreightForDriver(driverId, value) {
        if (isNaN(value) || value <= 0) {
            alert('Por favor, insira um valor de frete válido.');
            return;
        }

        const driver = drivers.find(d => d.id === driverId);
        if (!driver) {
            console.error('Motorista não encontrado!');
            return;
        }

        const newFreight = {
            id: Date.now(),
            value: value,
            date: new Date().toISOString()
        };

        driver.freights.push(newFreight);
        driver.freights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Garante a ordem

        saveDrivers();
        render(); // Essencial: Re-ordena e re-desenha a tabela
    }

    /**
     * Remove um frete específico de um motorista.
     */
    function removeFreight(driverId, freightId) {
        const driver = drivers.find(d => d.id === driverId);
        if (!driver) return;

        const freight = driver.freights.find(f => f.id === freightId);
        if (!freight) return;

        if (confirm(`Tem certeza que deseja remover o frete de ${freight.value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} para ${driver.name}?`)) {
            driver.freights = driver.freights.filter(f => f.id !== freightId);
            saveDrivers();
            render();
        }
    }

    /**
     * Abre o modal de edição para um frete.
     */
    function openEditModal(driverId, freightId) {
        const driver = drivers.find(d => d.id === driverId);
        const freight = driver.freights.find(f => f.id === freightId);
        if (!driver || !freight) return;

        editValueInput.value = freight.value;
        editForm.dataset.driverId = driverId;
        editForm.dataset.freightId = freightId;
        editModal.style.display = 'flex';
        editValueInput.focus();
    }

    /**
     * Fecha o modal de edição.
     */
    function closeEditModal() {
        editModal.style.display = 'none';
    }

    /**
     * Salva a edição de um frete.
     */
    function saveFreightEdit(driverId, freightId, newValue) {
        const driver = drivers.find(d => d.id === driverId);
        const freight = driver.freights.find(f => f.id === freightId);
        if (!driver || !freight) return;

        freight.value = newValue;
        saveDrivers();
        render();
        closeEditModal();
    }

    /**
     * Zera o faturamento de todos os motoristas.
     */
    function resetQuinzena() {
        if (confirm('ATENÇÃO!\nTem certeza que deseja ZERAR o faturamento de TODOS os motoristas?\nIsso iniciará uma nova quinzena.')) {
            drivers.forEach(driver => {
                driver.freights = [];
            });
            saveDrivers();
            render();
            alert('Quinzena reiniciada! O faturamento de todos os motoristas foi zerado.');
        }
    }

    /**
     * Gera o texto formatado para compartilhamento.
     */
    function generateShareableText() {
        sortDrivers(); // Garante que a lista está na ordem correta
        const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
 
        let text = `*RODÍZIO DE FRETES FIORINOS* 🚛\n`;
        text += `_Atualizado em: ${today}_\n`;
        text += `-----------------------------------\n\n`;
 
        if (drivers.length === 0) {
            text += "Nenhum motorista na fila.";
        } else {
            // Para alinhamento, encontramos o número máximo de dígitos nas posições
            const maxPositionLength = String(drivers.length).length;

            drivers.forEach((driver, index) => {
                const position = index + 1;
                // Alinha o número da posição à direita para um visual limpo
                const positionStr = String(position).padStart(maxPositionLength, ' ');

                text += `${positionStr}º - ${driver.name}\n`;
            });
        }
 
        text += `\n-----------------------------------`;
        return text;
    }

    /**
     * Abre o modal de compartilhamento com o texto gerado.
     */
    function openShareModal() {
        const text = generateShareableText();
        shareTextarea.value = text;
        shareModal.style.display = 'flex';
    }

    /**
     * Copia o texto do modal para a área de transferência.
     */
    function copyShareText() {
        navigator.clipboard.writeText(shareTextarea.value).then(() => {
            copyShareTextBtn.innerText = 'Copiado!';
            setTimeout(() => {
                copyShareTextBtn.innerHTML = `<span class="material-symbols-outlined">content_copy</span> Copiar Texto`;
            }, 2000);
        });
    }

    /**
     * Abre o modal com a explicação das regras.
     */
    function openRulesModal() {
        const rulesText = `
*COMO FUNCIONA O RODÍZIO DE FRETES?* 📋

Para que a distribuição seja justa para todos, o sistema segue duas regras simples, nesta ordem:

*1. REGRA DO MENOR FATURAMENTO*
O motorista que tiver o *menor valor faturado* na quinzena fica sempre no topo da fila, sendo o próximo a receber uma carga.

*2. REGRA DE DESEMPATE POR TEMPO*
Quando há um empate no valor faturado (por exemplo, R$ 0,00 no início da quinzena), o sistema dá a vez para quem está esperando há mais tempo. Ele faz isso olhando a data do último frete: *quem tiver a data mais antiga, passa na frente*.

*RESUMINDO:*
A prioridade é sempre de quem faturou menos. Em caso de empate, a prioridade é de quem está há mais tempo sem trabalhar.

*ATENÇÃO:*
Isso significa que quem tiver o *maior valor faturado* na quinzena corre o risco de não receber cargas, pois o sistema sempre passará os fretes para quem tem o menor valor acumulado, buscando equilibrar o faturamento de todos.
        `.trim();

        rulesTextarea.value = rulesText;
        rulesModal.style.display = 'flex';
    }

    /**
     * Copia o texto de explicação das regras.
     */
    function copyRulesText() {
        navigator.clipboard.writeText(rulesTextarea.value).then(() => {
            copyRulesTextBtn.innerText = 'Copiado!';
            setTimeout(() => {
                copyRulesTextBtn.innerHTML = `<span class="material-symbols-outlined">content_copy</span> Copiar Explicação`;
            }, 2000);
        });
    }


    // --- Event Listeners ---

    addDriverForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addDriver(driverNameInput.value);
    });

    resetQuinzenaBtn.addEventListener('click', resetQuinzena);

    searchInput.addEventListener('input', filterTable);

    closeModalBtn.addEventListener('click', closeEditModal);

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) { // Fecha se clicar fora do conteúdo do modal
            closeEditModal();
        }
    });

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const { driverId, freightId } = e.target.dataset;
        const newValue = parseFloat(editValueInput.value);
        saveFreightEdit(Number(driverId), Number(freightId), newValue);
    });

    sharePositionsBtn.addEventListener('click', openShareModal);

    copyShareTextBtn.addEventListener('click', copyShareText);

    shareModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        shareModal.style.display = 'none';
    });
    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) shareModal.style.display = 'none';
    });

    explainRulesBtn.addEventListener('click', openRulesModal);

    copyRulesTextBtn.addEventListener('click', copyRulesText);

    rulesModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        rulesModal.style.display = 'none';
    });
    rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) rulesModal.style.display = 'none';
    });

    // --- Inicialização ---
    loadDrivers();
    render();

});
