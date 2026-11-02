let clipboardShift = null; 

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 排班管理：${deptName}`;
    
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
    let deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    
    deptStaff.sort((a, b) => {
        let idxA = customStaffOrder.indexOf(a['員工編號']);
        let idxB = customStaffOrder.indexOf(b['員工編號']);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    // 表頭設計：四大欄位 + 30分鐘一格
    let headerHtml = `<div class="flex border-b bg-slate-200 text-[11px] font-bold text-slate-600 sticky top-0 z-20">
        <div class="w-24 p-2 border-r text-center shrink-0 flex items-center justify-center bg-slate-200">人員名單</div>
        <div class="w-32 p-2 border-r text-center shrink-0 flex items-center justify-center text-blue-700 bg-blue-50">個人備註</div>
        <div class="flex-1 flex min-w-[500px]">`;
    for(let i=8; i<=21; i++) {
        headerHtml += `<div class="flex-1 border-l border-slate-300 pl-1 py-1 text-slate-700">${i}:00</div>`;
        headerHtml += `<div class="flex-1 border-l border-dashed border-slate-300 pl-1 py-1 text-[9px] text-slate-400">30</div>`; // 30分刻度
    }
    headerHtml += `<div class="w-8 border-l border-slate-300 pl-1 py-1 text-slate-700">22</div>`; 
    headerHtml += `</div>
        <div class="w-40 p-2 border-l text-center shrink-0 flex items-center justify-center text-teal-700 bg-teal-50">工作補充</div>
    </div>`;
    container.innerHTML += headerHtml;

    // 行渲染
    deptStaff.forEach(emp => {
        const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
        // 綁定兩側輸入框至第一筆工作
        let mainShift = myShifts.length > 0 ? myShifts[0] : null;
        let shiftId = mainShift ? mainShift['排班ID'] : '';
        let r1 = mainShift ? (mainShift['備註'] || '') : '';
        let r2 = mainShift ? (mainShift['備註2'] || '') : '';

        // 欄位 1: 人員名單 (可拖曳排序)
        let rowHtml = `<div class="flex timeline-container group hover:bg-slate-50 transition border-b h-[50px]">
            <div class="w-24 p-1 border-r bg-white flex flex-col items-center justify-center shadow-sm z-10 relative cursor-ns-resize shrink-0"
                 draggable="true" ondragstart="dragRow(event, '${emp['員工編號']}')" ondragover="allowDrop(event)" ondrop="dropRow(event, '${emp['員工編號']}')" title="上下拖曳排序人員">
                <div class="font-bold text-blue-700 cursor-pointer hover:underline text-sm truncate w-full text-center" onclick="openQuickEmpEdit('${emp['員工編號']}')">${emp['姓名']}</div>
                ${clipboardShift ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[9px] bg-indigo-100 text-indigo-700 px-2 mt-1 rounded shadow hover:bg-indigo-200">📋貼上</button>` : ''}
            </div>`;

        // 欄位 2: 個人備註 (給個人的註解)
        rowHtml += `<div class="w-32 border-r bg-blue-50/50 flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-blue-400 focus:ring-1 rounded bg-white text-blue-800 font-bold"
                   placeholder="${mainShift ? '輸入備註...' : ''}" value="${r1}"
                   ${mainShift ? `onblur="updateShiftRemarks('${shiftId}', this.value, null)"` : 'disabled title="請先點右上角新增工作"'}>
        </div>`;

        // 欄位 3: 工作時間軸
        rowHtml += `<div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="dropShift(event, '${emp['員工編號']}')">`;

        // 繪製背景 30 分鐘虛線格線
        rowHtml += `<div class="absolute inset-0 flex pointer-events-none opacity-20">`;
        for(let i=8; i<=21; i++) {
            rowHtml += `<div class="flex-1 border-l border-slate-400"></div><div class="flex-1 border-l border-dashed border-slate-400"></div>`;
        }
        rowHtml += `</div>`;

        // 繪製工作色塊 (BAR)
        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100;
            const width = ((eh - sh) + (em - sm)/60) / 14 * 100;

            rowHtml += `<div class="absolute top-[4px] bottom-[4px] bg-blue-100 border border-blue-400 rounded shadow-sm flex flex-col justify-center items-center cursor-grab active:cursor-grabbing hover:bg-blue-200 transition overflow-hidden z-10"
                             draggable="true" ondragstart="dragShift(event, '${shift['排班ID']}')"
                             style="left:${left}%; width:${width}%;">
                <div class="font-bold text-blue-900 text-xs truncate w-full text-center px-1 flex justify-center items-center gap-1">
                    <span class="cursor-pointer hover:text-blue-600" onclick="openShiftModal('${shift['排班ID']}')" title="點擊編輯">${shift['工作名稱']}</span>
                    <button onclick="copyShift('${shift['排班ID']}')" class="text-slate-400 hover:text-indigo-700 text-[10px]" title="複製工作">📋</button>
                </div>
                <div class="text-[9px] text-slate-600 font-semibold mt-[2px]">${shift['開始時間']} - ${shift['結束時間']}</div>
            </div>`;
        });
        rowHtml += `</div>`; 

        // 欄位 4: 工作補充 (對此工作的補充說明)
        rowHtml += `<div class="w-40 border-l bg-teal-50/50 flex items-center p-1 shrink-0">
            <input type="text" class="w-full h-full text-xs p-1 border-transparent focus:border-teal-400 focus:ring-1 rounded bg-white text-teal-800"
                   placeholder="${mainShift ? '補充說明...' : ''}" value="${r2}"
                   ${mainShift ? `onblur="updateShiftRemarks('${shiftId}', null, this.value)"` : 'disabled title="請先點右上角新增工作"'}>
        </div>`;

        rowHtml += `</div>`; 
        container.innerHTML += rowHtml;
    });
}

// 側邊欄內嵌更新 (左右兩側的備註欄位)
async function updateShiftRemarks(shiftId, r1, r2) {
    if(!shiftId) return;
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        await postAction({ 
            action: 'save_shift', shiftId, date: shift['日期'], dept: shift['部門名稱'], 
            empId: shift['員工編號'], task: shift['工作名稱'], 
            start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], 
            remark1: r1 !== null ? r1 : shift['備註'], 
            remark2: r2 !== null ? r2 : shift['備註2'] 
        });
        // 為了避免輸入到一半被重整打斷，若只是備註更新可選擇不呼叫 renderInteractiveGrid()
    }
}

// === 以下複製貼上與拖曳排序邏輯維持不變 ===
function copyShift(shiftId) {
    clipboardShift = appData.shifts.find(s => s['排班ID'] === shiftId);
    showToast("✅ 已複製！請於人員欄點擊「📋貼上」");
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

function allowDrop(ev) { ev.preventDefault(); }
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
            renderInteractiveGrid(); 
        }
    }
}

function dragShift(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
async function dropShift(ev, newEmpId) {
    ev.preventDefault();
    const shiftId = ev.dataTransfer.getData("shiftId");
    if(!shiftId) return; 
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

// Modal 控制邏輯
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

// 快速編輯人員狀態
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
