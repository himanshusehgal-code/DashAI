const API_URL = "https://script.google.com/macros/s/AKfycbztwYUg3Joq4bvtubCnqcM6OpLHs1hvpGjvXyhGoSPwtI8doNBMEINTHkQ7jZr-OAR6/exec";

let email = "guest_user";
let dataSummary = "";

// 🔥 Load user
async function loadUser() {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "getUserInfo",
      email: email
    })
  });

  const data = await res.json();

  document.getElementById("userInfo").innerText =
    `${data.email} | Tokens: ${data.tokens}`;
}

// 🔥 Extract Sheet ID
function extractSheetId(input){
  if(input.includes("/d/")){
    return input.split("/d/")[1].split("/")[0];
  }
  return input;
}

// 🔥 Use Sheet
async function useSheet(){
  const input = document.getElementById("sheetInput").value;

  if(!input) return alert("Enter sheet link");

  const sheetId = extractSheetId(input);

  dataSummary = `Sheet ID: ${sheetId}`;

  document.getElementById("aiStatus").innerText = "Sheet connected ✅";
}

// 🔥 Upload CSV
function uploadCSV(){
  const file = document.getElementById("csvFile").files[0];

  if(!file) return alert("Select file");

  const reader = new FileReader();

  reader.onload = function(e){
    dataSummary = e.target.result.substring(0, 2000);
    document.getElementById("aiStatus").innerText = "CSV loaded ✅";
  };

  reader.readAsText(file);
}

// 🔥 Ask AI
async function askAI(){
  const q = document.getElementById("question").value;

  if(!q) return alert("Enter question");
  if(!dataSummary) return alert("Provide data first");

  document.getElementById("aiStatus").innerText = "Analyzing...";

  const res = await fetch(API_URL,{
    method:"POST",
    body: JSON.stringify({
      action:"runInsight",
      email:email,
      question:q,
      dataSummary:dataSummary
    })
  });

  const data = await res.json();

  if(data.status==="success"){
    renderCharts(data.insights);
    document.getElementById("aiStatus").innerText = "Done ✅";
  } else {
    document.getElementById("aiStatus").innerText = data.message;
  }
}

// 🔥 Charts
function renderCharts(insights){
  const box = document.getElementById("charts");
  box.innerHTML = "";

  insights.forEach((item)=>{
    const div = document.createElement("div");
    div.className="chart-box";

    const canvas = document.createElement("canvas");

    div.innerHTML += `<h3>${item.chartTitle}</h3>`;
    div.appendChild(canvas);

    box.appendChild(div);

    new Chart(canvas,{
      type:item.type || "bar",
      data:{
        labels:item.labels,
        datasets:[{
          data:item.values,
          backgroundColor:[
            "#1f6feb","#238636","#ff9800","#da3633","#8957e5"
          ]
        }]
      }
    });
  });
}

// 🔥 Go pricing
function goPricing(){
  window.location.href = "pricing.html";
}

// init
loadUser();
