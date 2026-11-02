let currentHolidayDept = null;

function openHolidayAdmin() {
    hideAllViews();
    document.getElementById('holidayAdminView').classList.remove('hidden');

    const deptSelect = document.getElementById('holidayDeptSelect');
    deptSelect.innerHTML = '<option value="">--請選擇部門--</option>';
    allowedDepts.forEach(d => deptSelect.innerHTML += `<option value="${d}">${d}</option>`);

    const now = new Date();
    document.getElementById('holidayMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    renderHolidayGrid();
}

function renderHolidayGrid() {
    currentHolidayDept = document.getElementById('holidayDeptSelect').value;
    const monthStr = document.getElementById('holidayMonth').value;
    const table = document.getElementById('holidayTable');
    table.innerHTML = '';

    if(!currentHolidayDept || !monthStr) {
        table.innerHTML = '<tr><td class="p-10 text-slate-400 font-bold">👆 請先於上方選擇「部門」與「月份」</td></tr>';
        return;
    }

    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentHolidayDept || !t['部門名稱']);
    const deptStaff = appData.staff.filter(s => s['所屬組別'] === currentHolidayDept);
    
    // 找出該月所有排班，以歸納出「每一天」目前指派了哪些工作
    const monthShifts = appData.shifts.filter(s => s['部門名稱'] === currentHolidayDept && s['日期'].startsWith(monthStr) && s['工作類別'] === '假日');

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

        // 該日所有已建立的假日工作
        const dailyShifts = monthShifts.filter(s => s['日期'] === dateStr);

        tbody += `<tr class="${rowClass} hover:bg-slate-50 transition border-b">`;
        tbody += `<td class="border-r p-2 ${dateColor} align-top w-32 shrink-0">
                    <div>${mm}/${String(d).padStart(2,'0')} (${dayOfWeek})</div>
                    <button onclick="addHolidayTask('${dateStr}')" class="mt-2 text-[10px] bg-pink-100 text-pink-700 px-2 py-1 rounded shadow hover:bg-pink-200">+ 新增工作</button>
                  </td>`;
        
        tbody += `<td class="p-2 flex flex-wrap gap-2">`;
        
        if (dailyShifts.length === 0) {
            tbody += `<div class="text-slate-400 text-xs mt-2 italic">該日尚無指派工作</div>`;
        } else {
            dailyShifts.forEach(shift => {
                let options = '<option value="">--待指派--</option>';
                deptStaff.forEach(emp => {
                    const selected = shift['員工編號'] === emp['員工編號'] ? 'selected' : '';
                    options += `<option value="${emp['員工編號']}" ${selected}>${emp['姓名']}</option>`;
                });

                tbody += `<div class="bg-white border border-pink-200 rounded shadow-sm p-2 flex flex-col gap-1 w-40 shrink-0">
                    <div class="text-xs font-bold text-pink-800 flex justify-between items-center border-b border-pink-100 pb-1 mb-1">
                        <span class="truncate" title="${shift['工作名稱']}">${shift['工作名稱']}</span>
                        <button onclick="deleteHolidayShift('${shift['排班ID']}')" class="text-red-400 hover:text-red-600 font-bold" title="刪除此工作">✖</button>
                    </div>
                    <select class="w-full border p-1 rounded text-xs text-slate-700 focus:ring-1 focus:ring-pink-400"
                            onchange="updateHolidayEmp('${shift['排班ID']}', this.value)">
                        ${options}
                    </select>
                </div>`;
            });
        }
        tbody += `</td></tr>`;
    }
    tbody += `</tbody>`;
    table.innerHTML = tbody;
}

// 點擊「新增工作」按鈕，彈出視窗請使用者挑選工作清單
async function addHolidayTask(dateStr) {
    const deptTasks = appData.tasks.filter(t => t['部門名稱'] === currentHolidayDept || !t['部門名稱']);
    if(deptTasks.length === 0) return alert("該部門尚無任何「工作項目」，請先至清單維護新增。");

    // 建立下拉選單字串供 prompt 使用 (簡單實作，若需美觀可改寫為自訂 Modal)
    let taskNames = deptTasks.map((t, idx) => `${idx + 1}. ${t['工作名稱']}`).join('\n');
    let input = prompt(`請輸入要新增的工作「編號」：\n\n${taskNames}`);
    
    if (input && !isNaN(input) && input > 0 && input <= deptTasks.length) {
        const selectedTask = deptTasks[input - 1]['工作名稱'];
        const shiftId = 'H' + new Date().getTime();
        
        await postAction({
            action: 'save_shift', shiftId, date: dateStr, dept: currentHolidayDept,
            empId: '', task: selectedTask, start: '08:00', end: '17:00', 
            category: '假日', remark1: '', remark2: ''
        });
        // 不需 reload，因為 postAction 內部已呼叫 reloadData() 並觸發重繪 (但因為在不同頁面，需重新呼叫 renderHolidayGrid)
        renderHolidayGrid();
    }
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
    if(confirm("確定刪除此假日工作指派？")) {
        await postAction({ action: 'delete_shift', shiftId: shiftId });
        renderHolidayGrid();
    }
}
