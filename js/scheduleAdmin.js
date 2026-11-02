let clipboardShift = null; 

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 排班管理：${deptName}`;
    
    // 預設日期為：次月 1 日
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('interactiveDate').value = `${nextMonthStr}-01`;
    document.getElementById('previewMonth').value = currentMonthStr; // 預覽本月
    document.getElementById('targetMonth').value = nextMonthStr;     // 承襲到下月
    
    // 建立該部門初始人員順序
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
    
    let deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    
    // 套用人員拖曳的自訂排序
    deptStaff.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a['員工編號']);
        let idxB = customStaffOrder.indexOf(b['員工編號']);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    let headerHtml = '<div class="flex border-b bg-slate-100 text-xs font-bold text-slate-500"><div class="w-32 p-2 border-r text-center">人員名單 (可拖曳排序)</div><div class="flex-1 flex">';
    for(let i=8; i<=22; i++) headerHtml += `<div class="flex-1 border-l pl-1 py-1">${i}:00</div>`;
    headerHtml += '</div></div>';
    container.innerHTML += headerHtml;

    deptStaff.forEach(emp => {
        const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
        let pasteBtnHtml = clipboardShift ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 mt-1 rounded shadow hover:bg-indigo-200">📋 貼上工作</button>` : '';
        
        // 人員區塊 (Header) 加入 drag events 供上下排序
        let rowHtml = `<div class="flex timeline-container group hover:bg-slate-50 transition">
            <div class="w-32 p-1 border-r bg-white flex flex-col items-center justify-center shadow-sm z-10 relative cursor-ns-resize"
                 draggable="true" ondragstart="dragRow(event, '${emp['員工編號']}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp['員工編號']}')" title="上下拖曳排序人員">
                <div class="font-bold text-blue-700 cursor-pointer hover:underline text-sm" onclick="openQuickEmpEdit('${emp['員工編號']}')" title="編輯屬性">${emp['姓名']}</div>
                ${pasteBtnHtml}
            </div>
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="dropShift(event, '${emp['員工編號']}')">`;
        
        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100;
            const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
            
            // 雙備註時間軸區塊 (上: 個人備註, 中: 標題, 下: 工作補充)
            rowHtml += `<div class="timeline-block" draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <input type="text" placeholder="個人註解..." value="${shift['備註'] || ''}" class="text-blue-700 font-bold bg-blue-50" onblur="updateShiftInline('${shift['排班ID']}', null, this.value, null)" title="針對此人此工作的備註">
                
                <div class="font-bold text-blue-900 border-y border-blue-200 py-[2px] flex justify-between items-center bg-white/60">
                    <span class="truncate pr-1 cursor-pointer hover:text-blue-600 pl-1" onclick="openShiftModal('${shift['排班ID']}')">${shift['工作名稱']} <span class="text-[9px] text-slate-500">(${shift['開始時間']})</span></span>
                    <button onclick="copyShift('${shift['排班ID']}')" class="text-slate-400 hover:text-indigo-600 px-1" title="複製此工作">📋</button>
                </div>
                
                <input type="text" placeholder="工作補充..." value="${shift['備註2'] || ''}" class="text-teal-700 bg-teal-50" onblur="updateShiftInline('${shift['排班ID']}', null, null, this.value)" title="針對此工作的補充說明">
            </div>`;
        });
        rowHtml += `</div></div>`;
        container.innerHTML += rowHtml;
    });
}

// === 工作複製貼上 ===
function copyShift(shiftId) {
    clipboardShift = appData.shifts.find(s => s['排班ID'] === shiftId);
    showToast("✅ 已複製工作！請點擊人員名稱下方的「貼上工作」");
    renderInteractiveGrid();
}
function pasteShift(empId) {
    if (!clipboardShift) return;
    openShiftModal(); 
    document.getElementById('modalEmp').value = empId;
    document.getElementById('modalTask').value = clipboardShift['工作名稱'];
    document.getElementById('modalStart').value = clipboardShift['開始時間'];
    document.getElementById('modalEnd').value = clipboardShift['結束時間'];
    document.getElementById('modalCat').value = clipboardShift['工作類別'];
    document.getElementById('modalRemark1').value = clipboardShift['備註'] || '';
    document.getElementById('modalRemark2').value = clipboardShift['備註2'] || '';
    document.getElementById('modalTitle').innerText = '📋 貼上並建立新工作';
}

// === 拖曳邏輯 ===
function allowDrop(ev) { ev.preventDefault(); }

// 1. 人員列排序
function dragRow(ev, empId) { ev.dataTransfer.setData("rowEmpId", empId); }
function dropRow(ev, targetEmpId) {
    ev.preventDefault(); ev.stopPropagation();
    const sourceEmpId = ev.dataTransfer.getData("rowEmpId");
    if (sourceEmpId && sourceEmpId !== targetEmpId) {
        const sourceIdx = customStaffOrder.indexOf(sourceEmpId);
        const targetIdx = customStaffOrder.indexOf(targetEmpId);
        if (sourceIdx !== -1 && targetIdx !== -1) {
            customStaffOrder.splice(sourceIdx, 1);
            customStaffOrder.splice(targetIdx, 0, sourceEmpId);
            renderInteractiveGrid(); // 本地重新渲染
        }
    }
}

