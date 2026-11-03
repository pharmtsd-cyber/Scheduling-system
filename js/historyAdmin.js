let selectedSnapshotData = null; // 暫存使用者點擊的舊版本資料

function openHistoryModal() {
    const monthStr = document.getElementById('interactiveDate').value.substring(0, 7);
    document.getElementById('historyModalTitle').innerText = `[${currentDept}] ${monthStr} 版本歷史`;
    
    // 篩選出該部門、該月份的發佈紀錄，並依照時間倒序 (最新的在最上面)
    let historyRecords = appData['發佈紀錄'] || [];
    historyRecords = historyRecords.filter(r => r['發佈部門'] === currentDept && r['發佈月份'] === monthStr);
    historyRecords.sort((a, b) => new Date(b['發佈時間']) - new Date(a['發佈時間']));
    
    const listHtml = document.getElementById('historyList');
    listHtml.innerHTML = '';
    
    if (historyRecords.length === 0) {
        listHtml.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs font-bold">尚無發佈紀錄</div>';
    } else {
        historyRecords.forEach((record, index) => {
            const isLatest = index === 0;
            // 由於 GS 讀取字串時可能將空字串轉為 undefined，要做安全處理
            const snapshotStr = record['排班快照'] || '[]'; 
            
            // 使用 base64 避免引號衝突
            const encodedSnapshot = btoa(unescape(encodeURIComponent(snapshotStr)));
            
            listHtml.innerHTML += `
                <li onclick="viewHistoryDetail(this, '${record['發佈時間']}', '${record['發佈人姓名']}', '${record['版本備註']}', '${encodedSnapshot}')" 
                    class="cursor-pointer p-2 hover:bg-blue-50 border border-transparent rounded transition flex flex-col">
                    <div class="text-xs font-bold text-slate-700 flex justify-between">
                        ${record['發佈時間'].substring(5, 16)} 
                        ${isLatest ? '<span class="text-[9px] bg-green-100 text-green-700 px-1 rounded">目前版本</span>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-500 truncate">${record['發佈人姓名']} ${record['版本備註'] ? '- ' + record['版本備註'] : ''}</div>
                </li>`;
        });
    }
    
    document.getElementById('historyDetailEmpty').classList.remove('hidden');
    document.getElementById('historyDetailContent').classList.add('hidden');
    document.getElementById('historyModal').classList.remove('hidden');
}

function viewHistoryDetail(liElement, time, author, note, encodedSnapshot) {
    // 處理左側選單的高亮狀態
    document.querySelectorAll('#historyList li').forEach(li => li.classList.remove('bg-blue-100', 'border-blue-300'));
    liElement.classList.add('bg-blue-100', 'border-blue-300');
    
    document.getElementById('historyDetailEmpty').classList.add('hidden');
    document.getElementById('historyDetailContent').classList.remove('hidden');
    
    document.getElementById('hdTime').innerText = `版本時間：${time}`;
    document.getElementById('hdAuthor').innerText = author;
    document.getElementById('hdNote').innerText = note || '無';
    
    // 解析舊版本 Snapshot
    const snapshotStr = decodeURIComponent(escape(atob(encodedSnapshot)));
    let oldShifts = [];
    try { oldShifts = JSON.parse(snapshotStr); } catch(e) { console.error(e); }
    selectedSnapshotData = oldShifts; // 供還原時使用
    
    // 取得當前畫面的排班狀態 (作為比對基準)
    const monthStr = document.getElementById('interactiveDate').value.substring(0, 7);
    const currentShifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr));
    
    // 執行比對邏輯 (Diff)
    const diffResult = compareShifts(oldShifts, currentShifts);
    
    const diffContainer = document.getElementById('hdDiffList');
    diffContainer.innerHTML = '';
    
    if (diffResult.length === 0) {
        diffContainer.innerHTML = '<div class="text-slate-400 italic p-2 text-center font-bold">此版本與目前畫面班表完全一致，無任何差異。</div>';
    } else {
        diffResult.forEach(diff => {
            let badge = '';
            if (diff.type === 'ADD') badge = '<span class="text-[9px] bg-green-100 text-green-700 px-1 border border-green-200 rounded">現已新增</span>';
            else if (diff.type === 'DEL') badge = '<span class="text-[9px] bg-red-100 text-red-700 px-1 border border-red-200 rounded">現已刪除</span>';
            else badge = '<span class="text-[9px] bg-yellow-100 text-yellow-700 px-1 border border-yellow-200 rounded">內容已改</span>';
            
            diffContainer.innerHTML += `
                <div class="bg-white border p-2 rounded shadow-sm flex items-start gap-2">
                    <div class="mt-0.5">${badge}</div>
                    <div class="flex-1">
                        <div class="font-bold text-slate-700">${diff.date} ${getEmpName(diff.empId)}</div>
                        <div class="text-[10px] text-slate-500">${diff.desc}</div>
                    </div>
                </div>`;
        });
    }
}

