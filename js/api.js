async function reloadData() {
    try {
        const res = await fetch(GAS_URL);
        const json = await res.json();
        if(json.status === 'success') {
            appData = {
                depts: json.data['部門清單'] || [],
                staff: json.data['員工清單'] || [],
                tasks: json.data['工作清單'] || [],
                shifts: json.data['排班紀錄'] || [],
                auths: json.data['權限清單'] || []
            };
            renderPublicSidebar();
            if(currentUser) login(); 
        }
    } catch(e) { console.error("資料載入失敗:", e); }
}

async function postAction(payload) {
    document.body.style.cursor = 'wait';
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if(result.status === 'success') {
            showToast();
            await reloadData(); 
        } else {
            alert("操作失敗: " + result.message);
        }
        return result;
    } catch(e) {
        console.error("API 請求錯誤:", e);
        alert("網路連線異常，請稍後再試。");
    } finally {
        document.body.style.cursor = 'default';
    }
}
