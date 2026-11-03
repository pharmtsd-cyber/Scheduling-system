function showTaskMaint() {
    hideAllViews(); document.getElementById('taskAdminView').classList.remove('hidden');
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    // 顯示目前操作部門的工作清單
    const tasks = appData.tasks.filter(t => t['部門名稱'] === currentDept);
    if(tasks.length === 0) tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">目前尚無工作項目，請在上方新增。</td></tr>';
    
    tasks.forEach(t => {
        tbody.innerHTML += `<tr class="border-b"><td class="p-2 font-bold">${t['工作名稱']}</td><td class="p-2 text-blue-700">${t['預設類別']}</td>
        <td class="p-2"><button onclick="deleteTask('${t['工作名稱']}')" class="text-red-500 font-bold hover:underline">刪除</button></td></tr>`;
    });
}

// 讀取 UI 表單來新增工作
async function addTask() {
    const nameInput = document.getElementById('newTaskName');
    const catInput = document.getElementById('newTaskCat');
    const taskName = nameInput.value.trim();
    const category = catInput.value;
    
    if(!taskName) return alert("請輸入新工作名稱！");
    if(!currentDept) return alert("請先於左側點擊您要管理的部門！");
    
    await postAction({ action: 'add_task', taskName: taskName, category: category, dept: currentDept });
    
    // 清空輸入框
    nameInput.value = '';
    showTaskMaint();
}

async function deleteTask(name) {
    if(confirm(`確定要刪除工作 [${name}] 嗎？(這不會影響已排好的班表，但無法再新增此工作)`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: currentDept });
        showTaskMaint();
    }
}

// 以下員工維護 (showEmployeeMaint / editEmployee) 保持不變
function showEmployeeMaint() {
    hideAllViews(); document.getElementById('employeeAdminView').classList.remove('hidden');
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    appData.staff.forEach(emp => {
        tbody.innerHTML += `<tr class="border-b"><td class="p-2">${emp['員工編號']}</td><td class="p-2 font-bold">${emp['姓名']}</td><td class="p-2 text-blue-600">${emp['所屬組別'] || '無'}</td><td class="p-2"><button onclick="editEmployee('${emp['員工編號']}')" class="text-blue-600 font-bold underline">編輯</button></td></tr>`;
    });
}
async function editEmployee(empId) {
    const emp = appData.staff.find(e => e['員工編號'] == empId);
    const newGroup = prompt(`修改 ${emp['姓名']} 的排班組別：`, emp['所屬組別'] || '');
    if(newGroup !== null && newGroup !== emp['所屬組別']) {
        await postAction({ action: 'update_employee', empId, updateData: { '所屬組別': newGroup } });
        showEmployeeMaint();
    }
}
