const GAS_URL = 'https://script.google.com/macros/s/AKfycbzT3uS_MBktdkAQYXo4ZM9_TJ90wkmtRnGf2MWA8R6KDL260qv4s1xB7XmRyg7z4lSq/exec';
window.appData = { depts: [], staff: [], tasks: [], shifts: [] };
window.currentDept = null;

async function fetchAllData() {
    try {
        const res = await fetch(GAS_URL);
        const json = await res.json();
        if(json.status === 'success') {
            appData.depts = json.data['部門清單'] || [];
            appData.staff = json.data['員工清單'] || [];
            appData.tasks = json.data['工作清單'] || [];
            appData.shifts = json.data['排班紀錄'] || [];
        }
    } catch(e) { console.error("資料讀取失敗", e); }
}

async function postAction(payload) {
    const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
    return await res.json();
}
