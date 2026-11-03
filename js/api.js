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
                auths: json.data['權限清單'] || [],
                sysInfo: json.data['系統資訊'] || { viewCount: 0 }
            };
            // 將發佈紀錄獨立拉出，供 historyAdmin.js 讀取
            appData['發佈紀錄'] = json.data['發佈紀錄'] || [];
            
            // 更新系統登入總人次 (若畫面有該元件)
            if (document.getElementById('sysViewCount')) {
                document.getElementById('sysViewCount').innerText = appData.sysInfo.viewCount;
            }
            
            renderPublicSidebar();
            
            // 若 session 已有登入狀態，再次觸發登入更新 UI
            if(sessionStorage.getItem('loggedInUser') && typeof login === 'function' && !currentUser) {
                 login();
            }
        }
    } catch(e) { 
        console.error("資料載入失敗:", e); 
    }
}

async function postAction(payload) {
    document.body.style.cursor = 'wait';
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        });
        const result = await res.json();
        
        if(result.status === 'success') {
            if (typeof showToast === 'function') showToast();
            
            // 批次儲存與發佈由 publishDrafts 自行控制 reload，避免重複重整
            if (payload.action !== 'batch_save_shifts' && payload.action !== 'publish_schedule') {
                await reloadData(); 
            }
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


// ==========================================
// 草稿暫存與發佈版本機制 (Draft & Publish)
// ==========================================

function markDraft(shiftData) {
    draftShifts[shiftData.shiftId] = shiftData;
    hasUnsavedChanges = true;
    
    if (document.getElementById('draftStatus')) {
        document.getElementById('draftStatus').classList.remove('hidden');
    }
    
    // 更新本地 appData 陣列的資料，讓 UI 即時反映 (但不打後端 API)
    const existingIdx = appData.shifts.findIndex(s => s['排班ID'] === shiftData.shiftId);
    const updatedObj = {
        '排班ID': shiftData.shiftId, 
        '日期': shiftData.date, 
        '部門名稱': shiftData.dept,
        '員工編號': shiftData.empId, 
        '工作名稱': shiftData.task, 
        '開始時間': shiftData.start,
        '結束時間': shiftData.end, 
        '工作類別': shiftData.category, 
        '備註': shiftData.remark1, 
        '備註2': shiftData.remark2
    };
    
    if(existingIdx >= 0) {
        appData.shifts[existingIdx] = updatedObj;
    } else {
        appData.shifts.push(updatedObj);
    }
}

async function publishDrafts() {
    if(!hasUnsavedChanges) return;
    
    const shiftsToSave = Object.values(draftShifts);
    
    // 1. 批次儲存所有的草稿班表
    if(shiftsToSave.length > 0) {
        document.body.style.cursor = 'wait';
        await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'batch_save_shifts', shifts: shiftsToSave }) 
        });
    }

    // 2. 準備發佈版本紀錄
    // 判斷目前使用者是在平日排班還是假日排班畫面，抓出當前月份
    let monthToPublish = '無';
    if (document.getElementById('interactiveDate') && !document.getElementById('adminView').classList.contains('hidden')) {
        monthToPublish = document.getElementById('interactiveDate').value.substring(0, 7);
    } else if (document.getElementById('holidayMonth') && !document.getElementById('holidayAdminView').classList.contains('hidden')) {
        monthToPublish = document.getElementById('holidayMonth').value;
    }

    const note = prompt(`(選填) 請輸入發佈備註：\n(例如：新增門診支援、修訂請假、確認定稿)`, '');
    
    // 產生快照 (Snapshot)：過濾出目前 appData 內，屬於該部門且為該月份的所有班表狀態
    const snapshotShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthToPublish));
    const snapshotJsonStr = JSON.stringify(snapshotShifts);

    // 3. 發送版本快照紀錄
    await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'publish_schedule', 
            dept: currentDept || '跨部門', 
            month: monthToPublish, 
            empId: currentUser ? currentUser['員工編號'] : 'SYS', 
            empName: currentUser ? currentUser['姓名'] : '系統',
            note: note,
            snapshot: snapshotJsonStr
        })
    });

    // 4. 重置草稿狀態並重新載入最新資料
    draftShifts = {};
    hasUnsavedChanges = false;
    
    if (document.getElementById('draftStatus')) {
        document.getElementById('draftStatus').classList.add('hidden');
    }
    
    if (typeof showToast === 'function') showToast('💾 班表已成功儲存並發佈為新版本');
    
    document.body.style.cursor = 'default';
    await reloadData();
    
    // 5. 依據停留的頁面重繪網格
    if(currentDept) {
        if (document.getElementById('adminView') && !document.getElementById('adminView').classList.contains('hidden')) {
            if (typeof renderInteractiveGrid === 'function') renderInteractiveGrid();
        }
        if (document.getElementById('holidayAdminView') && !document.getElementById('holidayAdminView').classList.contains('hidden')) {
            if (typeof renderHolidayGrid === 'function') renderHolidayGrid();
        }
    }
}

// 離站前提示防護：若有未發佈的草稿，嘗試關閉分頁或重整時會發出警告
window.addEventListener('beforeunload', function (e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您尚有變更未發佈，確定要離開嗎？未發佈的變更將會遺失。';
    }
});
