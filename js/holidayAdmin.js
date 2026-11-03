let currentHolidayDept = null;

function openHolidayAdmin() {
    hideAllViews();
    document.getElementById('holidayAdminView').classList.remove('hidden');

    const deptSelect = document.getElementById('holidayDeptSelect');
    deptSelect.innerHTML = '<option value="">--請選擇部門--</option>';
    allowedDepts.forEach(d => deptSelect.innerHTML += `<option value="${d}">${d}</option>`);

    const now = new Date();
    document.getElementById('holidayMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('holidayCatFilter').value = 'ALL'; // 預設顯示全部

    renderHolidayGrid();
}

function renderHolidayGrid() {
    currentHolidayDept = document.getElementById('holidayDeptSelect').value;
    const monthStr = document.getElementById('holidayMonth').value;
    const catFilter = document.getElementById('holidayCatFilter').value;
    const table = document.getElementById('holidayTable');
    table.innerHTML = '';

    if(!currentHolidayDept || !monthStr) {
        table.innerHTML = '<tr><td class="p-10 text-slate-400 font-bold">👆 請先於上方選擇「部門」與「月份」</td></tr>';
        return;
    }

    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentHolidayDept);
    
    // 找出該月所有排班，並套用類別篩選
    let monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentHolidayDept && s['日期'].startsWith(monthStr));
    if (catFilter !== 'ALL') {
        monthShifts = monthShifts.filter(s => s['工作類別'] === catFilter);
    }

    const [yyyy, mm] = monthStr.split('-');
    const daysInMonth = new Date(yyyy, mm, 0).getDate();

    let tbody = `<tbody class="bg-white">`;
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${yyyy}-${mm}-${String(d).padStart(2,'0')}`;
        const dateObj = new Date(dateStr);
        const dayOfWeek = ['日','一','二','三','四','五','六'][dateObj.getDay()];
        const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
        const rowClass = isWeekend ? 'bg-pink-50' : '';
        const dateColor = isWeekend ? 'text-red-500 font-bold' : 'text-slate-700 font-bold';

        const dailyShifts = monthShifts.filter(s => s['日期'] === dateStr);

        tbody += `<tr class="${rowClass} hover:bg-slate-50 transition border-b">`;
        tbody += `<td class="border-r p-2 ${dateColor} align-top w-32 shrink-0">
                    <div>${mm}/${String(d).padStart(2,'0')} (${dayOfWeek})</div>
                    <button onclick="openHolidayTaskModal('${dateStr}')" class="mt-2 text-[10px] bg-pink-100 text-pink-700 px-2 py-1 rounded shadow hover:bg-pink-200">+ 新增工作</button>
                  </td>`;
        
        tbody += `<td class="p-2 flex flex-wrap gap-2">`;
        
        if (dailyShifts.length === 0) {
            tbody += `<div class="text-slate-400 text-xs mt-2 italic">該日尚無指派工作 (或被篩選器隱藏)</div>`;
        } else {
            dailyShifts.forEach(shift => {
                let options = '<option value="">--待指派--</option>';
                deptStaff.forEach(emp => {
                    const selected = shift['員工編號'] === emp['員工編號'] ? 'selected' : '';
                    options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
                });

                tbody += `<div class="bg-white border border-pink-200 rounded shadow-sm p-2 flex flex-col gap-1 w-40 shrink-0 relative">
                    <div class="text-xs font-bold text-pink-800 flex justify-between items-center border-b border-pink-100 pb-1 mb-1">
                        <span class="truncate" title="${shift['工作名稱']}">${shift['工作名稱']}</span>
                        <button onclick="deleteHolidayShift('${shift['排班ID']}')" class="text-red-400 hover:text-red-600 font-bold" title="刪除此工作">✖</button>
                    </div>
                    <select class="w-full border p-1 rounded text-xs text-slate-700 focus:ring-1 focus:ring-pink-400"
                            onchange="updateHolidayEmp('${shift['排班ID']}', this.value)">
                        ${options}
                    </select>
                    <div class="text-[9px] text-slate-400 text-right mt-1">${shift['工作類別']}</div>
                </div>`;
            });
        }
        tbody += `</td></tr>`;
    }
    tbody += `</tbody>`;
    table.innerHTML = tbody;
}

// 開啟新增工作彈窗 (連動類別過濾)
function openHolidayTaskModal(dateStr) {
    document.getElementById('hTaskDate').value = dateStr;
    // 預設選中目前的篩選器類別 (如果是 ALL，就讓使用者自己選，或預設一個)
    const currentFilter = document.getElementById('holidayCatFilter').value;
    document.getElementById('hTaskCat').value = currentFilter !== 'ALL' ? currentFilter : '假日班(常規)';
    
    filterHolidayTaskOptions();
    document.getElementById('holidayTaskModal').classList.remove('hidden');
}

// 根據選取的類別，過濾工作清單下拉選單
function filterHolidayTaskOptions() {
    const selectedCat = document.getElementById('hTaskCat').value;
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentHolidayDept || !t['部門名稱']);
    
    let filteredTasks = deptTasks;
    if (selectedCat !== 'ALL') {
        filteredTasks = deptTasks.filter(t => t['預設類別'] === selectedCat);
    }
    
    const select = document.getElementById('hTaskSelect');
    select.innerHTML = '';
    if(filteredTasks.length === 0) {
        select.innerHTML = '<option value="">(此類別無可用工作項目)</option>';
    } else {
        filteredTasks.forEach(t => {
            select.innerHTML += `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`;
        });
    }
}

// 儲存行事曆工作
async function saveHolidayTask() {
    const dateStr = document.getElementById('hTaskDate').value;
    const taskName = document.getElementById('hTaskSelect').value;
    let taskCat = document.getElementById('hTaskCat').value;
    
    if(!taskName) return alert('請選擇有效的工作項目，若無項目請先至「工作清單維護」新增。');
    
    // 如果類別選了 ALL，就去找這份工作在資料庫的預設類別
    if (taskCat === 'ALL') {
        const taskInfo = appData.tasks.find(t => t['工作名稱'] === taskName);
        taskCat = taskInfo ? taskInfo['預設類別'] : '假日班(常規)';
    }

    const shiftId = 'H' + new Date().getTime();
    
    document.getElementById('holidayTaskModal').classList.add('hidden');
    
    await postAction({
        action: 'save_shift', shiftId, date: dateStr, dept: currentHolidayDept,
        empId: '', task: taskName, start: '08:00', end: '17:00', 
        category: taskCat, remark1: '', remark2: ''
    });
    
    renderHolidayGrid();
}

async function updateHolidayEmp(shiftId, empId) {
    const shift = appData.shifts.find(s => s['排班ID'] === shiftId);
    if(shift) {
        await postAction({ 
            action: 'save_shift', shiftId, date: shift['日期'], dept: shift['部門名稱'], 
            empId: empId, task: shift['工作名稱'], start: shift['開始時間'], 
            end: shift['結束時間'], category: shift['工作類別'], 
            remark1: shift['備註'], remark2: shift['備註2'] 
        });
        renderHolidayGrid();
    }
}

async function deleteHolidayShift(shiftId) {
    if(confirm("確定刪除此工作指派？")) {
        await postAction({ action: 'delete_shift', shiftId: shiftId });
        renderHolidayGrid();
    }
}
