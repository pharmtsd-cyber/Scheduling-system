// ==========================================
// 員工名冊維護 (多重篩選器)
// ==========================================
function showEmployeeMaint() {
    hideAllViews(); 
    document.getElementById('employeeAdminView').classList.remove('hidden');

    // 動態取得目前擁有的類別與組別
    const catSelect = document.getElementById('empCatFilter');
    const groupSelect = document.getElementById('empGroupFilter');
    
    let cats = [...new Set(appData.staff.map(s => s['所屬類別']).filter(Boolean))];
    let groups = [...new Set(appData.staff.map(s => s['所屬組別']).filter(Boolean))];

    catSelect.innerHTML = '<option value="ALL">全部類別</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    groupSelect.innerHTML = '<option value="ALL">全部組別</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('');

    document.getElementById('empSearchInput').value = '';
    renderEmployeeList();
}

function renderEmployeeList() {
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    
    const deptFilter = document.getElementById('empDeptFilter').value;
    const catFilter = document.getElementById('empCatFilter').value;
    const groupFilter = document.getElementById('empGroupFilter').value;
    const keyword = document.getElementById('empSearchInput').value.toLowerCase();
    
    let staff = [...appData.staff];

    // 條件過濾
    if (deptFilter !== 'ALL') staff = staff.filter(s => (s['所屬單位'] || '') === deptFilter);
    if (catFilter !== 'ALL') staff = staff.filter(s => (s['所屬類別'] || '') === catFilter);
    if (groupFilter !== 'ALL') staff = staff.filter(s => (s['所屬組別'] || '') === groupFilter);
    
    // 模糊搜尋
    if (keyword) {
        staff = staff.filter(s => 
            s['員工編號'].toLowerCase().includes(keyword) || 
            s['姓名'].toLowerCase().includes(keyword)
        );
    }

    // ★ 依編號排序
    staff.sort((a, b) => String(a['員工編號']).localeCompare(String(b['員工編號'])));
    
    if(staff.length === 0) return tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 font-bold">查無符合資料</td></tr>';

    staff.forEach(emp => {
        const isResigned = (emp['所屬單位'] === '離職');
        const rowClass = isResigned ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50 transition';
        const nameColor = isResigned ? 'text-slate-500 line-through' : 'text-slate-800';
        
        tbody.innerHTML += `
            <tr class="border-b ${rowClass}">
                <td class="p-3 text-slate-500 font-mono">${emp['員工編號']}</td>
                <td class="p-3 font-bold ${nameColor}">${emp['姓名']}</td>
                <td class="p-3 text-slate-600">${emp['所屬類別'] || ''}</td>
                <td class="p-3 text-blue-700 font-bold">${emp['所屬組別'] || '<span class="text-slate-400 font-normal">未指派</span>'}</td>
                <td class="p-3">
                    <button onclick="openQuickEmpEdit('${emp['員工編號']}')" class="text-blue-600 font-bold hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded transition">編輯屬性</button>
                </td>
            </tr>`;
    });
}


// ==========================================
// 工作項目維護 (搜尋與編輯)
// ==========================================
function showTaskMaint() {
    hideAllViews(); 
    document.getElementById('taskAdminView').classList.remove('hidden');
    
    // 載入部門篩選器
    const deptSelect = document.getElementById('taskDeptFilter');
    deptSelect.innerHTML = '<option value="ALL">全部部門</option>';
    appData.depts.forEach(d => {
        const selected = (d['部門名稱'] === currentDept) ? 'selected' : '';
        deptSelect.innerHTML += `<option value="${d['部門名稱']}" ${selected}>${d['部門名稱']}</option>`;
    });

    resetTaskForm();
    renderTaskList();
}

function renderTaskList() {
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    const deptFilter = document.getElementById('taskDeptFilter').value;
    const catFilter = document.getElementById('taskCatFilter').value;
    const keyword = document.getElementById('taskSearchInput').value.toLowerCase();
    
    let tasks = [...appData.tasks];
    
    if (deptFilter !== 'ALL') tasks = tasks.filter(t => t['部門名稱'] === deptFilter);
    if (catFilter !== 'ALL') tasks = tasks.filter(t => (t['預設類別'] || '').includes(catFilter));
    if (keyword) tasks = tasks.filter(t => t['工作名稱'].toLowerCase().includes(keyword));
    
    // 依名稱排序
    tasks.sort((a, b) => a['工作名稱'].localeCompare(b['工作名稱']));
    
    if(tasks.length === 0) return tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">查無符合條件之工作</td></tr>';
    
    tasks.forEach(t => {
        const escapedName = t['工作名稱'].replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-3 text-slate-500 text-xs">${t['部門名稱'] || ''}</td>
                <td class="p-3 font-bold text-slate-700">${t['工作名稱']}</td>
                <td class="p-3 text-blue-700 font-bold">${t['預設類別']}</td>
                <td class="p-3 flex gap-2">
                    <button onclick="editTask('${t['工作代碼']}', '${escapedName}', '${t['預設類別']}')" class="text-indigo-600 font-bold hover:text-indigo-800 px-2 py-1 bg-indigo-50 rounded">編輯</button>
                    <button onclick="deleteTask('${escapedName}')" class="text-red-500 font-bold hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded">刪除</button>
                </td>
            </tr>`;
    });
}

function editTask(taskId, name, category) {
    document.getElementById('editTaskId').value = taskId;
    document.getElementById('editTaskId').setAttribute('data-oldname', name);
    document.getElementById('newTaskName').value = name;
    document.getElementById('newTaskCat').value = category;
    
    document.getElementById('btnSaveTask').innerText = '💾 儲存修改';
    document.getElementById('btnSaveTask').classList.replace('bg-blue-600', 'bg-indigo-600');
    document.getElementById('btnCancelTask').classList.remove('hidden');
}

function resetTaskForm() {
    document.getElementById('editTaskId').value = '';
    document.getElementById('editTaskId').removeAttribute('data-oldname');
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskCat').value = '工作日(常規)';
    document.getElementById('btnSaveTask').innerText = '➕ 新增';
    document.getElementById('btnSaveTask').classList.replace('bg-indigo-600', 'bg-blue-600');
    document.getElementById('btnCancelTask').classList.add('hidden');
}

async function saveTask() {
    const taskId = document.getElementById('editTaskId').value;
    const oldName = document.getElementById('editTaskId').getAttribute('data-oldname');
    const taskName = document.getElementById('newTaskName').value.trim();
    const category = document.getElementById('newTaskCat').value;
    const deptInput = document.getElementById('taskDeptFilter').value;
    
    if(deptInput === 'ALL') return alert("請先於左方篩選器選擇「特定部門」後，再新增/編輯工作！");
    if(!taskName) return alert("請輸入工作名稱！");
    
    if (!taskId) {
        const isExist = appData.tasks.find(t => t['部門名稱'] === deptInput && t['工作名稱'] === taskName);
        if(isExist) return alert("此工作名稱已經存在本部門，請更換名稱。");
    }
    
    await postAction({ 
        action: 'save_task', 
        taskId: taskId || Utilities.getUuid().substring(0,8),
        oldTaskName: oldName,
        taskName: taskName, 
        category: category, 
        dept: deptInput 
    });
    
    resetTaskForm();
    showTaskMaint();
}

async function deleteTask(name) {
    const deptInput = document.getElementById('taskDeptFilter').value;
    if(deptInput === 'ALL') return alert("請先選擇特定部門再進行刪除");
    
    if(confirm(`確定要刪除 [${deptInput}] 的工作 [${name}] 嗎？`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: deptInput });
        showTaskMaint();
    }
}
