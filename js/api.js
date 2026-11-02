async function fetchAllData() {
    try {
        const res = await fetch(GAS_URL);
        const json = await res.json();
        if(json.status === 'success') {
            appData.depts = json.data['部門清單'] || [];
            appData.staff = json.data['員工清單'] || [];
            appData.tasks = json.data['工作清單'] || [];
            appData.shifts = json.data['排班紀錄'] || [];
            appData.auths = json.data['權限清單'] || [];
            
            document.getElementById('loadingMsg').classList.add('hidden');
            document.getElementById('welcomeMsg').classList.remove('hidden');
            renderSidebars();
        } else { alert("資料載入失敗"); }
    } catch(e) { console.error(e); alert("API 連線失敗"); }
}

async function postAction(payload) {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    return await res.json();
}
