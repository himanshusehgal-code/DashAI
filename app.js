// app.js

// 🚨 UPDATE THIS URL TO YOUR DEPLOYED GOOGLE APPS SCRIPT URL 🚨
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
    const btnPDF = document.getElementById('btnPDF');
    const aiQuestion = document.getElementById('aiQuestion');
    const aiLoader = document.getElementById('aiLoader');
    
    const loginBtn = document.getElementById('loginBtn');
    const userEmailInput = document.getElementById('userEmail');
    const tokenCount = document.getElementById('tokenCount');
    const authStatus = document.getElementById('authStatus');
    
    let allCharts = [];
    let currentDataSummary = ""; 
    let currentTokens = 0;

    // ==========================================
    // 1. AUTHENTICATION & SYNC
    // ==========================================
    const loadUser = async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if (email) {
            userEmailInput.value = email;
            try {
                loginBtn.innerText = 'Syncing...';
                
                const res = await fetch(SERVER_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'text/plain;charset=utf-8'},
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
                loginBtn.innerText = 'Sync Account';
                alert('Could not connect to backend server.');
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

    // ==========================================
    // 2. CSV UPLOAD & PARSING
    // ==========================================
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-500/10'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-500/10'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    
    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        
        Papa.parse(file, {
            header: true, skipEmptyLines: true, preview: 50,
            complete: (results) => {
                if(results.data && results.data.length > 0) {
                    currentDataSummary = Papa.unparse(results.data);
                    renderDataPreview(results.data);
                } else {
                    alert('CSV file is empty or invalid.');
                }
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

    // ==========================================
    // 3. AI INTEGRATION LOGIC
    // ==========================================
    async function executeAI(question, mode, cost) {
        const email = sessionStorage.getItem('dashupdata_email');
        if (!email) return alert('🔒 Please Sync your Account in the sidebar first.');
        if (!currentDataSummary) return alert('Please upload data first.');
        
        if (currentTokens < cost) {
            alert(`❌ Insufficient tokens. You need ${cost} tokens.`);
            window.location.href = 'pricing.html';
            return;
        }

        aiLoader.classList.remove('hidden');
        btnAutoAI.disabled = true;
        btnCustomAI.disabled = true;

        try {
            const res = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'runInsight', email: email, question: question, dataSummary: currentDataSummary, mode: mode })
            });
            
            const result = await res.json();
            
            if (result.status === 'success') {
                currentTokens -= result.tokensDeducted;
                tokenCount.innerText = currentTokens;
                renderAICharts(result.insights, mode === 'auto');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('⚠️ Network error. Connection failed.');
        } finally {
            aiLoader.classList.add('hidden');
            btnAutoAI.disabled = false;
            btnCustomAI.disabled = false;
        }
    }

    btnAutoAI.addEventListener('click', () => executeAI("Generate complete dashboard insights", "auto", 5));
    btnCustomAI.addEventListener('click', () => {
        const q = aiQuestion.value.trim();
        if(!q) return alert("Please type your question first.");
        executeAI(q, "custom", 1);
    });

    // ==========================================
    // 4. CHART RENDERING
    // ==========================================
    function renderAICharts(insights, isAuto) {
        if(isAuto) {
            aiChartsContainer.innerHTML = '';
            allCharts.forEach(c => c.destroy());
            allCharts = [];
        }

        insights.forEach((item, idx) => {
            let chartId = `aiChart_${Date.now()}_${idx}`; 
            let wrapper = document.createElement('div');
            wrapper.className = 'glass p-6 rounded-2xl border border-gray-800 flex flex-col w-full';

            wrapper.innerHTML = `
                <h3 class="text-base font-semibold text-white mb-4 flex items-center">
                    <div class="w-2 h-2 rounded-full bg-blue-500 mr-2"></div> ${item.chartTitle}
                </h3>
                <div class="relative w-full h-[280px]">
                    <canvas id="${chartId}"></canvas>
                </div>
                <div class="mt-6 space-y-3 text-sm bg-black/40 p-4 rounded-xl border border-gray-800/50">
                    <p><span class="text-red-400 font-bold bg-red-400/10 px-2 py-0.5 rounded">Issue Detected</span> <br/><span class="text-gray-300 mt-1 block">${item.issue}</span></p>
                    <p><span class="text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded">AI Insight</span> <br/><span class="text-gray-300 mt-1 block">${item.insight}</span></p>
                    <p><span class="text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded">Recommended Action</span> <br/><span class="text-gray-300 mt-1 block">${item.action}</span></p>
                </div>
            `;
            
            if(isAuto) aiChartsContainer.appendChild(wrapper);
            else aiChartsContainer.prepend(wrapper); 

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
                        borderColor: '#0a0a0a',
                        fill: type === 'line' ? true : false,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, color: '#9ca3af',
                    plugins: { legend: { display: type !== 'bar', position: 'bottom', labels: {color:'#9ca3af'} } },
                    scales: (type === 'pie' || type === 'doughnut') ? {} : {
                        x: { ticks: { color: '#6b7280' }, grid: { display: false } },
                        y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                    }
                }
            });
            allCharts.push(newChart);
        });
        
        aiChartsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 5. PDF EXPORT (-1 TOKEN)
    // ==========================================
    btnPDF.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email) return alert("Please sync account first.");
        if(currentTokens < 1) return alert("You need 1 token to download the PDF report.");
        
        const originalText = btnPDF.innerHTML;
        btnPDF.innerHTML = 'Generating PDF...';
        btnPDF.disabled = true;

        try {
            const res = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
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
                
                element.style.backgroundColor = ''; 
            } else {
                throw new Error(data.message);
            }
        } catch(err) {
            alert('PDF Export Failed: ' + err.message);
        } finally {
            btnPDF.innerHTML = originalText;
            btnPDF.disabled = false;
        }
    });

    // ==========================================
    // 6. CLEAR WORKSPACE
    // ==========================================
    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Clear all current data?')) {
            location.reload();
        }
    });
});
