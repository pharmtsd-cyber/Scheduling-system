let currentAdminDept = null;
let clipboardShift = null; // 用於儲存複製的工作 BAR

function openAdminDept(deptName) {
    currentDept = deptName;
    hideAllViews();
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('adminTitle').innerText = `✏️ 排班管理：${deptName}`;
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('interactiveDate').value = today;
    document.getElementById('previewMonth').value = today.substring(0, 7);
    
    clipboardShift = null; // 切換部門時清空剪貼簿
    renderInteractiveGrid();
}

function renderInteractiveGrid() {
    const container = document.getElementById('interactiveGrid');
    container.innerHTML = '';
    const date = document.getElementById('interactiveDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === date);
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);

    let headerHtml = '<div class="flex border-b bg-slate-50 text-xs font-bold text-slate-500"><div class="w-32 p-2 border-r text-center">人員名單</div><div class="flex-1 flex">';
    for(let i=8; i<=22; i++) headerHtml += `<div class="flex-1 border-l pl-1 py-1">${i}:00</div>`;
    headerHtml += '</div></div>';
    container.innerHTML += headerHtml;

    // 平日模式 (以人為主)
    deptStaff.forEach(emp => {
        const myShifts = shifts.filter(s => s['員工編號'] == emp['員工編號']);
        
        // 若剪貼簿有工作，顯示貼上按鈕
        let pasteBtnHtml = clipboardShift ? `<button onclick="pasteShift('${emp['員工編號']}')" class="text-[10px] bg-indigo-100 text-indigo-700 px-1 mt-1 rounded hover:bg-indigo-200 border border-indigo-300">📋 貼上工作</button>` : '';
        
        let rowHtml = `<div class="flex timeline-container group hover:bg-slate-50">
            <div class="w-32 p-1 border-r bg-white flex flex-col items-center justify-center shadow-sm z-10 relative">
                <div class="font-bold text-blue-700 cursor-pointer hover:underline text-sm" onclick="openQuickEmpEdit('${emp['員工編號']}')" title="點擊編輯人員">${emp['姓名']}</div>
                <div class="text-[10px] text-slate-500 text-center leading-tight truncate w-full px-1" title="${emp['空白欄位五'] || ''}">${emp['空白欄位五'] || ''}</div>
                ${pasteBtnHtml}
            </div>
            <div class="flex-1 relative drop-zone" ondragover="allowDrop(event)" ondrop="drop(event, '${emp['員工編號']}')">`;
        
        myShifts.forEach(shift => {
            const [sh, sm] = (shift['開始時間'] || '08:00').split(':').map(Number);
            const [eh, em] = (shift['結束時間'] || '09:00').split(':').map(Number);
            const left = ((sh - 8) + sm/60) / 14 * 100;
            const width = ((eh - sh) + (em - sm)/60) / 14 * 100;
            
            rowHtml += `<div class="timeline-block" draggable="true" ondragstart="drag(event, '${shift['排班ID']}')" style="left:${left}%; width:${width}%;">
                <div class="font-bold text-blue-900 border-b border-blue-200 pb-[1px] mb-[1px] flex justify-between items-center">
                    <span class="truncate pr-1 cursor-pointer hover:text-blue-600" onclick="openShiftModal('${shift['排班ID']}')">${shift['工作名稱']}</span>
                    <button onclick="copyShift('${shift['排班ID']}')" class="text-slate-400 hover:text-indigo-600 px-1" title="複製此工作">📋</button>
                </div>
                <div class="text-[10px] text-slate-600 truncate">${shift['開始時間']}-${shift['結束時間']}</div>
                ${shift['備註'] ? `<div class="text-[9px] text-red-500 truncate font-bold">${shift['備註']}</div>` : ''}
            </div>`;
        });
        rowHtml += `</div></div>`;
        container.innerHTML += rowHtml;
    });
}

// ====== 複製與貼上 ======
function copyShift(shiftId) {
    clipboardShift = appData.shifts.find(s => s['排班ID'] === shiftId);
    showToast("✅ 已複製工作！請於左側人員欄位點擊「貼上」");
    renderInteractiveGrid(); // 重新渲染以顯示「貼上按鈕」
}

function pasteShift(empId) {
    if (!clipboardShift) return;
    openShiftModal(); // 產生新 ID 並載入選單
    
    // 覆蓋為複製的資料，但指派給選擇的人
    document.getElementById('modalEmp').value = empId;
    document.getElementById('modalTask').value = clipboardShift['工作名稱'];
    document.getElementById('modalStart').value = clipboardShift['開始時間'];
    document.getElementById('modalEnd').value = clipboardShift['結束時間'];
    document.getElementById('modalCat').value = clipboardShift['工作類別'];
    document.getElementById('modalRemark').value = clipboardShift['備註'] || '';
    
    document.getElementById('modalTitle').innerText = '📋 貼上並編輯工作';
}

