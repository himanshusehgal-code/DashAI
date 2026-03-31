// app.js

// 🚨 CONFIGURATION 🚨
// Set this to your deployed Render backend URL when pushing to GitHub Pages.
// For local testing, leave as 'http://localhost:3000'
const API_BASE_URL = 'https://dashai-backend.onrender.com'; // Update this before final deployment!

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

    // --- Authentication & Token Management ---
    const loadUser = async () => {
        const email = sessionStorage.getItem('dashai_email');
        if (email) {
            userEmailInput.value = email;
            try {
                loginBtn.innerText = 'Syncing...';
                const res = await fetch(`${API_BASE_URL}/api/user`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email })
                });
                
                if(res.ok) {
                    const data = await res.json();
                    tokenCount.innerText = data.tokens;
                    if(data.tokens === 9999) tokenCount.innerText = 'Unlimited (Pro)';
                    authStatus.classList.remove('hidden');
                    loginBtn.innerText = 'Account Linked';
                    loginBtn.classList.replace('bg-white', 'bg-gray-800');
                    loginBtn.classList.replace('text-black', 'text-white');
                } else {
                    throw new Error('Server error');
                }
            } catch (err) {
                console.error('Failed to sync user data', err);
                loginBtn.innerText = 'Connect Account';
                alert('Could not connect to backend server. Ensure backend is running.');
            }
        }
    };

    // Load user on start if exists
    loadUser();

    loginBtn.addEventListener('click', () => {
        const emailVal = userEmailInput.value.trim();
        if(emailVal) {
            sessionStorage.setItem('dashai_email', emailVal);
            loadUser();
        } else {
            alert('Please enter a valid email.');
        }
    });

    // --- File Upload & CSV Parsing ---
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dropZone.classList.add('border-blue-500', 'bg-blue-500/10'); 
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    const handleFile = (file) => {
        if(!file.name.endsWith('.csv')) return alert('Please upload a valid CSV file.');
        
        Papa.parse(file, {
            header: true,
            dynamicTyping: true, // Automatically converts numbers
            skipEmptyLines: true,
            complete: (results) => {
                if(results.data && results.data.length > 0) {
                    currentData = results.data;
                    renderDashboard(currentData);
                } else {
                    alert('CSV file is empty or invalid.');
                }
            },
            error: () => alert('Error parsing CSV file.')
        });
    };

    // --- Dashboard Rendering ---
    const renderDashboard = (data) => {
        dropZone.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        dashboardContent.classList.remove('hidden');
        
        const headers = Object.keys(data[0]);
        
        // Render Table (Limit to 50 rows for UI performance)
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="px-4 py-3 font-medium">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = data.slice(0, 50).map(row => 
            `<tr>${headers.map(h => `<td class="px-4 py-2">${row[h] !== null ? row[h] : '-'}</td>`).join('')}</tr>`
        ).join('');

        // Render Chart
        // 1. Find a string column for X-axis labels (or fallback to index)
        const labelHeader = headers.find(h => typeof data[0][h] === 'string') || headers[0];
        const labels = data.map(row => row[labelHeader] || 'N/A').slice(0, 30); // Max 30 points for cleanliness
        
        // 2. Find a numeric column for Y-axis values
        const numericHeader = headers.find(h => typeof data[0][h] === 'number' && h !== labelHeader);
        const values = data.map(row => row[numericHeader] || 0).slice(0, 30);

        if (chartInstance) chartInstance.destroy();
        
        const ctx = document.getElementById('mainChart').getContext('2d');
        Chart.defaults.color = '#9ca3af';
        Chart.defaults.font.family = 'Inter, sans-serif';

        chartInstance = new Chart(ctx, {
            type: 'bar', // Can be expanded to dynamic types later
            data: {
                labels: labels,
                datasets: [{
                    label: numericHeader || 'Dataset Value',
                    data: values,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    hoverBackgroundColor: 'rgba(96, 165, 250, 1)',
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: { backgroundColor: 'rgba(17, 24, 39, 0.9)', padding: 12, cornerRadius: 8 }
                },
                scales: { 
                    x: { grid: { display: false, drawBorder: false } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, beginAtZero: true }
                }
            }
        });
    };

    // --- AI Integration ---
    btnAI.addEventListener('click', async () => {
        const email = sessionStorage.getItem('dashai_email');
        if (!email) return alert('🔒 Please connect your account in the sidebar to use AI features.');
        
        // UI State: Loading
        aiBtnText.innerText = 'Analyzing Data...';
        aiLoader.classList.remove('hidden');
        btnAI.disabled = true;
        btnAI.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            // Send max 2000 chars of data to save payload size and token limits
            const payloadData = currentData.slice(0, 50); 
            
            const res = await fetch(`${API_BASE_URL}/api/analyze`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ email, data: payloadData })
            });
            
            const result = await res.json();
            
            if (res.ok) {
                // UI State: Success
                aiPanel.classList.remove('hidden');
                
                // Format plain text to HTML-ish for better readability if needed
                let formattedText = result.insights.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
                aiResult.innerHTML = formattedText;
                
                // Update Tokens
                tokenCount.innerText = result.tokensLeft === 9999 ? 'Unlimited (Pro)' : result.tokensLeft;
                
                // Scroll to result
                aiPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                if(res.status === 403) {
                    alert('❌ Insufficient tokens. Please upgrade to Pro.');
                    window.location.href = 'pricing.html';
                } else {
                    alert(`Error: ${result.error || 'Failed to generate insights'}`);
                }
            }
        } catch (err) {
            console.error(err);
            alert('⚠️ Network error. Is the backend server running?');
        } finally {
            // UI State: Reset
            aiBtnText.innerText = 'Run AI Analyst (-1 Token)';
            aiLoader.classList.add('hidden');
            btnAI.disabled = false;
            btnAI.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });

    // --- PDF Export ---
    document.getElementById('btnPDF').addEventListener('click', () => {
        const element = document.getElementById('pdf-export-area');
        
        // Temporary style adjustments for PDF
        element.style.backgroundColor = '#0a0a0a';
        
        html2pdf().set({
            margin: [0.5, 0.5],
            filename: `DashAI_Export_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        }).from(element).save().then(() => {
            element.style.backgroundColor = ''; // restore
        });
    });

    // --- Clear Workspace ---
    document.getElementById('btnClear').addEventListener('click', () => {
        if(confirm('Clear all current data?')) {
            currentData = [];
            dropZone.classList.remove('hidden');
            actionPanel.classList.add('hidden');
            dashboardContent.classList.add('hidden');
            aiPanel.classList.add('hidden');
            fileInput.value = ''; // reset file input
            if(chartInstance) chartInstance.destroy();
        }
    });
});
