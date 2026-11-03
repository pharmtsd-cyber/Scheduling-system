// ==========================================
// 工作項目維護 (Task Maintenance)
// ==========================================
function showTaskMaint() {
    hideAllViews(); 
    document.getElementById('taskAdminView').classList.remove('hidden');
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    
    // 顯示目前選擇部門的工作清單
    const tasks = appData.tasks.filter(t => t['部門名稱'] === currentDept);
    
    if(tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400 font-bold">目前尚無工作項目，請在上方新增。</td></tr>';
    } else {
        tasks.forEach(t => {
            tbody.innerHTML += `
                <tr class="border-b hover:bg-slate-50 transition">
                    <td class="p-3 font-bold text-slate-700">${t['工作名稱']}</td>
                    <td class="p-3 text-blue-700 font-bold">${t['預設類別']}</td>
                    <td class="p-3">
                        <button onclick="deleteTask('${t['工作名稱']}')" class="text-red-500 font-bold hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition">刪除</button>
                    </td>
                </tr>`;
        });
    }
}

// 讀取 UI 表單來新增工作
async function addTask() {
    const nameInput = document.getElementById('newTaskName');
    const catInput = document.getElementById('newTaskCat');
    const taskName = nameInput.value.trim();
    const category = catInput.value;
    
    if(!currentDept) return alert("請先於左側選單點擊您要管理的部門！");
    if(!taskName) return alert("請輸入新工作名稱！");
    
    // 檢查是否重複
    const isExist = appData.tasks.find(t => t['部門名稱'] === currentDept && t['工作名稱'] === taskName);
    if(isExist) return alert("此工作名稱已經存在，請更換名稱。");
    
    await postAction({ 
        action: 'add_task', 
        taskName: taskName, 
        category: category, 
        dept: currentDept 
    });
    
    // 清空輸入框
    nameInput.value = '';
    showTaskMaint();
}

async function deleteTask(name) {
    if(confirm(`確定要刪除工作 [${name}] 嗎？\n(這不會影響已排好的舊班表，但未來無法再新增此工作)`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: currentDept });
        showTaskMaint();
    }
}

// ==========================================
// 員工名冊維護 (Employee Maintenance)
// ==========================================
function showEmployeeMaint() {
    hideAllViews(); 
    document.getElementById('employeeAdminView').classList.remove('hidden');
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    
    if(appData.staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">目前無員工資料，請檢查外部名冊連線。</td></tr>';
        return;
    }

    // 依據組別排序，讓畫面比較好看
    const sortedStaff = [...appData.staff].sort((a, b) => (a['所屬組別'] || '').localeCompare(b['所屬組別'] || ''));

    sortedStaff.forEach(emp => {
        // 如果是離職，標示為灰色
        const isResigned = (emp['所屬單位'] === '離職');
        const rowClass = isResigned ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50 transition';
        const nameColor = isResigned ? 'text-slate-500 line-through' : 'text-slate-800';
        
        tbody.innerHTML += `
            <tr class="border-b ${rowClass}">
                <td class="p-3 text-slate-500">${emp['員工編號']}</td>
                <td class="p-3 font-bold ${nameColor}">${emp['姓名']}</td>
                <td class="p-3 text-blue-700 font-bold">${emp['所屬組別'] || '<span class="text-slate-400 font-normal">尚未指派</span>'}</td>
                <td class="p-3">
                    <button onclick="openQuickEmpEdit('${emp['員工編號']}')" class="text-blue-600 font-bold hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded transition">編輯屬性</button>
                </td>
            </tr>`;
    });
}
