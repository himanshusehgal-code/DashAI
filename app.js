// app.js

// 🚨 UPDATE WITH YOUR SERVER URL 🚨
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const actionPanelWrapper = document.getElementById('actionPanelWrapper'); // For sticky
    const dashboardContent = document.getElementById('dashboardContent');
    const rawDataSection = document.getElementById('rawDataSection'); // For PDF hiding
    
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const kpiContainer = document.getElementById('kpiContainer');
    const freeChartsContainer = document.getElementById('freeChartsContainer');
    const aiSectionWrapper = document.getElementById('aiSectionWrapper');
    const aiChartsContainer = document.getElementById('aiChartsContainer');
    
    const btnAutoAI = document.getElementById('btnAutoAI');
    const btnCustomAI = document.getElementById('btnCustomAI');
    const btnPDF = document.getElementById('btnPDF');
    const btnDownloadCSV = document.getElementById('btnDownloadCSV');
    const aiQuestion = document.getElementById('aiQuestion');
    const aiLoader = document.getElementById('aiLoader');
    
    const loginBtn = document.getElementById('loginBtn');
    const userEmailInput = document.getElementById('userEmail');
    const tokenCount = document.getElementById('tokenCount');
    const authStatus = document.getElementById('authStatus');
    
    let allCharts = [];
    let freeCharts = [];
    let aiPayloadData = ""; // limited string for API
    let originalCSVData = ""; // Full string for CSV download
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
    // 2. CSV UPLOAD, PARSING & FREE CHARTS
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
                    
                    // Save Full String for Downloading later
                    originalCSVData = Papa.unparse(results.data);
                    
                    // Prepare data for AI (max 50 rows)
                    aiPayloadData = Papa.unparse(results.data.slice(0, 50)); 
                    
                    generateKPICards(results.data);
                    generateFreeDynamicCharts(results.data);
                    renderDataPreview(results.data.slice(0, 50)); 
                    
                    dropZone.classList.add('hidden');
                    actionPanelWrapper.classList.remove('hidden'); // Show Sticky panel wrapper
                    dashboardContent.classList.remove('hidden');

                    // Auto Trigger AI
                    setTimeout(() => {
                        if (currentTokens >= 5) btnAutoAI.click();
                    }, 800);

                } else {
                    alert('CSV file is empty or invalid.');
                }
            }
        });
    };

    // --- CSV Download Event ---
    btnDownloadCSV.addEventListener('click', () => {
        if(!originalCSVData) return alert("No data available to download.");
        const blob = new Blob([originalCSVData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `DashupData_Export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    function generateKPICards(rows) {
        const totalRows = rows.length;
        const headers = Object.keys(rows[0]);
        let totalSum = 0;
        let sumColName = "Value";

        for (let h of headers) {
            let isNum = true;
            let sum = 0;
            for (let i=0; i<Math.min(50, rows.length); i++) {
                let r = rows[i];
                let cleanVal = String(r[h]).replace(/,/g, '').replace(/\$/g, '').trim();
                let val = parseFloat(cleanVal);
                if (isNaN(val)) { isNum = false; break; }
                sum += val;
            }
            if (isNum && !(/id|zip|phone|date/i.test(h))) {
                sumColName = h;
                rows.forEach(r => {
                    let v = parseFloat(String(r[h]).replace(/,/g, '').replace(/\$/g, '')) || 0;
                    totalSum += v;
                });
                break;
            }
        }

        let sumDisplay = totalSum > 1000000 ? (totalSum/1000000).toFixed(2) + 'M' : (totalSum > 1000 ? (totalSum/1000).toFixed(1) + 'k' : Math.round(totalSum));

        kpiContainer.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-blue-500">
                    <div class="text-gray-400 text-xs font-bold uppercase">📄 Total Records</div>
                    <div class="text-2xl font-black text-white mt-1">${totalRows.toLocaleString()}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-green-500">
                    <div class="text-gray-400 text-xs font-bold uppercase">💰 Total ${sumColName}</div>
                    <div class="text-2xl font-black text-white mt-1">${sumDisplay}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-purple-500">
                    <div class="text-gray-400 text-xs font-bold uppercase">📊 Data Columns</div>
                    <div class="text-2xl font-black text-white mt-1">${headers.length}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-yellow-500">
                    <div class="text-gray-400 text-xs font-bold uppercase">⚡ System Status</div>
                    <div class="text-2xl font-black text-white mt-1">Optimized</div>
                </div>
            </div>
        `;
    }

    function generateFreeDynamicCharts(rows) {
        const headers = Object.keys(rows[0]);
        let numericCols = [];
        let categoryCols = [];

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
            let isExcluded = /id|zip|phone|date|email|name/i.test(colName);

            if (isNum && !isExcluded) numericCols.push({ name: h });
            else if (!isNum && uniqueVals.size > 1 && uniqueVals.size <= 50 && !isExcluded) categoryCols.push({ name: h, uniqueCount: uniqueVals.size });
        });

        let bestNumCol = numericCols.find(c => /sale|profit|price|amount|revenue|total|qty/i.test(c.name)) || numericCols[numericCols.length - 1];

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
                    let value = parseFloat(String(r[bestNumCol.name]).replace(/,/g, '').replace(/\$/g, '')) || 0;

                    if (!aggregatedData[category]) aggregatedData[category] = 0;
                    aggregatedData[category] += value;
                });

                let sortedData = Object.entries(aggregatedData).sort((a,b) => b[1] - a[1]).slice(0, 8);
                const labels = sortedData.map(item => item[0]);
                const vals = sortedData.map(item => item[1]);

                let chartType = catCol.uniqueCount <= 5 ? (idx % 2 === 0 ? 'doughnut' : 'pie') : 'bar';
                let chartId = `freeChart_${Date.now()}_${idx}`;

                let wrapper = document.createElement('div');
                wrapper.className = 'bg-[#161b22] p-5 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg relative overflow-hidden';
                
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
    // 3. PREMIUM AI LOGIC
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

        if (mode === 'custom') {
            aiChartsContainer.innerHTML = `
                <div class="col-span-full text-center text-blue-400 font-bold py-10 bg-[#0d1117] rounded-2xl border border-blue-900/30 shadow-inner flex flex-col items-center justify-center">
                    <div class="loader h-8 w-8 rounded-full border-4 border-t-4 border-blue-500 mb-4"></div>
                    🧠 Generating AI Insight for: "${question}"
                </div>
            ` + aiChartsContainer.innerHTML;
            aiSectionWrapper.classList.remove('hidden');
            aiSectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

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
                
                if (mode === 'custom') aiChartsContainer.firstElementChild.remove();

                renderAICharts(result.insights, mode === 'auto');
            } else {
                alert(`Error: ${result.message}`);
                if(mode === 'custom') aiChartsContainer.firstElementChild.remove();
            }
        } catch (err) {
            console.error(err);
            alert('⚠️ Network error. Could not connect to Backend.');
            if(mode === 'custom') aiChartsContainer.firstElementChild.remove();
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

            let tag = `<div class="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl shadow-lg">PREMIUM AI</div>`;

            wrapper.innerHTML = `
                ${tag}

                <div class="flex items-center justify-between mb-4 mt-3">
                    <h3 class="text-base font-bold text-white flex items-center">
                        <span class="mr-3 text-xl bg-blue-500/20 p-2 rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">📊</span> ${item.chartTitle}
                    </h3>
                </div>

                <div class="relative w-full h-[260px]">
                    <canvas id="${chartId}"></canvas>
                </div>

                <div class="mt-5 grid gap-3 text-sm">
                    <div class="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl shadow-inner">
                        <div class="text-red-400 font-bold text-xs mb-1.5 uppercase tracking-wide flex items-center"><span class="mr-2">⚠</span> Issue Detected</div>
                        <div class="text-gray-300 leading-relaxed font-medium">${item.issue}</div>
                    </div>

                    <div class="bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl shadow-inner">
                        <div class="text-blue-400 font-bold text-xs mb-1.5 uppercase tracking-wide flex items-center"><span class="mr-2">💡</span> Insight</div>
                        <div class="text-gray-300 leading-relaxed font-medium">${item.insight}</div>
                    </div>

                    <div class="bg-green-500/10 border border-green-500/20 p-3.5 rounded-xl shadow-inner">
                        <div class="text-green-400 font-bold text-xs mb-1.5 uppercase tracking-wide flex items-center"><span class="mr-2">🚀</span> Action Suggested</div>
                        <div class="text-gray-300 leading-relaxed font-medium">${item.action}</div>
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
                        tension: 0.4
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
        
        if(isAuto) aiSectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 4. PDF EXPORT (Hide Table logic included)
    // ==========================================
    btnPDF.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email || currentTokens < 1) return alert("You need 1 token to download the PDF report.");
        
        const originalText = btnPDF.innerHTML;
        btnPDF.innerHTML = '<span class="loader inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full mr-2"></span> Packing PDF...';
        btnPDF.disabled = true;

        // 🔥 PDF Exclusions - Temporary Hiding 🔥
        actionPanelWrapper.style.display = 'none'; // Hide the sticky control buttons
        rawDataSection.style.display = 'none'; // Hide the Raw Table permanently from PDF

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
            // 🔥 Restore Elements 🔥
            actionPanelWrapper.style.display = 'block';
            rawDataSection.style.display = 'block';
            btnPDF.innerHTML = originalText;
            btnPDF.disabled = false;
        }
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Clear all visual data and start fresh?')) location.reload();
    });
});
