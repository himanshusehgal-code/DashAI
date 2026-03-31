// app.js

// 🚨 UPDATE THIS URL to your Google Apps Script Web App URL 🚨
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentTokens = 0;
    let allCharts = [];
    let userEmail = sessionStorage.getItem('dashupdata_email'); // Must match what was saved in your login/index page
    let datasetSummary = ""; // Holds the CSV data text for the AI prompt

    // DOM Elements
    const userBadge = document.getElementById('userBadge');
    const csvFileInput = document.getElementById('csvFileInput');
    const uploadStatus = document.getElementById('upload-status');
    const btnAuto = document.getElementById('btn-auto');
    const btnCustom = document.getElementById('btn-custom');
    const btnPdf = document.getElementById('btn-pdf');
    const aiResponse = document.getElementById('ai-response');
    const vizBox = document.getElementById('viz-box');
    const emptyState = document.getElementById('empty-state');
    const dashTitle = document.getElementById('dash-title');
    const aiQuestion = document.getElementById('ai-question');

    // =====================================
    // 1. INITIALIZATION & AUTH
    // =====================================
    async function loadUser() {
        if (!userEmail) {
            userBadge.innerHTML = `<span class="text-red-400">Not Logged In. Please go back and enter email.</span>`;
            return;
        }

        try {
            const res = await fetch(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'getUserInfo', email: userEmail })
            });
            const data = await res.json();

            if (data.status === 'success') {
                updateUserUI(data.tokens);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error(err);
            userBadge.innerHTML = `<span class="text-red-400">Failed to sync tokens.</span>`;
        }
    }

    function updateUserUI(tokens) {
        currentTokens = tokens;
        userBadge.innerHTML = `
            <span style="color:#8b949e; overflow:hidden; text-overflow:ellipsis; max-width:180px;">👤 ${userEmail}</span>
            <span style="font-size:14px; background:#0b0e14; padding:4px 10px; border-radius:15px; color:#FFCC00; font-weight:bold; border: 1px solid #30363d;">🪙 ${tokens}</span>
        `;
    }

    loadUser();

    // =====================================
    // 2. CSV PARSING (Data Extraction)
    // =====================================
    csvFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        uploadStatus.classList.add('hidden');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            preview: 50, // Grab only the first 50 rows to avoid token limit errors with OpenAI
            complete: function(results) {
                if(results.data && results.data.length > 0) {
                    // Convert JSON array back to a simple CSV string for the AI prompt
                    datasetSummary = Papa.unparse(results.data);
                    uploadStatus.classList.remove('hidden');
                } else {
                    alert('The CSV file appears to be empty or invalid.');
                }
            },
            error: function(err) {
                alert('Error parsing CSV: ' + err.message);
            }
        });
    });

    // =====================================
    // 3. AI TRIGGER LOGIC
    // =====================================
    async function triggerAI(question, mode, cost) {
        if (!userEmail) return alert("Please log in first.");
        if (!datasetSummary) return alert("Please upload a CSV dataset first.");
        if (currentTokens < cost) {
            alert(`Insufficient tokens! You need ${cost} tokens for this action.`);
            window.location.href = 'pricing.html';
            return;
        }

        // UI Loading State
        aiResponse.style.display = 'block';
        aiResponse.innerHTML = `<span class="loader"></span> Analyzing data (Mode: ${mode.toUpperCase()})...`;
        aiResponse.style.borderColor = "#1f6feb";
        btnAuto.disabled = true;
        btnCustom.disabled = true;

        try {
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'runInsight',
                    email: userEmail,
                    question: question,
                    dataSummary: datasetSummary,
                    mode: mode
                })
            });

            const res = await response.json();

            if (res.status === 'success') {
                aiResponse.innerHTML = `✅ Success! Generated ${res.insights.length} charts.`;
                aiResponse.style.borderColor = "#238636";
                
                // Update local tokens immediately
                updateUserUI(currentTokens - res.tokensDeducted);
                
                // Render the charts
                renderAIInsights(res.insights, mode === 'auto');
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            aiResponse.innerHTML = `❌ Error: ${err.message}`;
            aiResponse.style.borderColor = "#da3633";
        } finally {
            btnAuto.disabled = false;
            btnCustom.disabled = false;
        }
    }

    btnAuto.addEventListener('click', () => {
        triggerAI("Generate a complete and comprehensive overview dashboard.", "auto", 5);
    });

    btnCustom.addEventListener('click', () => {
        const q = aiQuestion.value.trim();
        if (!q) return alert("Please type a specific question for the AI.");
        triggerAI(q, "custom", 1);
    });

    // =====================================
    // 4. CHART RENDERING
    // =====================================
    function renderAIInsights(insights, isAuto) {
        emptyState.style.display = 'none';
        dashTitle.style.display = 'block';
        btnPdf.style.display = 'block';
        vizBox.style.display = 'grid';
        
        if (isAuto) {
            vizBox.innerHTML = ''; // Clear existing dashboard if Auto is clicked
            allCharts.forEach(c => c.destroy());
            allCharts = [];
        }

        insights.forEach((item, idx) => {
            let chartId = `aiChart_${Date.now()}_${idx}`; 
            let wrapper = document.createElement('div');
            wrapper.className = 'chart-box';

            wrapper.innerHTML = `
                <h3>📊 ${item.chartTitle}</h3>
                <div class="canvas-wrapper"><canvas id="${chartId}"></canvas></div>
                <div class="ai-details-box">
                    <div style="margin-bottom:10px;">
                        <span class="ai-badge" style="background:#da363320; color:#ff7b72;">⚠ Issue Detected</span>
                        <div style="color:#c9d1d9;">${item.issue}</div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <span class="ai-badge" style="background:#1f6feb20; color:#79c0ff;">💡 AI Insight</span>
                        <div style="color:#c9d1d9;">${item.insight}</div>
                    </div>
                    <div>
                        <span class="ai-badge" style="background:#23863620; color:#56d364;">🚀 Recommended Action</span>
                        <div style="color:#c9d1d9;">${item.action}</div>
                    </div>
                </div>
            `;
            
            // Auto prepends all, Custom pushes to the top
            vizBox.prepend(wrapper); 

            const ctx = document.getElementById(chartId);
            
            // Map types safely (fallback to bar)
            const allowedTypes = ['bar', 'line', 'pie', 'doughnut', 'polarArea', 'radar'];
            let safeType = allowedTypes.includes(item.type) ? item.type : 'bar';

            let newChart = new Chart(ctx, {
                type: safeType,
                data: {
                    labels: item.labels,
                    datasets: [{
                        label: 'Metric Value',
                        data: item.values,
                        backgroundColor: ['#1f6feb', '#238636', '#8957e5', '#ff9800', '#da3633', '#f1e05a'],
                        borderColor: '#0b0e14',
                        borderWidth: safeType === 'pie' || safeType === 'doughnut' ? 2 : 1,
                        borderRadius: safeType === 'bar' ? 4 : 0,
                        tension: 0.3, // Curve for lines
                        fill: safeType === 'line' ? true : false
                    }]
                },
                options: {
                    responsive: true, 
                    maintainAspectRatio: false, 
                    color: '#c9d1d9',
                    plugins: { 
                        legend: { 
                            display: safeType !== 'bar' && safeType !== 'line', 
                            position: 'bottom', 
                            labels: { color: '#8b949e' } 
                        } 
                    },
                    scales: (safeType === 'pie' || safeType === 'doughnut' || safeType === 'polarArea' || safeType === 'radar') ? {} : {
                        x: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(255,255,255,0.05)'} },
                        y: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(255,255,255,0.05)'}, beginAtZero: true }
                    }
                }
            });
            allCharts.push(newChart);
        });
    }

    // =====================================
    // 5. PDF DOWNLOAD LOGIC
    // =====================================
    btnPdf.addEventListener('click', async () => {
        if (!userEmail) return;
        if (currentTokens < 1) {
            alert("You need 1 token to download the PDF report.");
            return;
        }
        
        const originalText = btnPdf.innerHTML;
        btnPdf.innerHTML = `<span class="loader"></span> Generating PDF...`;
        btnPdf.disabled = true;

        try {
            // Deduct Token in Backend
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'deductPdfToken', email: userEmail })
            });
            const res = await response.json();
            
            if (res.status === 'success') {
                // Update Local UI
                updateUserUI(currentTokens - 1);
                
                // Print Area Setup
                const element = document.getElementById('main-dashboard-area');
                
                // Hide PDF button temporarily so it doesn't show in PDF
                btnPdf.style.display = 'none';

                const opt = {
                    margin: 0.3,
                    filename: `DashupData_AI_Report_${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0b0e14' },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
                };
                
                await html2pdf().set(opt).from(element).save();
                
                // Restore button
                btnPdf.style.display = 'block';
                btnPdf.innerHTML = "✅ PDF Downloaded Successfully";
            } else {
                throw new Error(res.message);
            }
        } catch(err) {
            alert("PDF Error: " + err.message);
            btnPdf.innerHTML = originalText;
        } finally {
            setTimeout(() => { 
                btnPdf.innerHTML = originalText; 
                btnPdf.disabled = false; 
            }, 3000);
        }
    });

});
