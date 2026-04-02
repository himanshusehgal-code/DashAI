// 🚨 UPDATE WITH YOUR SERVER URL (Google Apps Script for Tokens) 🚨
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

// 🚨 RENDER BACKEND URL (Python API for Files) 🚨
const RENDER_BASE_URL = 'https://support-dashupdata.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const actionPanelWrapper = document.getElementById('actionPanelWrapper');
    const dashboardContent = document.getElementById('dashboardContent');
    const rawDataSection = document.getElementById('rawDataSection'); 
    
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const kpiContainer = document.getElementById('kpiContainer');
    const freeChartsContainer = document.getElementById('freeChartsContainer');
    const aiSectionWrapper = document.getElementById('aiSectionWrapper');
    const aiChartsContainer = document.getElementById('aiChartsContainer');
    
    const btnAutoAI = document.getElementById('btnAutoAI');
    const btnCustomAI = document.getElementById('btnCustomAI');
    const btnPDF = document.getElementById('btnPDF');
    const btnPivot = document.getElementById('btnPivot'); 
    const btnDownloadCSV = document.getElementById('btnDownloadCSV');
    const aiQuestion = document.getElementById('aiQuestion');
    const aiLoader = document.getElementById('aiLoader');
    
    const loginBtn = document.getElementById('loginBtn');
    const userEmailInput = document.getElementById('userEmail');
    const tokenCount = document.getElementById('tokenCount');
    const authStatus = document.getElementById('authStatus');
    
    let allCharts = [];
    let freeCharts = [];
    let aiPayloadData = ""; 
    let originalCSVData = ""; 
    let currentTokens = 0;

    let isUserTriggered = false;

    // ==========================================
    // 1. AUTHENTICATION & SYNC (Google Apps Script)
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
                }
            } catch (err) {
                console.error(err);
                loginBtn.innerHTML = '🔄 Sync Account';
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
    // 2. CSV UPLOAD LOGIC
    // ==========================================
    dropZone.addEventListener('click', (e) => { if (e.target.id !== 'fileInput') fileInput.click(); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-900/10'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500', 'bg-blue-900/10'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('border-blue-500', 'bg-blue-900/10');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); e.target.value = ''; });
    
    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 1) {
                    originalCSVData = Papa.unparse(results.data);
                    aiPayloadData = Papa.unparse(results.data.slice(0, 50)); 
                    generateKPICards(results.data);
                    generateFreeDynamicCharts(results.data);
                    renderDataPreview(results.data.slice(0, 50)); 
                    dropZone.classList.add('hidden');
                    actionPanelWrapper.classList.remove('hidden'); 
                    dashboardContent.classList.remove('hidden');
                }
            }
        });
    };

    // ==========================================
    // 🔥 3. PIVOT GENERATION (Token -1 then Render)
    // ==========================================
    btnPivot.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email) return alert("Please Sync your Account first.");
        if(currentTokens < 1) return alert("❌ Insufficient tokens. You need 1 token to generate pivots.");
        if(!originalCSVData) return alert("Please upload data first.");

        const originalText = btnPivot.innerHTML;
        btnPivot.innerHTML = '<span class="loader inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full mr-2"></span> Processing (May take 50s)...';
        btnPivot.disabled = true;

        try {
            // Step 1: Token deduct karo GAS par
            const tokenRes = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'deductPivotToken', email: email })
            });
            const tokenData = await tokenRes.json();

            if(tokenData.status === 'success') {
                currentTokens -= 1;
                tokenCount.innerText = currentTokens;

                // Step 2: Render Backend se Pivot file lo
                const response = await fetch(`${RENDER_BASE_URL}/generate-pivot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csv_data: originalCSVData })
                });

                if (!response.ok) throw new Error("Render server failed to process pivots.");

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Pivot_Summary_${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error(tokenData.message);
            }
        } catch(err) {
            alert('Pivot Error: ' + err.message);
        } finally {
            btnPivot.innerHTML = originalText;
            btnPivot.disabled = false;
        }
    });

    // ==========================================
    // 🔥 4. PDF EXPORT (Token -1 then Render Playwright)
    // ==========================================
    btnPDF.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if(!email) return alert("Please Sync your Account first.");
        if(currentTokens < 1) return alert("❌ Insufficient tokens. You need 1 token for PDF report.");
        
        const originalText = btnPDF.innerHTML;
        btnPDF.innerHTML = '<span class="loader inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full mr-2"></span> Waking Server (Wait 50s)...';
        btnPDF.disabled = true;

        try {
            // Step 1: Token deduct karo GAS par
            const tokenRes = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'deductPdfToken', email: email })
            });
            const tokenData = await tokenRes.json();
            
            if(tokenData.status === 'success') {
                currentTokens -= 1;
                tokenCount.innerText = currentTokens;
                
                // Step 2: Render se Playwright PDF mangwao
                const currentUrl = window.location.href; 
                const pdfRes = await fetch(`${RENDER_BASE_URL}/export-dashboard-pdf?url=${encodeURIComponent(currentUrl)}`, {
                    method: 'POST'
                });
                
                if (!pdfRes.ok) throw new Error("Render server failed to generate clean PDF.");
                
                const blob = await pdfRes.blob();
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `AI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error(tokenData.message);
            }
        } catch(err) {
            alert('PDF Export Failed: ' + err.message);
        } finally {
            btnPDF.innerHTML = originalText;
            btnPDF.disabled = false;
        }
    });

    // ==========================================
    // 5. UTILITY FUNCTIONS (Charts, KPI, etc.)
    // ==========================================
    function generateKPICards(rows) {
        const totalRows = rows.length;
        const headers = Object.keys(rows[0]);
        let totalSum = 0;
        let sumColName = "Value";
        for (let h of headers) {
            let isNum = true;
            for (let i=0; i<Math.min(20, rows.length); i++) {
                let val = parseFloat(String(rows[i][h]).replace(/,/g, '').replace(/\$/g, ''));
                if (isNaN(val)) { isNum = false; break; }
            }
            if (isNum && !(/id|zip|phone|date/i.test(h))) {
                sumColName = h;
                rows.forEach(r => { totalSum += parseFloat(String(r[h]).replace(/,/g, '').replace(/\$/g, '')) || 0; });
                break;
            }
        }
        let sumDisplay = totalSum > 1000000 ? (totalSum/1000000).toFixed(2) + 'M' : (totalSum > 1000 ? (totalSum/1000).toFixed(1) + 'k' : Math.round(totalSum));
        kpiContainer.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-blue-500 chart-card">
                    <div class="text-gray-400 text-xs font-bold uppercase">📄 Total Records</div>
                    <div class="text-2xl font-black text-white mt-1">${totalRows.toLocaleString()}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-green-500 chart-card">
                    <div class="text-gray-400 text-xs font-bold uppercase">💰 Total ${sumColName}</div>
                    <div class="text-2xl font-black text-white mt-1">${sumDisplay}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-purple-500 chart-card">
                    <div class="text-gray-400 text-xs font-bold uppercase">📊 Data Columns</div>
                    <div class="text-2xl font-black text-white mt-1">${headers.length}</div>
                </div>
                <div class="bg-[#161b22] p-4 rounded-xl border border-gray-700 shadow-lg border-l-4 border-l-yellow-500 chart-card">
                    <div class="text-gray-400 text-xs font-bold uppercase">⚡ System Status</div>
                    <div class="text-2xl font-black text-white mt-1">Optimized</div>
                </div>
            </div>`;
    }

    function generateFreeDynamicCharts(rows) {
        const headers = Object.keys(rows[0]);
        let numericCols = [];
        let categoryCols = [];
        headers.forEach(h => {
            let isNum = true;
            let uniqueVals = new Set();
            rows.slice(0, 100).forEach(r => {
                uniqueVals.add(r[h]);
                if (isNaN(parseFloat(String(r[h]).replace(/,/g, '')))) isNum = false;
            });
            if (isNum && !(/id|zip|phone|date/i.test(h))) numericCols.push(h);
            else if (!isNum && uniqueVals.size > 1 && uniqueVals.size <= 15) categoryCols.push(h);
        });
        let bestNum = numericCols[0] || headers[0];
        freeChartsContainer.innerHTML = '';
        categoryCols.slice(0, 2).forEach((cat, idx) => {
            let aggregated = {};
            rows.forEach(r => {
                let key = r[cat] || "Unknown";
                aggregated[key] = (aggregated[key] || 0) + (parseFloat(String(r[bestNum]).replace(/,/g, '')) || 0);
            });
            let chartId = `freeChart_${idx}`;
            let wrap = document.createElement('div');
            wrap.className = 'chart-card bg-[#161b22] p-5 rounded-2xl border border-gray-700/50 flex flex-col shadow-lg relative h-[350px]';
            wrap.innerHTML = `<h3 class="text-sm font-bold text-gray-200 mb-4">📊 ${bestNum} by ${cat}</h3><canvas id="${chartId}"></canvas>`;
            freeChartsContainer.appendChild(wrap);
            new Chart(document.getElementById(chartId), {
                type: idx === 0 ? 'bar' : 'pie',
                data: {
                    labels: Object.keys(aggregated).slice(0, 10),
                    datasets: [{ data: Object.values(aggregated).slice(0, 10), backgroundColor: ['#1f6feb', '#238636', '#f59e0b', '#da3633', '#8957e5'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        });
    }

    const renderDataPreview = (dataSlice) => {
        const headers = Object.keys(dataSlice[0]);
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-6 py-4 font-bold text-xs uppercase tracking-wider">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = dataSlice.map(row => `<tr class="hover:bg-gray-800/40 transition-colors">${headers.map(h => `<td class="px-6 py-3">${row[h] || '-'}</td>`).join('')}</tr>`).join('');
    };

    btnAutoAI.addEventListener('click', () => { isUserTriggered = true; executeAI("Full Dashboard Analysis", "auto", 5); });
    btnCustomAI.addEventListener('click', () => { isUserTriggered = true; executeAI(aiQuestion.value, "custom", 1); });

    async function executeAI(q, mode, cost) {
        if (!isUserTriggered || currentTokens < cost) return alert("Insufficient tokens.");
        aiLoader.classList.remove('hidden');
        try {
            const res = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ action: 'runInsight', email: sessionStorage.getItem('dashupdata_email'), question: q, dataSummary: aiPayloadData, mode: mode })
            });
            const result = await res.json();
            if (result.status === 'success') {
                currentTokens -= cost;
                tokenCount.innerText = currentTokens;
                aiSectionWrapper.classList.remove('hidden');
                renderAICharts(result.insights, mode === 'auto');
            }
        } catch (e) { console.error(e); } finally { aiLoader.classList.add('hidden'); }
    }

    function renderAICharts(insights, isAuto) {
        if(isAuto) aiChartsContainer.innerHTML = '';
        insights.forEach((item, idx) => {
            let chartId = `aiChart_${Date.now()}_${idx}`;
            let wrapper = document.createElement('div');
            wrapper.className = 'chart-card bg-[#0d1117] p-6 rounded-2xl border border-blue-900/50 shadow-2xl mb-4';
            wrapper.innerHTML = `<h3 class="text-base font-bold text-white mb-4">📈 ${item.chartTitle}</h3><div class="h-[250px]"><canvas id="${chartId}"></canvas></div><div class="mt-4 text-sm text-gray-400"><b>Insight:</b> ${item.insight}</div>`;
            aiChartsContainer.prepend(wrapper);
            new Chart(document.getElementById(chartId), {
                type: item.type || 'bar',
                data: { labels: item.labels, datasets: [{ label: 'Metric', data: item.values, backgroundColor: '#388bfd' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        });
    }

    document.getElementById('btnClear').addEventListener('click', () => { if(confirm('Fresh Start?')) location.reload(); });
});