// ====== Drag & Drop ======
function allowDrop(ev) { ev.preventDefault(); ev.currentTarget.classList.add('drag-over'); }
function drag(ev, shiftId) { ev.dataTransfer.setData("shiftId", shiftId); ev.stopPropagation(); }
async function drop(ev, newEmpId) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const shiftId = ev.dataTransfer.getData("shiftId");
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift && shift['員工編號'] !== newEmpId) {
        shift['員工編號'] = newEmpId;
        renderInteractiveGrid(); 
        await postAction({ action: 'save_shift', ...shift, shiftId: shift['排班ID'], date: shift['日期'], dept: shift['部門名稱'], empId: shift['員工編號'], task: shift['工作名稱'], start: shift['開始時間'], end: shift['結束時間'], category: shift['工作類別'], remark: shift['備註'] });
    }
}

// ====== 班表 Modal ======
function openShiftModal(shiftId = null) {
    const modal = document.getElementById('shiftModal');
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentDept);
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']);
    
    document.getElementById('modalEmp').innerHTML = deptStaff.map(e => `<option value="${e['員工編號']}">${e['姓名']}</option>`).join('');
    document.getElementById('modalTask').innerHTML = deptTasks.map(t => `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`).join('');
    
    if(shiftId) {
        const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
        document.getElementById('modalTitle').innerText = '編輯班表';
        document.getElementById('modalShiftId').value = shiftId;
        document.getElementById('modalEmp').value = shift['員工編號'];
        document.getElementById('modalTask').value = shift['工作名稱'];
        document.getElementById('modalStart').value = shift['開始時間'];
        document.getElementById('modalEnd').value = shift['結束時間'];
        document.getElementById('modalCat').value = shift['工作類別'];
        document.getElementById('modalRemark').value = shift['備註'] || '';
        document.getElementById('btnDeleteShift').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = '新增班表';
        document.getElementById('modalShiftId').value = 'S' + new Date().getTime(); 
        document.getElementById('modalStart').value = '08:00';
        document.getElementById('modalEnd').value = '12:00';
        document.getElementById('modalRemark').value = '';
        document.getElementById('btnDeleteShift').classList.add('hidden');
    }
    modal.classList.remove('hidden');
}

function closeShiftModal() { document.getElementById('shiftModal').classList.add('hidden'); }

async function saveShift() {
    const payload = {
        action: 'save_shift',
        shiftId: document.getElementById('modalShiftId').value,
        date: document.getElementById('interactiveDate').value,
        dept: currentDept,
        empId: document.getElementById('modalEmp').value,
        task: document.getElementById('modalTask').value,
        start: document.getElementById('modalStart').value,
        end: document.getElementById('modalEnd').value,
        category: document.getElementById('modalCat').value,
        remark: document.getElementById('modalRemark').value
    };
    closeShiftModal();
    await postAction(payload);
    renderInteractiveGrid();
}

async function deleteShift() {
    if(confirm("確定刪除此班表？")) {
        const shiftId = document.getElementById('modalShiftId').value;
        closeShiftModal();
        await postAction({ action: 'delete_shift', shiftId });
        renderInteractiveGrid();
    }
}

async function copyMonthSchedule() {
    const sourceMonth = document.getElementById('previewMonth').value;
    const targetMonth = document.getElementById('targetMonth').value;
    if(sourceMonth && targetMonth && confirm(`承襲 ${sourceMonth} 至 ${targetMonth}？`)) {
        await postAction({ action: 'copy_month_template', sourceMonth, targetMonth, deptName: currentDept });
    }
}

// ====== 人員設定快速編輯 (結合備註功能) ======
function openQuickEmpEdit(empId) {
    const emp = appData.staff.find(e => e['員工編號'] === empId);
    if(!emp) return;
    
    document.getElementById('qEmpId').value = empId;
    document.getElementById('qEmpName').innerText = emp['姓名'];
    document.getElementById('qDept').value = emp['所屬單位'] || '藥學部';
    document.getElementById('qAuth').value = emp['權限'] || '';
    
    // 處理日期格式 (Y-m-d)
    document.getElementById('qStart').value = (emp['啟用時間'] || '').split(' ')[0] || '';
    document.getElementById('qEnd').value = (emp['停用時間'] || '').split(' ')[0] || '';
    
    document.getElementById('qCategory').value = emp['所屬類別'] || '';
    document.getElementById('qGroup').value = emp['所屬組別'] || '';
    
    // 空白欄位五作為日常備註
    document.getElementById('qRemark').value = emp['空白欄位五'] || '';
    
    document.getElementById('quickEmpModal').classList.remove('hidden');
}

async function saveQuickEmpEdit() {
    const empId = document.getElementById('qEmpId').value;
    const updateData = {
        '所屬單位': document.getElementById('qDept').value,
        '權限': document.getElementById('qAuth').value,
        '啟用時間': document.getElementById('qStart').value,
        '停用時間': document.getElementById('qEnd').value,
        '所屬類別': document.getElementById('qCategory').value,
        '所屬組別': document.getElementById('qGroup').value,
        '空白欄位五': document.getElementById('qRemark').value
    };
    
    document.getElementById('quickEmpModal').classList.add('hidden');
    await postAction({ action: 'update_employee', empId, updateData });
}
