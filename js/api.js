async function reloadData() {
    try {
        // 第一包加入 action=init 讓計數器 +1
        const res = await fetch(`${GAS_URL}?action=init`);
        const json = await res.json();
        if(json.status === 'success') {
            appData = {
                depts: json.data['部門清單'] || [],
                staff: json.data['員工清單'] || [],
                tasks: json.data['工作清單'] || [],
                shifts: json.data['排班紀錄'] || [],
                auths: json.data['權限清單'] || [],
                sysInfo: json.data['系統資訊'] || { viewCount: 0 }
            };
            
            // 更新計數器畫面
            document.getElementById('sysViewCount').innerText = appData.sysInfo.viewCount;
            
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
            if (payload.action !== 'batch_save_shifts') { // 批次儲存另外控制 reload
                await reloadData(); 
            }
        } else { alert("操作失敗: " + result.message); }
        return result;
    } catch(e) {
        console.error("API 請求錯誤:", e);
        alert("網路連線異常，請稍後再試。");
    } finally { document.body.style.cursor = 'default'; }
}

// === 草稿與發佈機制 ===
function markDraft(shiftData) {
    draftShifts[shiftData.shiftId] = shiftData;
    hasUnsavedChanges = true;
    document.getElementById('draftStatus').classList.remove('hidden');
    
    // 更新本地畫面的資料，讓 UI 即時反映 (但不打後端 API)
    const existingIdx = appData.shifts.findIndex(s => s['排班ID'] === shiftData.shiftId);
    const updatedObj = {
        '排班ID': shiftData.shiftId, '日期': shiftData.date, '部門名稱': shiftData.dept,
        '員工編號': shiftData.empId, '工作名稱': shiftData.task, '開始時間': shiftData.start,
        '結束時間': shiftData.end, '工作類別': shiftData.category, 
        '備註': shiftData.remark1, '備註2': shiftData.remark2
    };
    if(existingIdx >= 0) appData.shifts[existingIdx] = updatedObj;
    else appData.shifts.push(updatedObj);
}

async function publishDrafts() {
    if(!hasUnsavedChanges) return;
    
    const shiftsToSave = Object.values(draftShifts);
    if(shiftsToSave.length > 0) {
        document.body.style.cursor = 'wait';
        await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'batch_save_shifts', shifts: shiftsToSave }) 
        });
    }

    // 發佈版本紀錄
    const note = prompt(`(選填) 請輸入發佈備註：\n(如：新增門診支援、修訂請假)`, '');
    await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'publish_schedule', 
            dept: currentDept || '跨部門', 
            month: document.getElementById('interactiveDate')?.value.substring(0,7) || '無', 
            empId: currentUser['員工編號'], 
            empName: currentUser['姓名'],
            note: note
        })
    });

    draftShifts = {};
    hasUnsavedChanges = false;
    document.getElementById('draftStatus').classList.add('hidden');
    
    showToast('💾 班表已成功儲存並發佈版本');
    await reloadData();
    
    // 重繪畫面
    if(currentDept && document.getElementById('adminView').classList.contains('hidden') === false) renderInteractiveGrid();
    if(document.getElementById('holidayAdminView').classList.contains('hidden') === false) renderHolidayGrid();
}

// 離站前提示防護
window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您尚有變更未發佈，確定要離開嗎？變更將會遺失。';
    }
});
