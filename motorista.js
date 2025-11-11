document.addEventListener('DOMContentLoaded', () => {
    const lookupBtn = document.getElementById('lookup-btn');
    const nameInput = document.getElementById('driver-name-lookup');
    const resultContainer = document.getElementById('result-container');

    const STORAGE_KEY = 'freightSystemDrivers';

    function sortDrivers(drivers) {
        drivers.sort((a, b) => {
            const revenueA = a.freights.reduce((sum, f) => sum + f.value, 0);
            const revenueB = b.freights.reduce((sum, f) => sum + f.value, 0);

            if (revenueA < revenueB) return -1;
            if (revenueA > revenueB) return 1;

            const lastFreightA = a.freights.length > 0 ? a.freights[a.freights.length - 1] : null;
            const lastFreightB = b.freights.length > 0 ? b.freights[b.freights.length - 1] : null;
            const dateA = lastFreightA ? new Date(lastFreightA.date).getTime() : 0;
            const dateB = lastFreightB ? new Date(lastFreightB.date).getTime() : 0;
            
            return dateA - dateB;
        });
        return drivers;
    }

    function findPosition() {
        const nameToFind = nameInput.value.trim().toLowerCase();
        if (!nameToFind) {
            resultContainer.innerHTML = `<p class="error">Por favor, digite um nome.</p>`;
            resultContainer.style.display = 'block';
            return;
        }

        const driversJson = localStorage.getItem(STORAGE_KEY);
        if (!driversJson) {
            resultContainer.innerHTML = `<p class="error">Nenhum dado de motorista encontrado. O sistema pode não ter sido iniciado ainda.</p>`;
            resultContainer.style.display = 'block';
            return;
        }

        let drivers = JSON.parse(driversJson);
        const sortedDrivers = sortDrivers(drivers);

        const driverIndex = sortedDrivers.findIndex(d => d.name.toLowerCase() === nameToFind);

        if (driverIndex === -1) {
            resultContainer.innerHTML = `<p class="error">Motorista não encontrado. Verifique se o nome foi digitado corretamente.</p>`;
            resultContainer.style.display = 'block';
            return;
        }

        const driverData = sortedDrivers[driverIndex];
        const driverPosition = driverIndex + 1;
        const driverRevenue = driverData.freights.reduce((sum, f) => sum + f.value, 0);
        const nextDriver = sortedDrivers.length > 0 ? sortedDrivers[0].name : 'Ninguém';
        let positionClass = 'info';
        if (driverPosition === 1) positionClass = 'success';
        if (driverPosition > 3) positionClass = 'warning';


        resultContainer.innerHTML = `
            <h3>Olá, ${driverData.name}!</h3>
            <div class="result-item">
                <span>Sua Posição na Fila:</span>
                <span class="result-value ${positionClass}">${driverPosition}º</span>
            </div>
            <hr>
            <div class="result-item">
                <span>Próximo da Vez:</span>
                <span class="result-value next-driver">${nextDriver}</span>
            </div>
        `;
        resultContainer.style.display = 'block';
    }

    lookupBtn.addEventListener('click', findPosition);
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            findPosition();
        }
    });
});
