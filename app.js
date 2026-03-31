// app.js

// 🚨 UPDATE: Apna Google Apps Script Web App URL yahan daalein
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const actionPanel = document.getElementById('actionPanel');
    const dashboardContent = document.getElementById('dashboardContent');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const aiPanel = document.getElementById('aiPanel');
    const aiResult = document.getElementById('aiResult');
    const btnAI = document.getElementById('btnAI');
    const aiLoader = document.getElementById('aiLoader');
    const aiBtnText = document.getElementById('aiBtnText');
    const loginBtn = document.getElementById('loginBtn');
    const userEmailInput = document.getElementById('userEmail');
    const tokenCount = document.getElementById('tokenCount');
    const authStatus = document.getElementById('authStatus');
    
    let chartInstance = null;
    let currentData = [];

    // --- Google Apps Script (GAS) Fetch Helper ---
    // GAS CORS se bachne ke liye Content-Type 'text/plain' rakhna padta hai
    const fetchGAS = async (payload) => {
        const res = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    };

    // --- Authentication & Token Management (Syncs with Google Sheet) ---
    const loadUser = async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if (email) {
            userEmailInput.value = email;
            try {
                loginBtn.innerText = 'Syncing...';
                
                // Backend call to check/create user
                const data = await fetchGAS({ action: 'getUserInfo', email: email });
                
                if(data.status === 'success') {
                    tokenCount.innerText = data.tokens;
                    
                    authStatus.classList.remove('hidden');
                    loginBtn.innerText = 'Account Linked';
                    loginBtn.classList.replace('bg-white', 'bg-gray-800');
                    loginBtn.classList.replace('text-black', 'text-white');
                    userEmailInput.classList.add('cursor-not-allowed', 'opacity-50');
                    userEmailInput.readOnly = true;
                } else {
                    throw new Error(data.message || 'Server error');
                }
            } catch (err) {
                console.error('Failed to sync user data', err);
                loginBtn.innerText = 'Register Email';
                alert('Could not connect to Google Sheets backend.');
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
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
    
    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        Papa.parse(file, {
            header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 0) {
                    currentData = results.data;
                    renderDashboard(currentData);
                } else alert('CSV file is empty or invalid.');
            }
        });
    };

    // --- Chart Rendering Logic ---
    const renderChart = (labels, values, labelTitle, chartType = 'bar') => {
        if (chartInstance) chartInstance.destroy();
        const ctx = document.getElementById('mainChart').getContext('2d');
        Chart.defaults.color = '#9ca3af';

        chartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: labelTitle || 'Dataset Value',
                    data: values,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true } }
            }
        });
    }

    // --- Dashboard Rendering ---
    const renderDashboard = (data) => {
        dropZone.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        dashboardContent.classList.remove('hidden');
        
        const headers = Object.keys(data[0]);
        
        // Render Table (Max 50 rows)
        if(tableHead) tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-4 py-3">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = data.slice(0, 50).map(row => 
            `<tr>${headers.map(h => `<td class="px-4 py-2">${row[h] !== null ? row[h] : '-'}</td>`).join('')}</tr>`
        ).join('');
        
        // Initial Basic Chart
        const labelHeader = headers.find(h => typeof data[0][h] === 'string') || headers[0];
        const labels = data.map(row => row[labelHeader] || 'N/A').slice(0, 30);
        const numericHeader = headers.find(h => typeof data[0][h] === 'number' && h !== labelHeader);
        const values = data.map(row => row[numericHeader] || 0).slice(0, 30);

        renderChart(labels, values, numericHeader, 'bar');
    };

    // --- AI Integration (Sends to GAS backend) ---
    btnAI.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashupdata_email');
        if (!email) return alert('🔒 Please register your email account first.');
        
        let currentTokens = parseInt(tokenCount.innerText) || 0;
        if (currentTokens <= 0) {
            alert('❌ Insufficient tokens. Please upgrade your plan.');
            window.location.href = 'pricing.html';
            return;
        }

        aiBtnText.innerText = 'Analyzing Data...';
        aiLoader.classList.remove('hidden');
        btnAI.disabled = true;

        try {
            const payloadData = currentData.slice(0, 50); // Send partial data to save API tokens
            
            const result = await fetchGAS({ 
                action: 'runInsight', 
                email: email, 
                question: "Analyze this dataset and give me the top insights.", 
                dataSummary: JSON.stringify(payloadData) 
            });
            
            if (result.status === 'success' && result.insights) {
                aiPanel.classList.remove('hidden');
                
                // Get the first insight from OpenAI JSON response
                const insightData = result.insights[0]; 
                
                aiResult.innerHTML = `
                    <div class="mb-4"><strong class="text-blue-400">🔍 Issue Detected:</strong> <br/> ${insightData.issue}</div>
                    <div class="mb-4"><strong class="text-green-400">💡 AI Insight:</strong> <br/> ${insightData.insight}</div>
                    <div><strong class="text-yellow-400">⚡ Recommended Action:</strong> <br/> ${insightData.action}</div>
                `;
                
                // Update chart based on AI parameters
                renderChart(insightData.labels, insightData.values, insightData.chartTitle, insightData.type || 'bar');
                
                // Deduct token locally for UI update
                tokenCount.innerText = currentTokens - 1;
                aiPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(`Error: AI returned invalid data. Check backend logs.`);
            }
        } catch (err) {
            console.error(err);
            alert('⚠️ Network error while fetching AI Insights.');
        } finally {
            aiBtnText.innerText = 'Run AI Analyst (-1 Token)';
            aiLoader.classList.add('hidden');
            btnAI.disabled = false;
        }
    });

    // Clear and Export handlers remaining same...
    document.getElementById('btnClear').addEventListener('click', () => location.reload());
});
