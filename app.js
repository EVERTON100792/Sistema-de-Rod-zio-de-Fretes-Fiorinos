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
                    if (typeof driver.isPaused === 'undefined') {
                        driver.isPaused = false; // Adiciona a nova propriedade se não existir
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
     * Aplica uma penalidade ao motorista por recusar a carga, movendo-o para o final da fila.
     */
    function penalizeDriver(driverId) {
        const driverToPenalize = drivers.find(d => d.id === driverId);
        if (!driverToPenalize) return;

        // 1. Encontra o faturamento máximo atual na fila, ignorando o motorista que será penalizado
        let maxRevenue = 0;
        drivers.forEach(driver => {
            if (driver.id === driverId) return; 
            const revenue = driver.freights.reduce((sum, f) => sum + f.value, 0);
            if (revenue > maxRevenue) {
                maxRevenue = revenue;
            }
        });

        // 2. Calcula o faturamento atual do motorista a ser penalizado
        const currentRevenue = driverToPenalize.freights.reduce((sum, f) => sum + f.value, 0);

        // 3. Calcula o novo faturamento para a penalidade (deve ser maior que o máximo)
        const newSortingRevenue = maxRevenue + 1;

        const confirmMessage = `
Tem certeza que deseja marcar que ${driverToPenalize.name} recusou a carga?

Faturamento atual (p/ rodízio): ${currentRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
Novo faturamento (p/ rodízio): ${newSortingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}

Isso o moverá para o final da fila.
        `.trim().replace(/^ +/gm, '');

        if (confirm(confirmMessage)) {
            // O valor da "penalidade" é a diferença para atingir o novo faturamento
            const penaltyValue = (newSortingRevenue - currentRevenue);

            const penaltyFreight = {
                id: Date.now(),
                value: penaltyValue > 0 ? penaltyValue : 1, // Garante que a penalidade tenha um valor
                date: new Date().toISOString(),
                type: 'penalty',
                description: 'Carga Recusada'
            };

            driverToPenalize.freights.push(penaltyFreight);
            saveDrivers();
            render();
        }
    }

    /**
     * Calcula o faturamento total de um motorista para um dia específico da semana ATUAL.
     * @param {object} driver - O objeto do motorista.
     * @param {number} dayOfWeek - O dia da semana (0=Dom, 1=Seg, ..., 6=Sáb).
     */
    function getRevenueForDay(driver, dayOfWeek) {
        const today = new Date();
        // Clone to avoid modifying original date
        const checkDate = new Date(today);
        // Find the Monday of the current week
        const currentDay = checkDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const distance = (currentDay === 0) ? 6 : currentDay - 1; // Distance from Monday
        checkDate.setDate(checkDate.getDate() - distance);
        const startOfWeek = new Date(checkDate.setHours(0, 0, 0, 0));

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const total = driver.freights
            .filter(f => {
                if (f.type === 'penalty') return false;
                const freightDate = new Date(f.date);
                
                if (freightDate >= startOfWeek && freightDate <= endOfWeek) {
                    return freightDate.getDay() === dayOfWeek;
                }
                return false;
            })
            .reduce((sum, f) => sum + f.value, 0);

        return total;
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
            tr.innerHTML = `<td colspan="12" style="text-align:center; padding: 2rem;">Nenhum motorista cadastrado.</td>`;
            driverListBody.appendChild(tr);
            return;
        }

        // Renderiza a tabela
        drivers.forEach((driver, index) => {
            // Calcula o faturamento e a última data a partir do histórico
            const realRevenue = driver.freights
                .filter(f => f.type !== 'penalty')
                .reduce((sum, freight) => sum + freight.value, 0);

            const sortingRevenue = driver.freights.reduce((sum, freight) => sum + freight.value, 0);

            // Verifica se a última ação foi uma penalidade (recusa de carga)
            const lastFreight = driver.freights.length > 0 ? driver.freights[driver.freights.length - 1] : null;
            const hasPenalty = lastFreight && lastFreight.type === 'penalty';
            const penaltyBadge = hasPenalty ? `<span class="rejection-badge" title="Este motorista recusou a última carga e foi para o final da fila."><span class="material-symbols-outlined">gavel</span> Recusou</span>` : '';

            const isPaused = driver.isPaused;
            const pausedBadge = isPaused ? `<span class="paused-badge" title="Este motorista está temporariamente indisponível."><span class="material-symbols-outlined">pause_circle</span> Pausado</span>` : '';


            const tr = document.createElement('tr');
            
            const formattedRealRevenue = realRevenue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });
            const formattedSortingRevenue = sortingRevenue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            // Calcula faturamento para cada dia da semana atual
            const dailyRevenues = [
                getRevenueForDay(driver, 1), // Seg
                getRevenueForDay(driver, 2), // Ter
                getRevenueForDay(driver, 3), // Qua
                getRevenueForDay(driver, 4), // Qui
                getRevenueForDay(driver, 5), // Sex
                getRevenueForDay(driver, 6), // Sáb
                getRevenueForDay(driver, 0)  // Dom
            ];

            const dailyCells = dailyRevenues.map(rev => {
                const formattedRev = rev > 0 ? rev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '---';
                return `<td>${formattedRev}</td>`;
            }).join('');

            // Cria o histórico de fretes (inicialmente oculto)
            const historyContent = driver.freights.length > 0 ? `
                <div class="freight-history">
                    <h4>Histórico de Lançamentos:</h4>
                    <ul class="freight-history-list">
                        ${driver.freights.map(f => {
                            const freightDate = new Date(f.date);
                            const formattedFreightDate = freightDate.toLocaleDateString('pt-BR', {
                                weekday: 'short', day: '2-digit', month: '2-digit'
                            });
                            
                            const isPenalty = f.type === 'penalty';

                            return `<li class="freight-item ${isPenalty ? 'penalty-item' : ''}" data-freight-id="${f.id}">
                                <div class="freight-item-details">
                                    ${isPenalty 
                                        ? `<span class="freight-item-value penalty-label"><span class="material-symbols-outlined">gavel</span> Carga Recusada</span>`
                                        : `<span class="freight-item-value">${f.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>`
                                    }
                                    <span class="freight-item-date">${formattedFreightDate}</span>
                                </div>
                                <span class="freight-item-actions">
                                    ${!isPenalty 
                                        ? `<button class="edit-freight-btn" title="Editar Lançamento"><span class="material-symbols-outlined">edit</span></button>`
                                        : '<span class="action-placeholder"></span>' // Espaço reservado para alinhar
                                    }
                                    <button class="delete-freight-btn" title="Excluir Lançamento"><span class="material-symbols-outlined">delete</span></button>
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
                <td>${isPaused ? '-' : `${index + 1}º`}</td>
                <td>${driver.name} ${penaltyBadge} ${pausedBadge}</td>
                <td>
                    <span class="revenue-real">${formattedRealRevenue}</span>
                    <span class="revenue-sorting">P/ Rodízio: ${formattedSortingRevenue}</span>
                </td>
                ${dailyCells}
                <td>
                    <form class="freight-register-form" data-id="${driver.id}" ${isPaused ? 'style="display:none;"' : ''}>
                        <input type="number" class="freight-value-input" placeholder="R$" min="0.01" step="0.01" required>
                        <button type="submit" class="btn btn-small-success">Lançar</button>
                    </form>
                    ${historyToggle}
                    <div class="history-container" style="display: none;">${historyContent}</div>
                </td>
                <td class="actions-cell">
                    ${isPaused 
                        ? `<button class="btn btn-small-success pause-toggle-btn" title="Reativar Motorista"><span class="material-symbols-outlined">play_arrow</span></button>`
                        : `<button class="btn btn-small-secondary pause-toggle-btn" title="Marcar como Indisponível (Pausar)"><span class="material-symbols-outlined">pause</span></button>`
                    }
                    <button class="btn btn-small-warning refuse-btn" title="Recusar Carga (Aplica Penalidade)" ${isPaused ? 'disabled' : ''}>
                        <span class="material-symbols-outlined">thumb_down</span>
                    </button>
                    <button class="btn btn-small-danger remove-btn" title="Remover Motorista"><span class="material-symbols-outlined">delete</span></button>
                </td>
            `;

            tr.dataset.driverName = driver.name.toLowerCase(); // Atributo para busca
            
            // Adiciona listeners para os botões de AÇÃO
            tr.querySelector('.remove-btn').addEventListener('click', () => {
                removeDriver(driver.id);
            });
            tr.querySelector('.refuse-btn').addEventListener('click', () => {
                penalizeDriver(driver.id);
            });
            tr.querySelector('.pause-toggle-btn').addEventListener('click', () => {
                togglePauseDriver(driver.id);
            });

            if (isPaused) tr.classList.add('paused-driver');

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
            if (row.children.length === 1 && row.children[0].colSpan === 12) return;

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
            // Critério 0: Motoristas pausados vão para o final
            if (a.isPaused && !b.isPaused) return 1;
            if (!a.isPaused && b.isPaused) return -1;

            // Critério 1: Faturamento
            const revenueA = a.freights.reduce((sum, f) => sum + f.value, 0);
            const revenueB = b.freights.reduce((sum, f) => sum + f.value, 0);

            if (revenueA < revenueB) return -1;
            if (revenueA > revenueB) return 1;

            // Critério 2: Data do último frete (desempate)
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
            freights: [], // Novo: histórico de fretes
            isPaused: false // Novo: status de pausa
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
     * Alterna o estado de pausa de um motorista.
     * @param {number} driverId 
     */
    function togglePauseDriver(driverId) {
        const driver = drivers.find(d => d.id === driverId);
        if (driver) {
            driver.isPaused = !driver.isPaused;
            const action = driver.isPaused ? 'pausado' : 'reativado';
            console.log(`Motorista ${driver.name} foi ${action}.`);
            saveDrivers();
            // Re-renderizar irá re-ordenar e atualizar a UI
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
            date: new Date().toISOString(),
            type: 'freight',
            description: `Frete regular no valor de ${value}`
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
        text += `_Atualizado em: ${today}_
`;
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
                
                // Não mostra motoristas pausados na lista de compartilhamento
                if (driver.isPaused) return;

                text += `${positionStr}º - ${driver.name}\n`; // Apenas motoristas ativos
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
*COMUNICADO IMPORTANTE: NOVO SISTEMA DE RODÍZIO DE FRETES (EXCLUSIVO FIORINOS)* 🚛

Atenção, motoristas!

Para deixar a distribuição de fretes mais justa e equilibrada para todos os motoristas de *Fiorino*, estamos modernizando nosso sistema.

*1. O FIM DO "QUADRO DA VEZ"*
O antigo "Quadro da Vez" está sendo substituído por este novo sistema digital. A ordem de carregamento não será mais fixa.

*2. COMO FUNCIONA A NOVA FILA?*
A fila agora é 100% baseada no faturamento. O sistema organiza a lista do motorista que *menos faturou* para o que *mais faturou* na quinzena.
*OBJETIVO:* Dar a chance de carregar para quem está com o faturamento mais baixo, buscando um equilíbrio financeiro para todo o grupo.

*3. E SE ALGUÉM RECUSAR UMA CARGA?*
Entendemos que imprevistos acontecem. No entanto, para manter a fila justa, o motorista que *recusar uma carga na hora* receberá uma *penalidade*.
*A PENALIDADE:* O sistema irá ajustar o faturamento desse motorista para que ele se torne o mais alto da lista, movendo-o automaticamente para o *último lugar da fila*. Ele só voltará a subir na lista conforme os outros motoristas forem carregando e aumentando seus faturamentos.

*4. E SE EU PRECISAR FICAR INDISPONÍVEL? (NOVO)*
Se você tiver um compromisso pessoal ou souber com antecedência que não poderá carregar, *avise ao responsável*.
*COMO FUNCIONA:* Seu nome será "pausado" no sistema. Você sairá temporariamente da fila de carregamento, sem receber nenhuma penalidade no faturamento. Quando você estiver disponível novamente, é só avisar para ser reativado e você voltará para a fila na posição correspondente ao seu faturamento atual.

*5. COMO SABER MINHA POSIÇÃO?*
Todos os dias, a lista com a ordem atualizada será compartilhada no grupo do WhatsApp para que todos possam acompanhar sua posição na fila.

Este sistema foi criado para beneficiar a todos, trazendo mais transparência e equilíbrio. Contamos com a colaboração de vocês!
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
