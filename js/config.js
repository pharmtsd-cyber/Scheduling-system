const GAS_URL = '請貼上您最新的_GAS_WEB_APP_URL';
let appData = { depts: [], staff: [], tasks: [], shifts: [], auths: [] };
let currentUser = null;
let allowedDepts = [];
let currentDept = null;
let currentPublicDept = null;
let scheduleMode = 'person';
let customStaffOrder = []; // 儲存拖曳人員的自訂順序