// 簡易的人員名稱對照
function getEmpName(empId) {
    if (empId === 'SYS_REMARK') return '(系統每日備註)';
    const emp = appData.staff.find(e => e['員工編號'] === empId);
    return emp ? emp['姓名'] : empId;
}

// 比對邏輯：找出 current(現況) 與 old(舊版) 的差異
function compareShifts(oldShifts, currentShifts) {
    const diffs = [];
    const oldMap = new Map();
    oldShifts.forEach(s => oldMap.set(s['排班ID'], s));
    
    const currMap = new Map();
    currentShifts.forEach(s => currMap.set(s['排班ID'], s));
    
    // 尋找「現在有，舊版沒有」的新增，或是內容有修改
    currentShifts.forEach(curr => {
        const id = curr['排班ID'];
        if (!oldMap.has(id)) {
            diffs.push({ type: 'ADD', date: curr['日期'], empId: curr['員工編號'], desc: `新增了工作 [${curr['工作名稱']}]` });
        } else {
            const old = oldMap.get(id);
            let changes = [];
            if (curr['員工編號'] !== old['員工編號']) changes.push(`人員從 ${getEmpName(old['員工編號'])} 改為 ${getEmpName(curr['員工編號'])}`);
            if (curr['工作名稱'] !== old['工作名稱']) changes.push(`工作從 [${old['工作名稱']}] 改為 [${curr['工作名稱']}]`);
            if (curr['開始時間'] !== old['開始時間'] || curr['結束時間'] !== old['結束時間']) changes.push(`時間有調整`);
            if (curr['備註'] !== old['備註']) changes.push(`備註1有修改`);
            if (curr['備註2'] !== old['備註2']) changes.push(`備註2有修改`);
            
            if (changes.length > 0) {
                diffs.push({ type: 'MOD', date: curr['日期'], empId: curr['員工編號'], desc: changes.join('、') });
            }
        }
    });
    
    // 尋找「舊版有，現在沒有」的刪除
    oldShifts.forEach(old => {
        if (!currMap.has(old['排班ID'])) {
            diffs.push({ type: 'DEL', date: old['日期'], empId: old['員工編號'], desc: `刪除了工作 [${old['工作名稱']}]` });
        }
    });
    
    // 依日期排序
    diffs.sort((a, b) => a.date.localeCompare(b.date));
    return diffs;
}

// 執行還原操作
function restoreVersion() {
    if (!selectedSnapshotData) return;
    
    if (confirm("⚠️ 強烈警告 ⚠️\n\n執行還原將會清除目前畫面上的本月班表，並以選擇的舊版本覆蓋。\n(此操作將會直接儲存至雲端，請確認無誤後自行點擊發佈新版本)\n\n您確定要執行時光機還原嗎？")) {
        
        const monthStr = document.getElementById('interactiveDate').value.substring(0, 7);
        
        // 1. 先從本地清空該月原本的所有班表
        appData.shifts = appData.shifts.filter(s => !(s['部門名稱'] === currentDept && s['日期'].startsWith(monthStr)));
        
        // 2. 將舊版 Snapshot 內的資料重新推入 appData 並標記為草稿
        selectedSnapshotData.forEach(shift => {
            markDraft({
                shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'],
                empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'],
                end: shift['結束時間'], category: shift['工作類別'],
                remark1: shift['備註'], remark2: shift['備註2']
            });
        });
        
        document.getElementById('historyModal').classList.add('hidden');
        showToast('🔄 班表已還原至舊版狀態，正在儲存...');
        
        // 3. 強制觸發存檔 (將覆蓋的資料寫回雲端)
        setTimeout(() => {
            saveDraftsToCloud();
            // 重繪畫面
            if (!document.getElementById('adminView').classList.contains('hidden')) renderInteractiveGrid();
            if (!document.getElementById('holidayAdminView').classList.contains('hidden')) renderHolidayGrid();
        }, 500);
    }
}
