const GAS_URL = 'https://script.google.com/macros/s/AKfycbzT3uS_MBktdkAQYXo4ZM9_TJ90wkmtRnGf2MWA8R6KDL260qv4s1xB7XmRyg7z4lSq/exec';

let appData = { depts: [], staff: [], tasks: [], shifts: [], auths: [] };
let currentUser = null;
let allowedDepts = [];
let currentDept = null;
let currentPublicDept = null;
let scheduleMode = 'person';
let customStaffOrder = []; // 儲存拖曳人員的自訂順序
