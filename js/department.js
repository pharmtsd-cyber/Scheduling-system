function selectDept(deptName) {
    currentDept = deptName;
    document.getElementById('currentDeptTitle').innerText = deptName + ' 狀態總覽';
    document.getElementById('mainContent').classList.remove('hidden');
    
    // 預設填入今日日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('formDate').value = today;
    document.getElementById('ganttDate').value = today;
    
    renderScheduleForm(); 
    renderGantt();
}

async function copyLastMonth() {
    const targetMonth = document.getElementById('targetMonth').value; // YYYY-MM
    if(!targetMonth) return alert("請先選擇要排班的月份 (年-月)！");
    
    if(confirm(`確定要將上個月的排班承襲至 ${targetMonth} 嗎？\n(將會自動平移日期並保留工作設定)`)) {
        const res = await postAction({ action: 'copy_last_month', deptName: currentDept, targetMonth: targetMonth });
        alert(`成功承襲 ${res.copied} 筆排班資料！`);
        location.reload();
    }
}
