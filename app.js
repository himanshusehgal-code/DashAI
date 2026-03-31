// app.js

// 🚨 UPDATE TO YOUR GOOGLE SCRIPT WEB APP URL 🚨
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const actionPanel = document.getElementById('actionPanel');
    const dashboardContent = document.getElementById('dashboardContent');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const aiChartsContainer = document.getElementById('aiChartsContainer');
    
    const btnAutoAI = document.getElementById('btnAutoAI');
    const btnCustomAI = document.getElementById('btnCustomAI');
    const aiQuestion = document.getElementById('aiQuestion');
    const aiLoader = document.getElementById('aiLoader');
    
    const loginBtn = document.getElementById('loginBtn');
    const userEmailInput = document.getElementById('userEmail');
    const tokenCount = document.getElementById('tokenCount');
    const authStatus = document.getElementById('authStatus');
    
    let allCharts = [];
    let currentDataSummary = ""; // Data sent to AI
    let currentTokens = 0;

    // --- Authentication ---
    const loadUser = async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if (email) {
            userEmailInput.value = email;
            try {
                loginBtn.innerText = 'Syncing...';
                const res = await fetch(SERVER_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'getUserInfo', email: email })
                });
                const data = await res.json();

                if(data.status === 'success') {
                    currentTokens = data.tokens;
                    tokenCount.innerText = currentTokens;
                    
                    authStatus.classList.remove('hidden');
                    loginBtn.innerText = 'Account Synced';
                    loginBtn.classList.replace('bg-blue-600', 'bg-gray-800');
                    userEmailInput.classList.add('cursor-not-allowed', 'opacity-50');
                    userEmailInput.readOnly = true;
                } else {
                    throw new Error(data.message);
                }
            } catch (err) {
                console.error('Failed to sync user data', err);
                loginBtn.innerText = 'Register Email';
                alert('Could not connect to database.');
            }
        }
    };
    
    loadUser();
    
    loginBtn.addEventListener('click', () => {
        const emailVal = userEmailInput.value.trim();
        if(emailVal) {
            sessionStorage.setItem('dashupdata_email', emailVal);
            loadUser();
        } else {
            alert('Please enter a valid email.');
        }
    });

    // --- File Upload & CSV Parsing ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('border-blue-500');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    
    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            preview: 50, // Grab only 50 rows for the AI
            complete: (results) => {
                if(results.data.length > 0) {
                    currentDataSummary = Papa.unparse(results.data);
                    renderDataPreview(results.data);
                } else alert('CSV file is empty or invalid.');
            }
        });
    };

    const renderDataPreview = (data) => {
        dropZone.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        dashboardContent.classList.remove('hidden');
        
        const headers = Object.keys(data[0]);
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-4 py-3 font-medium">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = data.map(row => 
            `<tr>${headers.map(h => `<td class="px-4 py-2">${row[h] || '-'}</td>`).join('')}</tr>`
        ).join('');
    };

    // --- AI Execution Core ---
    async function triggerAI(question, modeType, cost) {
        const email = sessionStorage.getItem('dashupdata_email');
        if (!email) return alert('🔒 Please sync your email account on the left sidebar first.');
        if (currentTokens < cost) {
            alert(`❌ Insufficient tokens. You need ${cost} tokens for this action.`);
            window.location.href = 'pricing.html';
            return;
        }

        aiLoader.classList.remove('hidden');
        btnAutoAI.disabled = true;
        btnCustomAI.disabled = true;

        try {
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ 
                    action: 'runInsight', 
                    email: email, 
                    question: question, 
                    dataSummary: currentDataSummary,
                    mode: modeType
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                currentTokens -= result.tokensDeducted;
                tokenCount.innerText = currentTokens;
                renderCharts(result.insights, modeType === 'auto');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            alert('⚠️ Network error. Connection failed.');
        } finally {
            aiLoader.classList.add('hidden');
            btnAutoAI.disabled = false;
            btnCustomAI.disabled = false;
        }
    }

    // --- Button Listeners ---
    btnAutoAI.addEventListener('click', () => triggerAI("Generate a complete dashboard", "auto", 5));
    
    btnCustomAI.addEventListener('click', () => {
        const q = aiQuestion.value.trim();
        if(!q) return alert("Please ask a specific question.");
        triggerAI(q, "custom", 1);
    });

    // --- Render AI Charts ---
    function renderCharts(insights, isAuto) {
        if(isAuto) {
            aiChartsContainer.innerHTML = '';
            allCharts.forEach(c => c.destroy());
            allCharts = [];
        }

        insights.forEach((item, idx) => {
            let chartId = `aiChart_${Date.now()}_${idx}`; 
            let wrapper = document.createElement('div');
            wrapper.className = 'glass p-6 rounded-2xl border border-gray-800 flex flex-col';

            wrapper.innerHTML = `
                <h3 class="text-base font-semibold text-white mb-4 flex items-center">
                    <div class="w-2 h-2 rounded-full bg-blue-500 mr-2"></div> ${item.chartTitle}
                </h3>
                <div class="relative w-full h-[250px]"><canvas id="${chartId}"></canvas></div>
                <div class="mt-6 space-y-3 text-sm bg-black/40 p-4 rounded-xl border border-gray-800/50">
                    <p><span class="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded">Issue</span> <br/><span class="text-gray-300 mt-1 block">${item.issue}</span></p>
                    <p><span class="text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded">Insight</span> <br/><span class="text-gray-300 mt-1 block">${item.insight}</span></p>
                    <p><span class="text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded">Action</span> <br/><span class="text-gray-300 mt-1 block">${item.action}</span></p>
                </div>
            `;
            
            if(isAuto) aiChartsContainer.appendChild(wrapper);
            else aiChartsContainer.prepend(wrapper); // Custom puts it at top

            const ctx = document.getElementById(chartId);
            const type = ['bar','line','pie','doughnut'].includes(item.type) ? item.type : 'bar';

            let newChart = new Chart(ctx, {
                type: type,
                data: {
                    labels: item.labels,
                    datasets: [{
                        label: 'Value',
                        data: item.values,
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'],
                        borderRadius: type === 'bar' ? 4 : 0,
                        borderWidth: type === 'pie' || type === 'doughnut' ? 2 : 0,
                        borderColor: '#111827',
                        fill: type === 'line' ? true : false,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, color: '#9ca3af',
                    plugins: { legend: { display: type !== 'bar', labels: {color:'#9ca3af'} } },
                    scales: (type === 'pie' || type === 'doughnut') ? {} : {
                        x: { ticks: { color: '#6b7280' }, grid: { display: false } },
                        y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                }
            });
            allCharts.push(newChart);
        });
        
        aiChartsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- PDF Export ---
    document.getElementById('btnPDF').addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email || currentTokens < 1) return alert("You need 1 token to download PDF.");
        
        const btn = document.getElementById('btnPDF');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Generating PDF...';
        btn.disabled = true;

        try {
            const res = await fetch(SERVER_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'deductPdfToken', email: email })
            });
            const data = await res.json();
            
            if(data.status === 'success') {
                currentTokens -= 1;
                tokenCount.innerText = currentTokens;
                
                const element = document.getElementById('pdf-export-area');
                element.style.backgroundColor = '#0a0a0a';
                
                await html2pdf().set({
                    margin: 0.5,
                    filename: `DashupData_Report_${Date.now()}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
                }).from(element).save();
            } else throw new Error(data.message);
        } catch(err) {
            alert('PDF Export Failed: ' + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // --- Clear Workspace ---
    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Clear dashboard?')) location.reload();
    });
});
