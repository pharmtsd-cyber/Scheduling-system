let currentPublicDept = null;

function openPublicDept(deptName) {
    currentPublicDept = deptName;
    hideAllViews();
    document.getElementById('publicView').classList.remove('hidden');
    document.getElementById('publicTitle').innerText = `${deptName} - 排班總覽`;
    document.getElementById('publicDate').value = new Date().toISOString().split('T')[0];
    renderPublicChart();
}

function renderPublicChart() {
    const container = document.getElementById('timeline_chart');
    const chart = new google.visualization.Timeline(container);
    const dataTable = new google.visualization.DataTable();

    dataTable.addColumn({ type: 'string', id: '人員' });
    dataTable.addColumn({ type: 'string', id: '工作名稱' });
    dataTable.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
    dataTable.addColumn({ type: 'date', id: '開始時間' });
    dataTable.addColumn({ type: 'date', id: '結束時間' });

    const date = document.getElementById('publicDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentPublicDept && s['日期'] === date);
    
    if(shifts.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400">該日無排班資料</div>';
        return;
    }
    const rows = shifts.map(s => {
        const emp = appData.staff.find(e => e['員工編號'] == s['員工編號']);
        const name = emp ? emp['姓名'] : s['員工編號'];
        const [sh, sm] = (s['開始時間'] || '00:00').split(':');
        const [eh, em] = (s['結束時間'] || '00:00').split(':');
        return [name, s['工作名稱'], `<div style="padding:10px;"><b>${name}</b><br>工作：${s['工作名稱']}<br>備註：${s['備註'] || '無'}</div>`, new Date(2026,0,1,sh,sm), new Date(2026,0,1,eh,em)];
    });
    dataTable.addRows(rows);
    chart.draw(dataTable, { timeline: { colorByRowLabel: true }, tooltip: { isHtml: true } });
}
