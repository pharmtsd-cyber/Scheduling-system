let clipboardShift = null; 

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 平日排班：${deptName}`;
    
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('interactiveDate').value = `${nextMonthStr}-01`;
    document.getElementById('previewMonth').value = currentMonthStr; 
    document.getElementById('targetMonth').value = nextMonthStr;     
    
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    customStaffOrder = deptStaff.map(s => s['員工編號']);
    
    clipboardShift = null; 
    renderInteractiveGrid();
}

function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === date);
    
    const dailyRemarkShift = shifts.find(s => s['員工編號'] === 'SYS_REMARK') || {};
    const topRemark = dailyRemarkShift['備註'] || '';
    const bottomRemark = dailyRemarkShift['備註2'] || '';
    const dailyRemarkId = dailyRemarkShift['排班ID'] || ('SYS_' + date.replace(/-/g,''));

    let deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    deptStaff.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a['員工編號']); let idxB = customStaffOrder.indexOf(b['員工編號']);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    let topRemarkHtml = `<div class="bg-yellow-50 border-b border-yellow-200 p-2 flex items-center gap-2">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 頂部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${topRemark}" placeholder="輸入顯示於班表最上方的備註..." onblur="saveDailyRemark('${dailyRemarkId}', this.value, null)">
    </div>`;
    container.innerHTML += topRemarkHtml;

    let headerHtml = `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20">
        <div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200">人員名單</div>
        <div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-700 bg-blue-50">個人備註</div>
        <div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) {
        headerHtml += `<div class="flex-1 border-l border-slate-300 pl-1 py-1 text-slate-700">${i}:00</div><div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`;
    }
    headerHtml += `<div class="w-8 border-l border-slate-300 pl-1 py-1 text-slate-700">22</div></div>
        <div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-700 bg-teal-50">工作補充</div>
    </div>`;
    container.innerHTML += headerHtml;

    deptStaff.forEach(emp => {
        const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
        let mainShift = myShifts.length > 0 ? myShifts[0] : null;
        let shiftId = mainShift ? mainShift['排班ID'] : '';
        let r1 = mainShift ? (mainShift['備註'] || '') : '';
        let r2 = mainShift ? (mainShift['備註2'] || '') : '';

        let rowHtml = `<div class="flex timeline-container group hover:bg-slate-50 transition border-b h-[50px]">
            <div class="w-24 p-1 border-r bg-white flex flex-col items-center justify-center shadow-sm z-10 relative cursor-ns-resize shrink-0"
                 draggable="true" ondragstart="dragRow(event, '${emp['員工編號']}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp['員工編號']}')" title="上下拖曳排序人員">
                <div class="font-bold text-blue-700 cursor-pointer hover:underline text-sm truncate w-full text-center" onclick="openQuickEmpEdit('${emp['員工編號']}')">${emp['姓名']}</div>
                ${clipboardShift ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[9px] bg-indigo-100 text-indigo-700 px-2 mt-1 rounded shadow hover:bg-indigo-200">📋貼上</button>` : ''}
            </div>
            <div class="w-32 border-r bg-blue-50/50 flex items-center p-1 shrink-0">
                <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-blue-400 focus:ring-1 rounded bg-white text-blue-800 font-bold"
                       placeholder="${mainShift ? '輸入備註...' : ''}" value="${r1}" ${mainShift ? `onblur="updateShiftRemarks('${shiftId}', this.value, null)"` : 'disabled'}>
            </div>
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="dropShift(event, '${emp['員工編號']}')">
                <div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        
        for(let i=8; i<=21; i++) rowHtml += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        rowHtml += `</div>`;

        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100;
            const width = ((eh - sh) + (em - sm)/60) / 14 * 100;

            rowHtml += `<div class="absolute top-[4px] bottom-[4px] bg-blue-100 border border-blue-400 rounded shadow-sm flex flex-col justify-center items-center cursor-grab active:cursor-grabbing hover:bg-blue-200 transition overflow-hidden z-10"
                             draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="font-bold text-blue-900 text-xs truncate w-full text-center px-1 flex justify-center items-center gap-1">
                    <span class="cursor-pointer hover:text-blue-600" onclick="openShiftModal('${shift['排班ID']}')">${shift['工作名稱']}</span>
                    <button onclick="copyShift('${shift['排班ID']}')" class="text-slate-400 hover:text-indigo-700 text-[10px]">📋</button>
                </div>
                <div class="text-[9px] text-slate-600 font-semibold mt-[2px]">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        rowHtml += `</div><div class="w-40 border-l bg-teal-50/50 flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-teal-400 focus:ring-1 rounded bg-white text-teal-800"
                   placeholder="${mainShift ? '補充說明...' : ''}" value="${r2}" ${mainShift ? `onblur="updateShiftRemarks('${shiftId}', null, this.value)"` : 'disabled'}>
        </div></div>`; 
        container.innerHTML += rowHtml;
    });

    let bottomRemarkHtml = `<div class="bg-yellow-50 border-t border-yellow-200 p-2 flex items-center gap-2 mt-2">
        <span class="text-yellow-700 font-bold text-sm shrink-0">📢 底部備註：</span>
        <input type="text" class="flex-1 bg-transparent border-b border-yellow-300 focus:border-yellow-600 outline-none text-sm text-yellow-800" value="${bottomRemark}" placeholder="輸入顯示於班表最下方的備註..." onblur="saveDailyRemark('${dailyRemarkId}', null, this.value)">
    </div>`;
    container.innerHTML += bottomRemarkHtml;
}

async function saveDailyRemark(shiftId, topVal, bottomVal) {
    const date = document.getElementById('interactiveDate').value;
    const existing = appData.shifts.find(s => s['排班ID'] === shiftId) || {};
    const r1 = topVal !== null ? topVal : (existing['備註'] || '');
    const r2 = bottomVal !== null ? bottomVal : (existing['備註2'] || '');

    await postAction({
        action: 'save_shift', shiftId, date, dept: currentDept,
        empId: 'SYS_REMARK', task: 'SYS_REMARK', start: '00:00', end: '00:00', category: 'SYS',
        remark1: r1, remark2: r2
    });
}

async function updateShiftRemarks(shiftId, r1, r2) {
    if(!shiftId) return;
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        await postAction({ 
            action: 'save_shift', shiftId, date: shift['日期'], dept: shift['部門名稱'], 
            empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], 
            remark1: r1 !== null ? r1 : shift['備註'], remark2: r2 !== null ? r2 : shift['備註2'] 
        });
    }
}

function copyShift(shiftId) { clipboardShift = appData.shifts.find(s => s['排班ID'] === shiftId); showToast("✅ 已複製"); renderInteractiveGrid(); }
function pasteShift(empId) {
    if (!clipboardShift) return; openShiftModal(); 
    document.getElementById('modalEmp').value = empId; document.getElementById('modalTask').value = clipboardShift['工作名稱']; document.getElementById('modalStart').value = clipboardShift['開始時間']; document.getElementById('modalEnd').value = clipboardShift['結束時間']; document.getElementById('modalCat').value = clipboardShift['工作類別']; document.getElementById('modalRemark1').value = clipboardShift['備註'] || ''; document.getElementById('modalRemark2').value = clipboardShift['備註2'] || ''; document.getElementById('modalTitle').innerText = '📋 貼上工作';
}
function allowDrop(ev) { ev.preventDefault(); }
function dragRow(ev, empId) { ev.dataTransfer.setData("rowEmpId", empId); }
function dropRow(ev, targetEmpId) {
    ev.preventDefault(); ev.stopPropagation(); const sourceEmpId = ev.dataTransfer.getData("rowEmpId");
    if (sourceEmpId && sourceEmpId !== targetEmpId) {
        const sourceIdx = customStaffOrder.indexOf(sourceEmpId); const targetIdx = customStaffOrder.indexOf(targetEmpId);
        if (sourceIdx !== -1 && targetIdx !== -1) { customStaffOrder.splice(sourceIdx, 1); customStaffOrder.splice(targetIdx, 0, sourceEmpId); renderInteractiveGrid(); }
    }
}
function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
async function dropShift(ev, newEmpId) {
    ev.preventDefault(); const shiftId = ev.dataTransfer.getData("shiftId"); if(!shiftId) return; 
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift && shift['員工編號'] !== newEmpId) {
        shift['員工編號'] = newEmpId; renderInteractiveGrid(); 
        await postAction({ action: 'save_shift', shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] });
    }
}

function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    document.getElementById('modalEmp').innerHTML = appData.staff.filter(s => s['所屬組別'] === currentDept).map(e => `<option value="${e['員工編號']}">${e['姓名']}</option>`).join('');
    document.getElementById('modalTask').innerHTML = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']).map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    if(shiftId) {
        const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯工作'; document.getElementById('modalShiftId').value = shiftId; document.getElementById('modalEmp').value = shift['員工編號']; document.getElementById('modalTask').value = shift['工作名稱']; document.getElementById('modalStart').value = shift['開始時間']; document.getElementById('modalEnd').value = shift['結束時間']; document.getElementById('modalCat').value = shift['工作類別']; document.getElementById('modalRemark1').value = shift['備註'] || ''; document.getElementById('modalRemark2').value = shift['備註2'] || ''; document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增工作'; document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); document.getElementById('modalStart').value = '08:00'; document.getElementById('modalEnd').value = '12:00'; document.getElementById('modalRemark1').value = ''; document.getElementById('modalRemark2').value = ''; document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}
function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }
async function saveShift() {
    await postAction({ action: 'save_shift', shiftId: document.getElementById('modalShiftId').value, date: document.getElementById('interactiveDate').value, dept: currentDept, empId: document.getElementById('modalEmp').value, task: document.getElementById('modalTask').value, start: document.getElementById('modalStart').value, end: document.getElementById('modalEnd').value, category: document.getElementById('modalCat').value, remark1: document.getElementById('modalRemark1').value, remark2: document.getElementById('modalRemark2').value }); closeShiftModal();
}
async function deleteShift() { if(confirm("確定刪除此工作？")) { await postAction({ action: 'delete_shift', shiftId: document.getElementById('modalShiftId').value }); closeShiftModal(); } }
async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value; const targetMonth = document.getElementById('targetMonth').value;
    if(sourceMonth && targetMonth && confirm(`承襲 ${sourceMonth} 至 ${targetMonth}？`)) { await postAction({ action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentDept }); }
}

// === 修改：人員編輯的時間格式與預設唯讀 ===
function openQuickEmpEdit(empId) {
    const emp = appData.staff.find(e => e['員工編號'] === empId);
    if(!emp) return;
    
    document.getElementById('qEmpId').value = empId;
    document.getElementById('qEmpName').innerText = emp['姓名'];
    document.getElementById('qDept').value = emp['所屬單位'] || '藥學部';
    document.getElementById('qAuth').value = emp['權限'] || '';
    
    // 啟用時間改為純文字 (唯讀)
    document.getElementById('qStartDisplay').innerText = emp['啟用時間'] || '無紀錄';
    document.getElementById('qStart').value = emp['啟用時間'] || '';
    
    // 停用時間改為 datetime-local 以支援時分秒 (YYYY-MM-DDTHH:mm:ss)
    let endStr = emp['停用時間'] || '';
    if(endStr && !endStr.includes('T')) endStr = endStr.replace(' ', 'T'); // 轉換 GS 格式
    document.getElementById('qEnd').value = endStr;
    
    document.getElementById('qCategory').value = emp['所屬類別'] || '';
    document.getElementById('qGroup').value = emp['所屬組別'] || '';
    document.getElementById('quickEmpModal').classList.remove('hidden');
}

// 當選擇離職時，自動填入現在台灣時間 (YYYY-MM-DDTHH:mm:ss)
function handleDeptChange(val) {
    if(val === '離職') {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth()+1).padStart(2,'0');
        const dd = String(now.getDate()).padStart(2,'0');
        const hh = String(now.getHours()).padStart(2,'0');
        const min = String(now.getMinutes()).padStart(2,'0');
        const ss = String(now.getSeconds()).padStart(2,'0');
        document.getElementById('qEnd').value = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
    }
}

async function saveQuickEmpEdit() {
    let endVal = document.getElementById('qEnd').value;
    if(endVal) endVal = endVal.replace('T', ' '); // 存回資料庫時換回空格分隔
    
    const updateData = { 
        '所屬單位': document.getElementById('qDept').value, 
        '權限': document.getElementById('qAuth').value, 
        // 啟用時間不更新，維持原樣
        '停用時間': endVal, 
        '所屬類別': document.getElementById('qCategory').value, 
        '所屬組別': document.getElementById('qGroup').value 
    };
    document.getElementById('quickEmpModal').classList.add('hidden');
    await postAction({ action: 'update_employee', empId: document.getElementById('qEmpId').value, updateData });
}
