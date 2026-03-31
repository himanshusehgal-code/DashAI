// app.js

// 🚨 SERVER URL: YAHAN APNA GOOGLE SCRIPT WEB APP URL DAALEIN 🚨
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const actionPanel = document.getElementById('actionPanel');
    const dashboardContent = document.getElementById('dashboardContent');
    
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const freeChartsContainer = document.getElementById('freeChartsContainer');
    const aiSectionWrapper = document.getElementById('aiSectionWrapper');
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
    let freeCharts = [];
    let aiPayloadData = ""; 
    let currentTokens = 0;

    // ==========================================
    // 1. AUTHENTICATION & SYNC
    // ==========================================
    const loadUser = async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if (email) {
            userEmailInput.value = email;
            try {
                loginBtn.innerHTML = '<span class="loader inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full mr-2"></span> Syncing...';
                
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
                    loginBtn.innerHTML = '✅ Account Synced';
                    loginBtn.classList.replace('bg-[#1f6feb]', 'bg-[#161b22]');
                    loginBtn.classList.replace('hover:bg-[#388bfd]', 'hover:bg-[#161b22]');
                    loginBtn.classList.replace('text-white', 'text-green-400');
                    userEmailInput.classList.add('cursor-not-allowed', 'opacity-50');
                    userEmailInput.readOnly = true;
                } else {
                    throw new Error(data.message);
                }
            } catch (err) {
                console.error(err);
                loginBtn.innerHTML = '🔄 Sync Account';
                alert('Could not connect to backend server. Ensure API is correct.');
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
            alert('Please enter a valid email address.');
        }
    });

    // ==========================================
    // 2. CSV UPLOAD & FREE DYNAMIC CHARTS (0 Tokens)
    // ==========================================
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-900/10'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-900/10'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    
    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 1) {
                    
                    // Slice data for AI payload to avoid breaking API limits
                    aiPayloadData = Papa.unparse(results.data.slice(0, 50)); 
                    
                    // Generate Free Instant Dashboard & Table
                    generateFreeDynamicCharts(results.data);
                    renderDataPreview(results.data.slice(0, 50)); 
                    
                    dropZone.classList.add('hidden');
                    actionPanel.classList.remove('hidden');
                    dashboardContent.classList.remove('hidden');
                } else {
                    alert('CSV file is empty or invalid.');
                }
            }
        });
    };

    function generateFreeDynamicCharts(rows) {
        const headers = Object.keys(rows[0]);
        let numericCols = [];
        let categoryCols = [];

        // Distinguish columns based on actual data
        headers.forEach(h => {
            let isNum = true;
            let uniqueVals = new Set();

            rows.forEach(r => {
                if (r[h] !== "" && r[h] !== null && r[h] !== undefined) {
                    uniqueVals.add(r[h]);
                    let cleanVal = String(r[h]).replace(/,/g, '').replace(/\$/g, '').trim();
                    if (isNaN(parseFloat(cleanVal))) isNum = false;
                }
            });

            let colName = h.toLowerCase();
            let isExcluded = colName.includes('id') || colName.includes('zip') || colName.includes('phone') || colName.includes('date');

            if (isNum && !isExcluded) numericCols.push({ name: h });
            else if (!isNum && uniqueVals.size > 1 && uniqueVals.size <= 100 && !isExcluded) categoryCols.push({ name: h, uniqueCount: uniqueVals.size });
        });

        // Best Metric
        let bestNumCol = numericCols.find(c => /sale|profit|price|amount|revenue|total|qty|quantity/i.test(c.name)) || numericCols[numericCols.length - 1];

        freeChartsContainer.innerHTML = '';
        freeCharts.forEach(c => c.destroy());
        freeCharts = [];

        if (categoryCols.length > 0 && bestNumCol) {
            let chartCategories = categoryCols.slice(0, 4); 

            chartCategories.forEach((catCol, idx) => {
                let aggregatedData = {};

                rows.forEach(r => {
                    let category = String(r[catCol.name] || "Unknown").trim();
                    if (!category || category.toLowerCase() === "null") category = "Other";

                    let rawVal = String(r[bestNumCol.name]).replace(/,/g, '').replace(/\$/g, '');
                    let value = parseFloat(rawVal) || 0;

                    if (!aggregatedData[category]) aggregatedData[category] = 0;
                    aggregatedData[category] += value;
                });

                // Top 8 for clean charts
                let sortedData = Object.entries(aggregatedData).sort((a,b) => b[1] - a[1]).slice(0, 8);
                const labels = sortedData.map(item => item[0]);
                const vals = sortedData.map(item => item[1]);

                let chartType = catCol.uniqueCount <= 5 ? (idx % 2 === 0 ? 'doughnut' : 'pie') : 'bar';
                let chartId = `freeChart_${Date.now()}_${idx}`;

                let wrapper = document.createElement('div');
                wrapper.className = 'bg-[#161b22] p-5 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg relative overflow-hidden';
                
                // Add a "Free" tag
                wrapper.innerHTML = `
                    <div class="absolute top-0 right-0 bg-green-900/30 text-green-400 text-[10px] font-bold px-3 py-1 rounded-bl-lg border-b border-l border-green-500/20">FREE VIEW</div>
                    <h3 class="text-sm font-bold text-gray-200 mb-4 mt-1 flex items-center">
                        <span class="mr-2 text-blue-400">📊</span> ${bestNumCol.name} by ${catCol.name}
                    </h3>
                    <div class="relative w-full h-[250px]">
                        <canvas id="${chartId}"></canvas>
                    </div>
                `;
                freeChartsContainer.appendChild(wrapper);

                const ctx = document.getElementById(chartId);
                let bgColors = ['#1f6feb', '#238636', '#f59e0b', '#da3633', '#8957e5', '#14b8a6', '#0ea5e9', '#f43f5e'];

                let newChart = new Chart(ctx, {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: bestNumCol.name,
                            data: vals,
                            backgroundColor: chartType === 'bar' ? '#1f6feb' : bgColors,
                            borderRadius: chartType === 'bar' ? 6 : 0,
                            borderWidth: chartType === 'bar' ? 0 : 2,
                            borderColor: '#161b22'
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, color: '#8b949e',
                        plugins: { legend: { display: chartType !== 'bar', position: 'right', labels: {color:'#8b949e', font:{family:'Inter'}} } },
                        scales: (chartType === 'pie' || chartType === 'doughnut') ? {} : {
                            x: { ticks: { color: '#8b949e', font:{family:'Inter'} }, grid: { display: false } },
                            y: { ticks: { color: '#8b949e', font:{family:'Inter'} }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                        }
                    }
                });
                freeCharts.push(newChart);
            });
        } else {
            freeChartsContainer.innerHTML = `
                <div class="col-span-full p-8 text-center text-gray-400 border border-gray-800 rounded-xl bg-[#161b22]">
                    <span class="text-3xl block mb-2">🤷‍♂️</span>
                    Standard basic charts could not be auto-generated due to lack of distinct numeric or categorical data.
                    <br><span class="text-blue-400 mt-2 block font-medium">Use the AI Analyst tools above to deep-dive!</span>
                </div>
            `;
        }
    }

    const renderDataPreview = (dataSlice) => {
        const headers = Object.keys(dataSlice[0]);
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-6 py-4 font-bold text-xs uppercase tracking-wider">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = dataSlice.map(row => 
            `<tr class="hover:bg-gray-800/40 transition-colors">${headers.map(h => `<td class="px-6 py-3">${row[h] || '-'}</td>`).join('')}</tr>`
        ).join('');
    };

    // ==========================================
    // 3. PREMIUM AI INTEGRATION LOGIC
    // ==========================================
    async function executeAI(question, mode, cost) {
        const email = sessionStorage.getItem('dashupdata_email');
        if (!email) return alert('🔒 Please Sync your Account in the sidebar first.');
        if (!aiPayloadData) return alert('Please upload data first.');
        
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
                body: JSON.stringify({ action: 'runInsight', email: email, question: question, dataSummary: aiPayloadData, mode: mode })
            });
            
            const result = await res.json();
            
            if (result.status === 'success') {
                currentTokens -= result.tokensDeducted;
                tokenCount.innerText = currentTokens;
                aiSectionWrapper.classList.remove('hidden');
                renderAICharts(result.insights, mode === 'auto');
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (err) {
            console.error(err);
            alert('⚠️ Network error. Could not connect to OpenAI Backend.');
        } finally {
            aiLoader.classList.add('hidden');
            btnAutoAI.disabled = false;
            btnCustomAI.disabled = false;
        }
    }

    btnAutoAI.addEventListener('click', () => executeAI("Generate comprehensive deep analytical dashboard", "auto", 5));
    btnCustomAI.addEventListener('click', () => {
        const q = aiQuestion.value.trim();
        if(!q) return alert("Please type your question first.");
        executeAI(q, "custom", 1);
    });

    // --- Render Premium AI Charts ---
    function renderAICharts(insights, isAuto) {
        if(isAuto) {
            aiChartsContainer.innerHTML = '';
            allCharts.forEach(c => c.destroy());
            allCharts = [];
        }

        insights.forEach((item, idx) => {
            let chartId = `aiPremChart_${Date.now()}_${idx}`; 
            let wrapper = document.createElement('div');
            wrapper.className = 'bg-gradient-to-b from-[#0d1117] to-[#010409] p-6 rounded-2xl border border-blue-900/50 flex flex-col shadow-2xl relative overflow-hidden transition-all hover:border-blue-700/60';

            // Premium AI Tag
            let tag = `<div class="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-lg">PREMIUM AI</div>`;

            wrapper.innerHTML = `
                ${tag}
                <h3 class="text-base font-bold text-white mb-5 flex items-center mt-3">
                    <span class="mr-3 text-xl bg-blue-500/20 p-2 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">🧠</span> ${item.chartTitle}
                </h3>
                
                <div class="relative w-full h-[280px]">
                    <canvas id="${chartId}"></canvas>
                </div>
                
                <div class="mt-6 space-y-3 text-sm bg-[#0d1117] p-5 rounded-xl border border-gray-800 shadow-inner">
                    <div class="flex items-start">
                        <span class="text-[#ff7b72] font-bold bg-[#da3633]/15 px-2.5 py-1 rounded text-xs min-w-[80px] text-center border border-[#da3633]/30 mr-3 mt-0.5 shadow-sm">⚠ Issue</span> 
                        <span class="text-gray-300 leading-relaxed">${item.issue}</span>
                    </div>
                    <div class="flex items-start">
                        <span class="text-[#79c0ff] font-bold bg-[#1f6feb]/15 px-2.5 py-1 rounded text-xs min-w-[80px] text-center border border-[#1f6feb]/30 mr-3 mt-0.5 shadow-sm">💡 Insight</span> 
                        <span class="text-gray-300 leading-relaxed">${item.insight}</span>
                    </div>
                    <div class="flex items-start">
                        <span class="text-[#56d364] font-bold bg-[#238636]/15 px-2.5 py-1 rounded text-xs min-w-[80px] text-center border border-[#238636]/30 mr-3 mt-0.5 shadow-sm">🚀 Action</span> 
                        <span class="text-gray-300 leading-relaxed">${item.action}</span>
                    </div>
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
                        label: 'Analysis Metrics',
                        data: item.values,
                        backgroundColor: ['#388bfd', '#2ea043', '#f59e0b', '#f85149', '#a371f7', '#2cb67d'],
                        borderRadius: type === 'bar' ? 6 : 0,
                        borderWidth: type === 'pie' || type === 'doughnut' ? 2 : 2,
                        borderColor: type === 'line' ? '#388bfd' : '#010409',
                        fill: type === 'line' ? true : false,
                        backgroundColor: type === 'line' ? 'rgba(56, 139, 253, 0.15)' : undefined,
                        tension: 0.4 // Smooth curves for lines
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, color: '#8b949e',
                    plugins: { legend: { display: type !== 'bar', labels: {color:'#8b949e', font:{family:'Inter'}} } },
                    scales: (type === 'pie' || type === 'doughnut') ? {} : {
                        x: { ticks: { color: '#8b949e', font:{family:'Inter'} }, grid: { display: false } },
                        y: { ticks: { color: '#8b949e', font:{family:'Inter'} }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
                    }
                }
            });
            allCharts.push(newChart);
        });
        
        aiSectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 4. PDF EXPORT (-1 TOKEN) & CLEAR
    // ==========================================
    btnPDF.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email || currentTokens < 1) return alert("You need 1 token to download the PDF report.");
        
        const originalText = btnPDF.innerHTML;
        btnPDF.innerHTML = '<span class="loader inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full mr-2"></span> Packing PDF...';
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
                
                await html2pdf().set({
                    margin: [0.3, 0.3],
                    filename: `DashupData_Intelligence_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
                }).from(element).save();
                
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

    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Clear all visual data and start fresh?')) location.reload();
    });
});