// 2. 工作換人 (Drag & Drop)
function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
async function dropShift(ev, newEmpId) {
    ev.preventDefault();
    const shiftId = ev.dataTransfer.getData("shiftId");
    if(!shiftId) return; // 避免與人員拖曳衝突
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift && shift['員工編號'] !== newEmpId) {
        shift['員工編號'] = newEmpId;
        renderInteractiveGrid(); 
        await postAction({ 
            action: 'save_shift', shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], 
            empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], 
            end: shift['結束時間'], category: shift['工作類別'], remark1: shift['備註'], remark2: shift['備註2'] 
        });
    }
}

// === 內聯更新雙備註 ===
async function updateShiftInline(shiftId, empId, r1, r2) {
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        await postAction({ 
            action: 'save_shift', shiftId, date: shift['日期'], dept: shift['部門名稱'], 
            empId: empId !== null ? empId : shift['員工編號'], task: shift['工作名稱'], 
            start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], 
            remark1: r1 !== null ? r1 : shift['備註'], remark2: r2 !== null ? r2 : shift['備註2'] 
        });
        renderInteractiveGrid();
    }
}

// === 新增/編輯 Modal ===
function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    
    document.getElementById('modalEmp').innerHTML = deptStaff.map(e => `<option value="${e['員工編號']}">${e['姓名']}</option>`).join('');
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    
    if(shiftId) {
        const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯工作';
        document.getElementById('modalShiftId').value = shiftId;
        document.getElementById('modalEmp').value = shift['員工編號'];
        document.getElementById('modalTask').value = shift['工作名稱'];
        document.getElementById('modalStart').value = shift['開始時間'];
        document.getElementById('modalEnd').value = shift['結束時間'];
        document.getElementById('modalCat').value = shift['工作類別'];
        document.getElementById('modalRemark1').value = shift['備註'] || '';
        document.getElementById('modalRemark2').value = shift['備註2'] || '';
        document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增工作';
        document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); 
        document.getElementById('modalStart').value = '08:00';
        document.getElementById('modalEnd').value = '12:00';
        document.getElementById('modalRemark1').value = '';
        document.getElementById('modalRemark2').value = '';
        document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }

async function saveShift() {
    await postAction({
        action: 'save_shift',
        shiftId: document.getElementById('modalShiftId').value,
        date: document.getElementById('interactiveDate').value,
        dept: currentDept,
        empId: document.getElementById('modalEmp').value,
        task: document.getElementById('modalTask').value,
        start: document.getElementById('modalStart').value,
        end: document.getElementById('modalEnd').value,
        category: document.getElementById('modalCat').value,
        remark1: document.getElementById('modalRemark1').value,
        remark2: document.getElementById('modalRemark2').value
    });
    closeShiftModal();
}

async function deleteShift() {
    if(confirm("確定刪除此工作？")) {
        await postAction({ action: 'delete_shift', shiftId: document.getElementById('modalShiftId').value });
        closeShiftModal();
    }
}

async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value;
    const targetMonth = document.getElementById('targetMonth').value;
    if(sourceMonth && targetMonth && confirm(`承襲 ${sourceMonth} 至 ${targetMonth}？`)) {
        await postAction({ action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentDept });
    }
}

// === 人員快速編輯表單 ===
function openQuickEmpEdit(empId) {
    const emp = appData.staff.find(e => e['員工編號'] === empId);
    if(!emp) return;
    
    document.getElementById('qEmpId').value = empId;
    document.getElementById('qEmpName').innerText = emp['姓名'];
    document.getElementById('qDept').value = emp['所屬單位'] || '藥學部';
    document.getElementById('qAuth').value = emp['權限'] || '';
    document.getElementById('qStart').value = (emp['啟用時間'] || '').split(' ')[0] || '';
    document.getElementById('qEnd').value = (emp['停用時間'] || '').split(' ')[0] || '';
    document.getElementById('qCategory').value = emp['所屬類別'] || '';
    document.getElementById('qGroup').value = emp['所屬組別'] || '';
    
    document.getElementById('quickEmpModal').classList.remove('hidden');
}

async function saveQuickEmpEdit() {
    const updateData = {
        '所屬單位': document.getElementById('qDept').value,
        '權限': document.getElementById('qAuth').value,
        '啟用時間': document.getElementById('qStart').value,
        '停用時間': document.getElementById('qEnd').value,
        '所屬類別': document.getElementById('qCategory').value,
        '所屬組別': document.getElementById('qGroup').value
    };
    document.getElementById('quickEmpModal').classList.add('hidden');
    await postAction({ action: 'update_employee', empId: document.getElementById('qEmpId').value, updateData });
}
