// --- Supabase Config ---
const SUPABASE_URL = 'https://krjzpnnrccdqzielykhz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyanpwbm5yY2NkcXppZWx5a2h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjE0OTYsImV4cCI6MjEwMjA5NzQ5Nn0.cd2N3pJdUO_NkUHV0NigC8P4mNRXHUn9U11FQijKLTo';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// --- Authentication Logic ---
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-overlay')?.classList.add('hidden');
        await loadAllDataFromCloud();
    }
});

document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        const signUp = await supabaseClient.auth.signUp({ email, password });
        data = signUp.data;
        error = signUp.error;
    }

    if (error) {
        alert('שגיאה: ' + error.message);
    } else if (data?.user) {
        currentUser = data.user;
        document.getElementById('auth-overlay')?.classList.add('hidden');
        await loadAllDataFromCloud();
    }
});
// --- State Management ---
        const PASTEL_COLORS = [
            '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', 
            '#E2CBF7', '#FFD1DC', '#D4F0F0', '#F3E5AB', '#FFCCB6'
        ];

        let items = JSON.parse(localStorage.getItem('studentPlanner_items')) || [];
        let courses = JSON.parse(localStorage.getItem('studentPlanner_courses')) || [];
        let pomoHistory = JSON.parse(localStorage.getItem('studentPlanner_pomo')) || [];
        
        let currentDate = new Date();
        let selectedWeekDate = new Date();
        let editingItemId = null;
        let currentDashboardCourseId = null;

        // Migration from old logic if exists
        function migrateOldData() {
            let oldTasks = localStorage.getItem('studentPlanner_tasks');
            if (oldTasks) {
                let parsedTasks = JSON.parse(oldTasks);
                items = parsedTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    date: t.date,
                    courseId: t.courseId,
                    notes: t.notes,
                    itemType: (t.type === 'assignment') ? 'assignment' : 'task',
                    completed: false,
                    createdAt: editingItemId ? (items.find(i => i.id === editingItemId)?.createdAt || Date.now()) : Date.now()
                }));
                localStorage.removeItem('studentPlanner_tasks');
                saveData();
            }
            
            // Give color to old courses
            let changed = false;
            courses.forEach((c, i) => {
                if(!c.color) {
                    c.color = PASTEL_COLORS[i % PASTEL_COLORS.length];
                    changed = true;
                }
            });
            if(changed) saveData();
        }

        function saveData() {
            localStorage.setItem('studentPlanner_items', JSON.stringify(items));
            localStorage.setItem('studentPlanner_courses', JSON.stringify(courses));
            localStorage.setItem('studentPlanner_pomo', JSON.stringify(pomoHistory));
        }

        // Helpers
        function formatLocalDate(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function formatShortDate(dateStr) {
            if (!dateStr) return '';
            const [year, month, day] = dateStr.split('-').map(Number);
            return `${day}.${month}.${year}`;
        }

        function escapeHtml(value = '') {
            return String(value)
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function getCourseInfo(id) {
            if (!id) return null;
            return courses.find(c => c.id === id);
        }

        function hexToRgb(hex) {
            const clean = hex.replace('#', '');
            const value = parseInt(clean, 16);
            return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
        }

        function colorDistance(hex1, hex2) {
            const a = hexToRgb(hex1), b = hexToRgb(hex2);
            return Math.sqrt(
                Math.pow(a.r - b.r, 2) +
                Math.pow(a.g - b.g, 2) +
                Math.pow(a.b - b.b, 2)
            );
        }

        function pickSmartCourseColor() {
            if(courses.length === 0) {
                return PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
            }

            const recent = courses.slice(-3).map(c => c.color).filter(Boolean);
            const candidates = PASTEL_COLORS
                .map(color => ({
                    color,
                    score: recent.length
                        ? Math.min(...recent.map(existing => colorDistance(color, existing)))
                        : 999
                }))
                .sort((a, b) => b.score - a.score);

            const top = candidates.slice(0, Math.min(4, candidates.length));
            return top[Math.floor(Math.random() * top.length)].color;
        }

        function strengthenColor(hex, amount = 0.22) {
            const {r, g, b} = hexToRgb(hex);
            const f = 1 - amount;
            const nr = Math.max(0, Math.round(r * f));
            const ng = Math.max(0, Math.round(g * f));
            const nb = Math.max(0, Math.round(b * f));
            return `rgb(${nr}, ${ng}, ${nb})`;
        }

        function getExamLabel(exam) {
            const type = exam.examType === 'final' ? 'מבחן סופי' : 'מבחן אמצע';
            const session = exam.examSession === 'B' ? 'מועד ב' : 'מועד א';
            return `${type}, ${session}`;
        }

        function getNearestFutureExam(courseId = null) {
            const exams = items
                .filter(i => i.itemType === 'exam' && (!courseId || i.courseId === courseId))
                .filter(i => getDaysDiff(i.date) >= 0)
                .sort((a, b) => dateFromInput(a.date) - dateFromInput(b.date));
            return exams[0] || null;
        }

        
        function dateFromInput(dateStr) {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day, 12, 0, 0, 0);
        }

        function isOverdue(dateStr, completed) {
            if (completed || !dateStr) return false;
            const today = new Date();
            today.setHours(12,0,0,0);
            const itemDate = dateFromInput(dateStr);
            return itemDate < today;
        }

        function getDaysDiff(dateStr) {
            if (!dateStr) return 0;
            const today = new Date();
            today.setHours(12,0,0,0);
            const target = dateFromInput(dateStr);
            const diffTime = target - today;
            return Math.round(diffTime / (1000 * 60 * 60 * 24));
        }

        function switchView(viewId, mobileBtn = null) {
            const views = ['view-threedays', 'view-monthly', 'view-weekly', 'view-courses', 'view-pomodoro'];
            views.forEach(v => document.getElementById(v).classList.add('hidden'));
            document.getElementById(`view-${viewId}`).classList.remove('hidden');

            // Reset Course dashboard if navigating away from courses
            if(viewId !== 'courses') {
                document.getElementById('course-dashboard').classList.add('hidden');
                document.getElementById('courses-main-page').classList.remove('hidden');
            }

            // Desktop nav update
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const desktopNavs = { 'threedays': 0, 'monthly': 1, 'weekly': 2, 'courses': 3, 'pomodoro': 4 };
            const navItems = document.querySelectorAll('.nav-item');
            if(navItems[desktopNavs[viewId]]) navItems[desktopNavs[viewId]].classList.add('active');

            // Mobile nav update
            document.querySelectorAll('.nav-mobile').forEach(el => {
                el.classList.remove('text-[var(--primary-text)]', 'font-bold');
                el.classList.add('text-[var(--secondary-text)]');
            });
            if (mobileBtn) {
                mobileBtn.classList.remove('text-[var(--secondary-text)]');
                mobileBtn.classList.add('text-[var(--primary-text)]', 'font-bold');
            }

            // Renders
            if (viewId === 'threedays') renderThreeDays();
            if (viewId === 'monthly') renderCalendar();
            if (viewId === 'weekly') renderWeekly();
            if (viewId === 'courses') renderCoursesList();
            if (viewId === 'pomodoro') {
                updatePomoCourseSelect();
                updatePomoStats();
            }
        }

        // This function builds the HTML for a single task/assignment card to keep design consistent
        function buildItemHtml(item, context = 'default') {
            const course = getCourseInfo(item.courseId);
            const courseColor = course ? course.color : '#e0e0e0';
            const courseName = escapeHtml(course ? course.name : 'כללי');
            const overdue = isOverdue(item.date, item.completed);
            
            let html = '';
            
            if (item.itemType === 'exam') {
                const daysDiff = getDaysDiff(item.date);
                const isPast = daysDiff < 0;
                const examClass = item.examType === 'final' ? 'exam-final' : 'exam-midterm';
                const examIcon = item.examType === 'final' ? 'fa-award' : 'fa-clipboard-list';
                const strongColor = strengthenColor(course ? course.color : '#c8b9aa', item.examType === 'final' ? 0.33 : 0.20);
                const dateText = formatShortDate(item.date);
                let countdown = '';
                if(daysDiff === 0) countdown = 'היום';
                else if(daysDiff === 1) countdown = 'מחר';
                else if(daysDiff > 1) countdown = `בעוד ${daysDiff} ימים`;
                else countdown = 'עבר';

                if(context === 'small') {
                    html = `
                    <div class="exam-calendar-pill ${examClass} ${isPast ? 'opacity-50' : ''} p-1.5 mb-1 cursor-pointer"
                         style="border-color:${strongColor}; color:${strongColor}"
                         onclick="openExamModal('${item.id}')">
                        <div class="flex items-center gap-1 min-w-0">
                            <i class="fas ${examIcon} text-[9px]"></i>
                            <span class="truncate text-[10px]">${escapeHtml(getExamLabel(item))}</span>
                        </div>
                    </div>`;
                } else {
                    html = `
                    <div class="exam-card ${examClass} ${isPast ? 'exam-past' : ''} p-4 cursor-pointer"
                         style="border-color:${strongColor}"
                         onclick="openExamModal('${item.id}')">
                        <div class="flex items-start gap-3">
                            <div class="exam-icon-badge" style="background-color:${courseColor}33; color:${strongColor}">
                                <i class="fas ${examIcon}"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-[10px] font-bold mb-1" style="color:${strongColor}">${courseName}</div>
                                <div class="font-bold text-base">${escapeHtml(getExamLabel(item))}</div>
                                <div class="text-xs text-[var(--secondary-text)] mt-1">${dateText}${isPast ? '' : `, ${countdown}`}</div>
                            </div>
                        </div>
                    </div>`;
                }

            } else if (item.itemType === 'assignment') {
                // ASSIGNMENT DESIGN
                const daysDiff = getDaysDiff(item.date);
                let countdownText = '';
                if(item.completed) countdownText = 'הוגש';
                else if (daysDiff < 0) countdownText = 'עבר תאריך ההגשה';
                else if (daysDiff === 0) countdownText = 'הגשה היום!';
                else if (daysDiff === 1) countdownText = 'הגשה מחר';
                else countdownText = `נותרו ${daysDiff} ימים`;

                const bgClass = item.completed ? 'bg-gray-50 opacity-75' : 'bg-[var(--assignment-bg)]';
                const borderClass = item.completed ? 'border-[var(--border-color)]' : 'border-[var(--assignment-border)]';
                const titleStyle = item.completed ? 'text-decoration: line-through; color: var(--secondary-text);' : '';

                html = `
                <div class="p-4 rounded-2xl border ${borderClass} ${bgClass} relative cursor-pointer hover:shadow-md transition group" onclick="openEditModal('${item.id}')">
                    <div class="absolute top-0 right-0 w-2 h-full rounded-r-2xl" style="background-color: ${courseColor}"></div>
                    
                    <div class="flex justify-between items-start pl-2 pr-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${courseColor}"></span>
                                <span class="text-xs font-bold" style="color: ${courseColor}">${courseName}</span>
                            </div>
                            <h4 class="font-bold text-lg leading-tight mb-2" style="${titleStyle}">${escapeHtml(item.title)}</h4>
                            
                            <div class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${daysDiff <= 2 && !item.completed ? 'bg-red-100 text-red-700' : 'bg-white text-[var(--primary-text)]'} border border-[var(--border-color)]">
                                <i class="fas fa-clock"></i> ${countdownText}
                            </div>
                        </div>
                        
                        <div class="check-circle ${item.completed ? 'checked' : 'bg-white'}" onclick="toggleCompletion(event, '${item.id}')">
                            <i class="fas fa-check text-xs ${item.completed ? 'block' : 'hidden group-hover:block opacity-30'}"></i>
                        </div>
                    </div>
                </div>`;
                
            } else {
                // TASK DESIGN
                const cardClasses = item.completed ? 'task-completed bg-gray-50' : 'bg-white';
                const lateBadge = overdue ? `<span class="text-[10px] bg-[var(--late-color)] text-white px-1.5 py-0.5 rounded ml-2">באיחור</span>` : '';
                
                let contextClasses = 'p-3 rounded-xl border border-[var(--border-color)] hover:shadow-md transition group relative cursor-pointer';
                if(context === 'small') contextClasses = 'p-1.5 px-2 rounded-lg border border-[var(--border-color)] hover:shadow-sm transition group relative cursor-pointer text-sm mb-1';

                html = `
                <div class="${contextClasses} ${cardClasses}" onclick="openEditModal('${item.id}')">
                    <div class="absolute top-0 right-0 w-1.5 h-full rounded-r-xl" style="background-color: ${courseColor}"></div>
                    <div class="flex justify-between items-center pr-3">
                        <div class="flex-1 truncate">
                            <div class="flex items-center gap-1 mb-0.5">
                                <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${courseColor}"></span>
                                <span class="text-[10px] font-medium text-[var(--secondary-text)]">${courseName}</span>
                                ${lateBadge}
                            </div>
                            <div class="font-medium task-title truncate ${context==='small'?'text-xs':'text-sm'}">${escapeHtml(item.title)}</div>
                            ${context === 'small' ? '' : `<div class="text-[10px] text-[var(--secondary-text)] mt-1"><i class="far fa-calendar ml-1"></i>עד ${formatShortDate(item.date)}</div>`}
                        </div>
                        <div class="check-circle ${context==='small'?'w-4 h-4 border':''} ${item.completed ? 'checked' : 'bg-white'}" onclick="toggleCompletion(event, '${item.id}')">
                            <i class="fas fa-check ${context==='small'?'text-[8px]':'text-xs'} ${item.completed ? 'block' : 'hidden group-hover:block opacity-30'}"></i>
                        </div>
                    </div>
                </div>`;
            }
            return html;
        }

        function toggleCompletion(e, id) {
            e.stopPropagation();
            const item = items.find(i => i.id === id);
            if(item) {
                item.completed = !item.completed;
                saveData();
                refreshCurrentView();
            }
        }

        function refreshCurrentView() {
            if(!document.getElementById('view-threedays').classList.contains('hidden')) renderThreeDays();
            else if(!document.getElementById('view-monthly').classList.contains('hidden')) renderCalendar();
            else if(!document.getElementById('view-weekly').classList.contains('hidden')) renderWeekly();
            else if(!document.getElementById('course-dashboard').classList.contains('hidden')) renderCourseDashboard(currentDashboardCourseId);
        }

        function renderThreeDays() {
            const grid = document.getElementById('threedays-grid');
            grid.innerHTML = '';

            const today = new Date();
            const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

            for(let i = 0; i < 3; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + i);
                const dateStr = formatLocalDate(targetDate);

                let title = '';
                if(i === 0) title = 'היום';
                else if(i === 1) title = 'מחר';
                else title = `יום ${dayNames[targetDate.getDay()]}`;

                const formatDisplay = `${targetDate.getDate()}.${targetDate.getMonth()+1}`;

                const col = document.createElement('div');
                col.className = 'glass-panel p-4 min-h-[50vh] md:min-h-[60vh] flex flex-col relative';
                if(i === 0) col.classList.add('border-[var(--accent-color)]', 'ring-1', 'ring-[var(--accent-color)]');

                col.innerHTML = `
                    <div class="border-b border-[var(--border-color)] pb-3 mb-4 flex justify-between items-baseline">
                        <h3 class="font-bold text-xl">${title}</h3>
                        <span class="text-sm text-[var(--secondary-text)]">${formatDisplay}</span>
                    </div>
                    <div class="flex-1 overflow-y-auto hide-scroll space-y-3" id="threedays-tasks-${i}"></div>
                `;
                grid.appendChild(col);

                const container = col.querySelector(`#threedays-tasks-${i}`);

                let dayTasks = items.filter(t => t.date === dateStr && t.itemType === 'task');

                if(i === 0) {
                    const overdueTasks = items.filter(t =>
                        t.itemType === 'task' &&
                        isOverdue(t.date, t.completed) &&
                        t.date !== dateStr
                    );
                    dayTasks = [...overdueTasks, ...dayTasks];
                }

                dayTasks.sort((a, b) => {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                    if (a.courseId !== b.courseId) {
                        const aName = getCourseInfo(a.courseId)?.name || 'כללי';
                        const bName = getCourseInfo(b.courseId)?.name || 'כללי';
                        return aName.localeCompare(bName, 'he');
                    }
                    return (a.createdAt || 0) - (b.createdAt || 0);
                });

                if(dayTasks.length === 0) {
                    container.innerHTML = `<div class="text-center text-sm text-[var(--secondary-text)] py-8 opacity-70">אין משימות ליום זה</div>`;
                } else {
                    const groups = new Map();

                    dayTasks.forEach(task => {
                        const key = task.courseId || 'general';
                        if(!groups.has(key)) groups.set(key, []);
                        groups.get(key).push(task);
                    });

                    groups.forEach((groupItems, groupKey) => {
                        const course = groupKey === 'general' ? null : getCourseInfo(groupKey);
                        const courseName = escapeHtml(course ? course.name : 'כללי');
                        const courseColor = course ? course.color : '#c8b9aa';

                        const group = document.createElement('div');
                        group.className = 'course-day-group';

                        group.innerHTML = `
                            <div class="course-day-group-header flex items-center justify-between">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color:${courseColor}"></span>
                                    <span class="font-bold text-sm truncate">${courseName}</span>
                                </div>
                                <span class="text-[10px] text-[var(--secondary-text)]">${groupItems.filter(t => !t.completed).length} פתוחות</span>
                            </div>
                            <div class="course-day-group-body space-y-2"></div>
                        `;

                        const body = group.querySelector('.course-day-group-body');
                        groupItems.forEach(task => {
                            body.insertAdjacentHTML('beforeend', buildItemHtml(task));
                        });
                        container.appendChild(group);
                    });
                }

                container.insertAdjacentHTML('beforeend', `
                    <button onclick="openAddModal('task', null, '${dateStr}')" class="w-full mt-2 py-2 border border-dashed border-[var(--border-color)] text-[var(--secondary-text)] rounded-xl hover:bg-gray-50 text-sm transition">
                        <i class="fas fa-plus"></i> הוסף משימה
                    </button>
                `);
            }

            const nearestExamSection = document.getElementById('nearest-exam-section');
            const nearestExamCard = document.getElementById('nearest-exam-card');
            const nearestExam = getNearestFutureExam();

            if(nearestExam && getDaysDiff(nearestExam.date) <= 7) {
                nearestExamSection.classList.remove('hidden');
                const course = getCourseInfo(nearestExam.courseId);
                const courseColor = course ? course.color : '#c8b9aa';
                const strongColor = strengthenColor(courseColor, nearestExam.examType === 'final' ? 0.33 : 0.20);
                const days = getDaysDiff(nearestExam.date);
                const when = days === 0 ? 'היום' : days === 1 ? 'מחר' : `בעוד ${days} ימים`;

                nearestExamCard.innerHTML = `
                    <div class="exam-nearest-panel p-5 cursor-pointer hover:shadow-md transition"
                         style="border-color:${strongColor}"
                         onclick="openExamModal('${nearestExam.id}')">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="exam-icon-badge" style="background-color:${courseColor}33; color:${strongColor}">
                                    <i class="fas ${nearestExam.examType === 'final' ? 'fa-award' : 'fa-clipboard-list'}"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="text-xs font-bold truncate" style="color:${strongColor}">${escapeHtml(course ? course.name : 'כללי')}</div>
                                    <div class="font-bold text-lg">${escapeHtml(getExamLabel(nearestExam))}</div>
                                    <div class="text-sm text-[var(--secondary-text)]">${formatShortDate(nearestExam.date)}</div>
                                </div>
                            </div>
                            <div class="text-left flex-shrink-0">
                                <div class="font-bold text-lg" style="color:${strongColor}">${when}</div>
                            </div>
                        </div>
                    </div>`;
            } else {
                nearestExamSection.classList.add('hidden');
                nearestExamCard.innerHTML = '';
            }

            const assignmentsList = document.getElementById('upcoming-assignments-list');
            assignmentsList.innerHTML = '';

            let allAssignments = items.filter(i => i.itemType === 'assignment');

            allAssignments.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return dateFromInput(a.date) - dateFromInput(b.date);
            });

            if(allAssignments.length === 0) {
                assignmentsList.innerHTML = `<div class="text-sm text-[var(--secondary-text)] col-span-full">אין עבודות להגשה כרגע.</div>`;
            }

            allAssignments.forEach(ass => {
                assignmentsList.insertAdjacentHTML('beforeend', buildItemHtml(ass));
            });
        }

        function renderCalendar() {
            const grid = document.getElementById('calendar-grid');
            grid.innerHTML = '';
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
            document.getElementById('month-title').innerText = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startingDay = firstDay.getDay();

            for (let i = 0; i < startingDay; i++) {
                grid.appendChild(Object.assign(document.createElement('div'), {className: 'min-h-[80px] p-1 border border-transparent'}));
            }

            const today = formatLocalDate(new Date());

            for (let i = 1; i <= lastDay.getDate(); i++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const isToday = dateStr === today;
                
                const cell = document.createElement('div');
                cell.className = `min-h-[80px] md:min-h-[100px] p-1 border border-[var(--border-color)] rounded-lg bg-white relative cursor-pointer hover:shadow-sm transition flex flex-col ${isToday ? 'bg-orange-50 border-[var(--accent-color)]' : ''}`;
                cell.onclick = (e) => {
                    if(e.target.closest('.check-circle') || e.target.closest('.group')) return;
                    openAddModal('task', null, dateStr);
                };

                const dayNum = document.createElement('div');
                dayNum.className = `text-xs font-bold mb-1 ${isToday ? 'text-[var(--primary-text)]' : 'text-[var(--secondary-text)]'}`;
                dayNum.innerText = i;
                cell.appendChild(dayNum);

                const itemsContainer = document.createElement('div');
                itemsContainer.className = 'flex-1 overflow-y-auto hide-scroll flex flex-col';
                
                const dayItems = items.filter(t => t.date === dateStr)
                    .sort((a,b) => {
                        const rank = { exam: 0, assignment: 1, task: 2 };
                        if((rank[a.itemType] ?? 9) !== (rank[b.itemType] ?? 9)) return (rank[a.itemType] ?? 9) - (rank[b.itemType] ?? 9);
                        if(a.completed !== b.completed) return a.completed ? 1 : -1;
                        return 0;
                    });

                const dayExams = dayItems.filter(i => i.itemType === 'exam');
                if(dayExams.length) {
                    const firstExamCourse = getCourseInfo(dayExams[0].courseId);
                    const examColor = strengthenColor(firstExamCourse ? firstExamCourse.color : '#c8b9aa', 0.28);
                    cell.style.boxShadow = `inset 0 3px 0 ${examColor}`;
                }

                dayItems.forEach(item => {
                    itemsContainer.insertAdjacentHTML('beforeend', buildItemHtml(item, 'small'));
                });

                cell.appendChild(itemsContainer);
                grid.appendChild(cell);
            }
        }
        function changeMonth(delta) { currentDate.setMonth(currentDate.getMonth() + delta); renderCalendar(); }

        function renderWeekly() {
            const grid = document.getElementById('weekly-grid');
            grid.innerHTML = '';
            
            const startOfWeek = new Date(selectedWeekDate);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            
            document.getElementById('week-title').innerText = `${startOfWeek.getDate()}/${startOfWeek.getMonth()+1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth()+1}`;
            const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
            const todayStr = formatLocalDate(new Date());

            for (let i = 0; i < 7; i++) {
                const curDay = new Date(startOfWeek);
                curDay.setDate(startOfWeek.getDate() + i);
                const dateStr = formatLocalDate(curDay);
                const isToday = dateStr === todayStr;
                
                const dayCol = document.createElement('div');
                dayCol.className = `glass-panel flex flex-col h-[60vh] border ${isToday ? 'border-[var(--accent-color)] ring-1 ring-[var(--accent-color)]' : 'border-[var(--border-color)]'}`;

                dayCol.innerHTML = `
                    <div class="p-3 text-center border-b border-[var(--border-color)] ${isToday ? 'bg-[var(--accent-color)] text-white rounded-t-[1.25rem]' : 'bg-gray-50 rounded-t-[1.25rem]'}">
                        <div class="font-bold text-sm">${dayNames[i]}</div>
                        <div class="text-xs opacity-80">${curDay.getDate()}/${curDay.getMonth()+1}</div>
                    </div>
                    <div class="flex-1 p-2 overflow-y-auto hide-scroll space-y-2 relative" id="week-tasks-${i}"></div>
                `;
                grid.appendChild(dayCol);

                const container = dayCol.querySelector(`#week-tasks-${i}`);
                
                // Add Quick add
                container.insertAdjacentHTML('beforeend', `
                    <button onclick="openAddModal('task', null, '${dateStr}')" class="w-full py-1.5 border border-dashed border-[var(--border-color)] text-[var(--secondary-text)] rounded text-xs hover:bg-gray-50 mb-2 transition">
                        <i class="fas fa-plus"></i> משימה
                    </button>
                `);

                const dayItems = items.filter(t => t.date === dateStr)
                    .sort((a,b) => {
                        const rank = { exam: 0, assignment: 1, task: 2 };
                        if((rank[a.itemType] ?? 9) !== (rank[b.itemType] ?? 9)) return (rank[a.itemType] ?? 9) - (rank[b.itemType] ?? 9);
                        if(a.completed !== b.completed) return a.completed ? 1 : -1;
                        return 0;
                    });
                dayItems.forEach(item => {
                    container.insertAdjacentHTML('beforeend', buildItemHtml(item, 'small'));
                });
            }
        }
        function changeWeek(delta) { selectedWeekDate.setDate(selectedWeekDate.getDate() + (delta * 7)); renderWeekly(); }


        let editingCourseId = null;

        function renderCourseColorOptions(selectedColor = null) {
            const container = document.getElementById('course-color-options');
            container.innerHTML = '';
            const activeColor = selectedColor || pickSmartCourseColor();
            document.getElementById('course-color-input').value = activeColor;

            PASTEL_COLORS.forEach(color => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `w-9 h-9 rounded-full border-2 transition hover:scale-110 ${color === activeColor ? 'border-[var(--primary-text)] ring-2 ring-offset-2 ring-[var(--border-color)]' : 'border-white'}`;
                btn.style.backgroundColor = color;
                btn.title = 'בחר צבע';
                btn.onclick = () => renderCourseColorOptions(color);
                container.appendChild(btn);
            });
        }

        function openCourseModal(courseId = null) {
            editingCourseId = courseId;
            const course = courseId ? getCourseInfo(courseId) : null;

            document.getElementById('course-form').reset();
            document.getElementById('course-edit-id').value = courseId || '';
            document.getElementById('course-modal-title').innerText = course ? 'עריכת קורס' : 'קורס חדש';
            document.getElementById('course-name-input').value = course ? course.name : '';

            const deleteBtn = document.getElementById('course-modal-delete-btn');
            const warning = document.getElementById('course-delete-warning');
            if(course) {
                deleteBtn.classList.remove('hidden');
                warning.classList.remove('hidden');
            } else {
                deleteBtn.classList.add('hidden');
                warning.classList.add('hidden');
            }

            renderCourseColorOptions(course ? course.color : null);
            document.getElementById('course-modal').classList.add('active');
            setTimeout(() => document.getElementById('course-name-input').focus(), 0);
        }

        function closeCourseModal() {
            document.getElementById('course-modal').classList.remove('active');
            editingCourseId = null;
        }

        document.getElementById('course-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('course-name-input').value.trim();
            const color = document.getElementById('course-color-input').value;

            if(!name) return;

            if(editingCourseId) {
                const index = courses.findIndex(c => c.id === editingCourseId);
                if(index !== -1) {
                    courses[index] = { ...courses[index], name, color };
                }
            } else {
                courses.push({
                    id: Date.now().toString(),
                    name,
                    color: color || pickSmartCourseColor()
                });
            }

            saveData();
            closeCourseModal();
            renderCoursesList();
            updateModalCourseSelect();
            updateExamCourseSelect();
            updatePomoCourseSelect();
            renderThreeDays();
            renderCalendar();
            renderWeekly();

            if(currentDashboardCourseId) renderCourseDashboard(currentDashboardCourseId);
        });

        function deleteCourse(courseId) {
            const course = getCourseInfo(courseId);
            if(!course) return;

            const linkedCount = items.filter(i => i.courseId === courseId).length;
            const message = linkedCount > 0
                ? `למחוק את הקורס "${course.name}"? ${linkedCount} פריטים ישויכו ל"ללא קורס".`
                : `למחוק את הקורס "${course.name}"?`;

            if(!confirm(message)) return;

            courses = courses.filter(c => c.id !== courseId);
            items = items.map(item => item.courseId === courseId ? { ...item, courseId: '' } : item);

            saveData();

            if(currentDashboardCourseId === courseId) {
                closeCourseDashboard();
            }

            closeCourseModal();
            renderCoursesList();
            updateModalCourseSelect();
            updateExamCourseSelect();
            updatePomoCourseSelect();
            renderThreeDays();
            renderCalendar();
            renderWeekly();
        }

        function deleteCourseFromModal() {
            if(editingCourseId) deleteCourse(editingCourseId);
        }

        function renderCoursesList() {
            const list = document.getElementById('courses-list');
            list.innerHTML = '';
            
            if(courses.length === 0) {
                list.innerHTML = '<div class="col-span-full text-center text-[var(--secondary-text)] py-8">אין קורסים עדיין. הוסף קורס למעלה.</div>';
                return;
            }

            courses.forEach(course => {
                const cItems = items.filter(t => t.courseId === course.id);
                const openTasks = cItems.filter(t => t.itemType === 'task' && !t.completed).length;
                const openAssignments = cItems.filter(t => t.itemType === 'assignment' && !t.completed).length;

                const card = document.createElement('div');
                card.className = 'glass-panel p-5 cursor-pointer hover:-translate-y-1 transition duration-200 relative overflow-hidden group';
                card.onclick = () => openCourseDashboard(course.id);
                
                card.innerHTML = `
                    <div class="absolute top-0 right-0 w-2 h-full" style="background-color: ${course.color}"></div>
                    <div class="flex justify-between items-start gap-3 pr-2">
                        <div class="min-w-0 flex-1">
                            <h3 class="font-bold text-xl mb-3 text-[var(--primary-text)] truncate">${escapeHtml(course.name)}</h3>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--secondary-text)]">
                                <div><span class="font-bold text-[var(--primary-text)]">${openTasks}</span> משימות</div>
                                <div><span class="font-bold text-[var(--primary-text)]">${openAssignments}</span> עבודות</div>
                                ${(() => {
                                    const nextExam = getNearestFutureExam(course.id);
                                    if(!nextExam) return '';
                                    const d = getDaysDiff(nextExam.date);
                                    return `<div class="font-semibold" style="color:${strengthenColor(course.color, 0.25)}"><i class="fas fa-clipboard-check ml-1"></i>מבחן ${d === 0 ? 'היום' : d === 1 ? 'מחר' : `בעוד ${d} ימים`}</div>`;
                                })()}
                            </div>
                        </div>
                        <div class="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                            <button type="button" onclick="event.stopPropagation(); openCourseModal('${course.id}')" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-[var(--secondary-text)]" title="ערוך קורס">
                                <i class="fas fa-pen text-xs"></i>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); deleteCourse('${course.id}')" class="w-8 h-8 rounded-lg hover:bg-red-50 text-red-400" title="מחק קורס">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
                list.appendChild(card);
            });
        }

        function openCourseDashboard(courseId) {
            currentDashboardCourseId = courseId;
            document.getElementById('courses-main-page').classList.add('hidden');
            document.getElementById('course-dashboard').classList.remove('hidden');
            renderCourseDashboard(courseId);
        }

        function closeCourseDashboard() {
            currentDashboardCourseId = null;
            document.getElementById('course-dashboard').classList.add('hidden');
            document.getElementById('courses-main-page').classList.remove('hidden');
        }

        function renderCourseDashboard(courseId) {
            const course = getCourseInfo(courseId);
            if(!course) return closeCourseDashboard();

            document.getElementById('dashboard-course-title').innerText = course.name;
            document.getElementById('course-dashboard-header').style.borderColor = course.color;
            document.getElementById('dashboard-edit-course-btn').onclick = () => openCourseModal(course.id);
            document.getElementById('dashboard-delete-course-btn').onclick = () => deleteCourse(course.id);

            const cItems = items.filter(t => t.courseId === courseId);
            const tasks = cItems.filter(t => t.itemType === 'task');
            const assignments = cItems.filter(t => t.itemType === 'assignment');
            const exams = cItems.filter(t => t.itemType === 'exam');
            const nextExam = getNearestFutureExam(courseId);

            document.getElementById('dashboard-course-stats').innerHTML = `
                <span>${tasks.filter(t=>!t.completed).length} משימות פתוחות</span>
                <span>${assignments.filter(t=>!t.completed).length} עבודות להגשה</span>
                ${nextExam ? `<span><i class="fas fa-clipboard-check ml-1"></i>המבחן הבא ${getDaysDiff(nextExam.date) === 0 ? 'היום' : getDaysDiff(nextExam.date) === 1 ? 'מחר' : `בעוד ${getDaysDiff(nextExam.date)} ימים`}</span>` : ''}
            `;

            // Render Tasks
            const tasksDiv = document.getElementById('dashboard-tasks');
            tasksDiv.innerHTML = '';
            tasks.sort((a,b) => (a.completed === b.completed)? 0 : a.completed ? 1 : -1).forEach(task => {
                tasksDiv.insertAdjacentHTML('beforeend', buildItemHtml(task));
            });
            if(tasks.length===0) tasksDiv.innerHTML = '<div class="text-sm text-gray-400">אין משימות לקורס זה</div>';

            // Render Assignments
            const assDiv = document.getElementById('dashboard-assignments');
            assDiv.innerHTML = '';
            assignments.sort((a,b) => dateFromInput(a.date) - dateFromInput(b.date)).forEach(ass => {
                assDiv.insertAdjacentHTML('beforeend', buildItemHtml(ass));
            });
            if(assignments.length===0) assDiv.innerHTML = '<div class="text-sm text-gray-400">אין עבודות לקורס זה</div>';

            const examsDiv = document.getElementById('dashboard-exams');
            const noExams = document.getElementById('dashboard-no-exams');
            examsDiv.innerHTML = '';

            if(exams.length === 0) {
                noExams.classList.remove('hidden');
            } else {
                noExams.classList.add('hidden');
                exams
                    .sort((a,b) => dateFromInput(a.date) - dateFromInput(b.date))
                    .forEach(exam => examsDiv.insertAdjacentHTML('beforeend', buildItemHtml(exam)));
            }
        }

        let editingExamId = null;

        function updateExamCourseSelect() {
            const select = document.getElementById('exam-course');
            const current = select.value;
            select.innerHTML = '<option value="">בחר קורס</option>';
            courses.forEach(course => {
                select.innerHTML += `<option value="${course.id}">${escapeHtml(course.name)}</option>`;
            });
            if(current) select.value = current;
        }

        function openExamModal(examId = null, courseId = null) {
            editingExamId = examId;
            updateExamCourseSelect();
            document.getElementById('exam-form').reset();
            document.getElementById('exam-edit-id').value = examId || '';
            document.getElementById('exam-delete-btn').classList.toggle('hidden', !examId);
            document.getElementById('exam-modal-title').innerText = examId ? 'עריכת מבחן' : 'מבחן חדש';

            if(examId) {
                const exam = items.find(i => i.id === examId && i.itemType === 'exam');
                if(!exam) return;
                document.getElementById('exam-course').value = exam.courseId || '';
                document.getElementById('exam-date').value = exam.date;
                const typeRadio = document.querySelector(`input[name="exam-type"][value="${exam.examType || 'midterm'}"]`);
                const sessionRadio = document.querySelector(`input[name="exam-session"][value="${exam.examSession || 'A'}"]`);
                if(typeRadio) typeRadio.checked = true;
                if(sessionRadio) sessionRadio.checked = true;
            } else {
                if(courseId) document.getElementById('exam-course').value = courseId;
                document.getElementById('exam-date').value = formatLocalDate(new Date());
            }

            document.getElementById('exam-modal').classList.add('active');
        }

        function closeExamModal() {
            document.getElementById('exam-modal').classList.remove('active');
            editingExamId = null;
        }

        document.getElementById('exam-form').addEventListener('submit', (e) => {
            e.preventDefault();

            const courseId = document.getElementById('exam-course').value;
            if(!courseId) return;

            const examType = document.querySelector('input[name="exam-type"]:checked')?.value || 'midterm';
            const examSession = document.querySelector('input[name="exam-session"]:checked')?.value || 'A';
            const date = document.getElementById('exam-date').value;

            const examData = {
                id: editingExamId || Date.now().toString(),
                courseId,
                date,
                itemType: 'exam',
                examType,
                examSession,
                completed: false,
                notes: '',
                createdAt: editingExamId
                    ? (items.find(i => i.id === editingExamId)?.createdAt || Date.now())
                    : Date.now()
            };

            if(editingExamId) {
                const index = items.findIndex(i => i.id === editingExamId);
                if(index !== -1) items[index] = examData;
            } else {
                items.push(examData);
            }

            saveData();
            closeExamModal();
            renderThreeDays();
            renderCalendar();
            renderWeekly();
            renderCoursesList();
            if(currentDashboardCourseId) renderCourseDashboard(currentDashboardCourseId);
        });

        function deleteCurrentExam() {
            if(!editingExamId) return;
            if(!confirm('למחוק את המבחן?')) return;

            items = items.filter(i => i.id !== editingExamId);
            saveData();
            closeExamModal();
            renderThreeDays();
            renderCalendar();
            renderWeekly();
            renderCoursesList();
            if(currentDashboardCourseId) renderCourseDashboard(currentDashboardCourseId);
        }

        let pomoInterval;
        let pomoTimeLeft = 25 * 60;
        let pomoTotalTime = 25 * 60;
        let pomoState = 'stopped'; // stopped, running, paused
        let pomoMode = 'work'; // work, shortBreak, longBreak
        let pomoCourseId = '';

        function updatePomoCourseSelect() {
            const sel = document.getElementById('pomo-course-select');
            sel.innerHTML = '<option value="">בחר קורס ללמידה (אופציונלי)</option>';
            courses.forEach(c => {
                sel.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
            });
        }

        function updatePomoTasks() {
            pomoCourseId = document.getElementById('pomo-course-select').value;
            const taskSel = document.getElementById('pomo-task-select');
            
            if(!pomoCourseId) {
                taskSel.classList.add('hidden');
                taskSel.value = '';
                return;
            }
            
            taskSel.classList.remove('hidden');
            taskSel.innerHTML = '<option value="">ללא משימה ספציפית</option>';
            const courseTasks = items.filter(t => t.courseId === pomoCourseId && t.itemType === 'task' && !t.completed);
            courseTasks.forEach(t => {
                taskSel.innerHTML += `<option value="${t.id}">${escapeHtml(t.title)}</option>`;
            });
        }

        function setPomoMode(mode, min = null) {
            pomoMode = mode;
            if (min) pomoTotalTime = min * 60;
            else if(mode === 'work') pomoTotalTime = 25 * 60;
            else if(mode === 'shortBreak') pomoTotalTime = 5 * 60;
            else if(mode === 'longBreak') pomoTotalTime = 15 * 60;
            
            resetPomodoro(true);
            
            let statusText = 'מוכן ללמוד?';
            if(mode==='shortBreak') statusText = 'זמן לנוח קצת';
            if(mode==='longBreak') statusText = 'הפסקה ארוכה';
            document.getElementById('pomodoro-status-text').innerText = statusText;
            
            document.getElementById('pomo-finished-dialog').classList.add('hidden');
            
            // Visual active button
            document.querySelectorAll('.pomo-mode-btn').forEach(b => {
                b.classList.remove('bg-[var(--primary-text)]', 'text-white');
                b.classList.add('bg-white', 'text-black');
            });
            if(event && event.target.classList.contains('pomo-mode-btn')) {
                event.target.classList.add('bg-[var(--primary-text)]', 'text-white');
                event.target.classList.remove('bg-white', 'text-black');
            }
        }

        function setCustomPomo() {
            const val = document.getElementById('pomo-custom-min').value;
            if(val && val > 0) {
                setPomoMode('work', parseInt(val));
                document.getElementById('pomodoro-status-text').innerText = `מותאם אישית: ${val} דק'`;
            }
        }

        function updatePomoDisplay() {
            const m = Math.floor(pomoTimeLeft / 60);
            const s = pomoTimeLeft % 60;
            document.getElementById('pomodoro-timer').innerText = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        }

        function togglePomodoro() {
            const btn = document.getElementById('pomodoro-toggle-btn');
            
            if (pomoState === 'running') {
                // Pause
                clearInterval(pomoInterval);
                pomoState = 'paused';
                btn.innerHTML = '<i class="fas fa-play"></i>';
                document.getElementById('timer-circle-element').classList.remove('running');
            } else {
                // Start or Resume
                pomoState = 'running';
                btn.innerHTML = '<i class="fas fa-pause"></i>';
                document.getElementById('timer-circle-element').classList.add('running');
                
                // Hide setup, show running info
                if (pomoTimeLeft === pomoTotalTime && pomoMode === 'work') {
                    document.getElementById('pomo-selectors').classList.add('hidden');
                    document.getElementById('pomo-time-options').classList.add('hidden');
                    document.getElementById('pomodoro-stop-btn').classList.remove('hidden');
                    
                    const runningCourse = document.getElementById('pomo-running-course');
                    const runningTask = document.getElementById('pomo-running-task');
                    document.getElementById('pomo-running-info').classList.remove('hidden');
                    
                    if(pomoCourseId) runningCourse.innerText = getCourseInfo(pomoCourseId).name;
                    else runningCourse.innerText = 'למידה כללית';
                    
                    const taskId = document.getElementById('pomo-task-select').value;
                    if(taskId) runningTask.innerText = items.find(i=>i.id===taskId).title;
                    else runningTask.innerText = '';
                }

                pomoInterval = setInterval(() => {
                    pomoTimeLeft--;
                    updatePomoDisplay();
                    if (pomoTimeLeft <= 0) finishPomodoro();
                }, 1000);
            }
        }

        function stopPomodoro() {
            // Premature stop
            clearInterval(pomoInterval);
            resetPomodoro(true);
        }

        function finishPomodoro() {
            clearInterval(pomoInterval);
            pomoState = 'stopped';
            document.getElementById('timer-circle-element').classList.remove('running');
            
            // Save tracking if it was work
            if (pomoMode === 'work') {
                pomoHistory.push({
                    date: formatLocalDate(new Date()),
                    courseId: pomoCourseId,
                    minutes: Math.round(pomoTotalTime / 60)
                });
                saveData();
                updatePomoStats();
            }
            
            // UI Update for finish
            document.getElementById('pomodoro-toggle-btn').innerHTML = '<i class="fas fa-play"></i>';
            document.getElementById('pomo-running-info').classList.add('hidden');
            document.getElementById('pomodoro-stop-btn').classList.add('hidden');
            
            // Show finish dialog, hide timer briefly or just show dialog below
            document.getElementById('pomo-finished-dialog').classList.remove('hidden');
            document.getElementById('pomo-selectors').classList.remove('hidden');
            document.getElementById('pomo-time-options').classList.remove('hidden');
        }

        function resetPomodoro(fullReset = false) {
            clearInterval(pomoInterval);
            pomoState = 'stopped';
            pomoTimeLeft = pomoTotalTime;
            updatePomoDisplay();
            
            const btn = document.getElementById('pomodoro-toggle-btn');
            btn.innerHTML = '<i class="fas fa-play"></i>';
            document.getElementById('timer-circle-element').classList.remove('running');
            
            if(fullReset) {
                document.getElementById('pomo-running-info').classList.add('hidden');
                document.getElementById('pomodoro-stop-btn').classList.add('hidden');
                document.getElementById('pomo-selectors').classList.remove('hidden');
                document.getElementById('pomo-time-options').classList.remove('hidden');
            }
        }

        function updatePomoStats() {
            const today = formatLocalDate(new Date());
            
            // Calculate week dates
            const curr = new Date();
            const first = curr.getDate() - curr.getDay();
            const startWeek = formatLocalDate(new Date(curr.setDate(first)));
            
            let todayMin = 0;
            let todayCount = 0;
            let weekMin = 0;
            let courseStats = {}; // {courseId: mins}

            pomoHistory.forEach(s => {
                if(s.date === today) {
                    todayMin += s.minutes;
                    todayCount++;
                }
                if(s.date >= startWeek) {
                    weekMin += s.minutes;
                    const cId = s.courseId || 'general';
                    courseStats[cId] = (courseStats[cId] || 0) + s.minutes;
                }
            });

            document.getElementById('stat-today-time').innerText = formatMins(todayMin);
            document.getElementById('stat-today-sessions').innerText = todayCount;
            document.getElementById('stat-week-time').innerText = formatMins(weekMin);

            const breakdown = document.getElementById('stat-course-breakdown');
            breakdown.innerHTML = '';
            for (const [cId, mins] of Object.entries(courseStats)) {
                let cName = 'כללי', cColor = '#e0e0e0';
                if(cId !== 'general') {
                    const c = getCourseInfo(cId);
                    if(c) { cName = c.name; cColor = c.color; }
                }
                breakdown.innerHTML += `
                    <div class="flex justify-between items-center bg-white p-2 rounded border border-[var(--border-color)]">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full" style="background-color:${cColor}"></span>
                            <span class="font-medium">${cName}</span>
                        </div>
                        <span class="font-bold">${formatMins(mins)}</span>
                    </div>
                `;
            }
        }
        function formatMins(totalMins) {
            if(totalMins < 60) return `${totalMins} דק'`;
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return m > 0 ? `${h} ש' ו-${m} דק'` : `${h} שעות`;
        }


        function updateModalCourseSelect() {
            const select = document.getElementById('item-course');
            const currentVal = select.value;
            select.innerHTML = '<option value="">ללא שיוך לקורס</option>';
            courses.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
            });
            if(currentVal) select.value = currentVal;
        }

        function setModalTab(type) {
            document.getElementById('item-type').value = type;
            const tBtn = document.getElementById('tab-task');
            const aBtn = document.getElementById('tab-assignment');
            
            if(type === 'task') {
                tBtn.classList.replace('border-transparent', 'border-[var(--primary-text)]');
                tBtn.classList.replace('text-[var(--secondary-text)]', 'text-[var(--primary-text)]');
                aBtn.classList.replace('border-[var(--primary-text)]', 'border-transparent');
                aBtn.classList.replace('text-[var(--primary-text)]', 'text-[var(--secondary-text)]');
                
                document.getElementById('label-title').innerText = 'שם המשימה';
                document.getElementById('label-date').innerText = 'Deadline (עד תאריך)';
            } else {
                aBtn.classList.replace('border-transparent', 'border-[var(--primary-text)]');
                aBtn.classList.replace('text-[var(--secondary-text)]', 'text-[var(--primary-text)]');
                tBtn.classList.replace('border-[var(--primary-text)]', 'border-transparent');
                tBtn.classList.replace('text-[var(--primary-text)]', 'text-[var(--secondary-text)]');
                
                document.getElementById('label-title').innerText = 'שם העבודה';
                document.getElementById('label-date').innerText = 'תאריך הגשה';
            }
        }

        function openAddModal(forceType = 'task', courseId = null, dateStr = null) {
            updateModalCourseSelect();
            document.getElementById('item-form').reset();
            document.getElementById('item-id').value = '';
            document.getElementById('btn-delete-item').classList.add('hidden');
            
            setModalTab(forceType);
            
            if (dateStr) document.getElementById('item-date').value = dateStr;
            else document.getElementById('item-date').value = formatLocalDate(new Date());
            
            if (courseId) document.getElementById('item-course').value = courseId;

            document.getElementById('item-modal').classList.add('active');
            editingItemId = null;
        }

        function openEditModal(itemId) {
            const item = items.find(t => t.id === itemId);
            if (!item) return;

            editingItemId = itemId;
            updateModalCourseSelect();
            setModalTab(item.itemType);
            
            document.getElementById('item-id').value = item.id;
            document.getElementById('item-title').value = item.title;
            document.getElementById('item-course').value = item.courseId || '';
            document.getElementById('item-date').value = item.date;
            document.getElementById('item-notes').value = item.notes || '';
            
            document.getElementById('btn-delete-item').classList.remove('hidden');
            document.getElementById('item-modal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('item-modal').classList.remove('active');
        }

        document.getElementById('item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const data = {
                id: document.getElementById('item-id').value || Date.now().toString(),
                title: document.getElementById('item-title').value,
                courseId: document.getElementById('item-course').value,
                date: document.getElementById('item-date').value,
                notes: document.getElementById('item-notes').value,
                itemType: document.getElementById('item-type').value,
                completed: false, // reset if edited, or keep? Let's keep if editing.
                createdAt: editingItemId ? (items.find(i => i.id === editingItemId)?.createdAt || Date.now()) : Date.now()
            };

            if (editingItemId) {
                const index = items.findIndex(t => t.id === editingItemId);
                if (index !== -1) {
                    data.completed = items[index].completed; // keep old completion state
                    items[index] = data;
                }
            } else {
                items.push(data);
            }

            saveData();
            closeModal();
            refreshCurrentView();
            
            // if viewing courses list, refresh it to update counts
            if(!document.getElementById('view-courses').classList.contains('hidden') && document.getElementById('course-dashboard').classList.contains('hidden')) {
                renderCoursesList();
            }
        });

        function deleteCurrentItem() {
            if (editingItemId && confirm('למחוק פריט זה?')) {
                items = items.filter(t => t.id !== editingItemId);
                saveData();
                closeModal();
                refreshCurrentView();
                if(!document.getElementById('view-courses').classList.contains('hidden') && document.getElementById('course-dashboard').classList.contains('hidden')) {
                    renderCoursesList();
                }
            }
        }

        window.onload = () => {
            migrateOldData();
            switchView('threedays');

            document.addEventListener('keydown', (e) => {
                if(e.key === 'Escape') {
                    closeModal();
                    closeCourseModal();
                    closeExamModal();
                }
            });
            
            // Close modal on outside click
            window.onclick = function(event) {
                const itemModal = document.getElementById('item-modal');
                const courseModal = document.getElementById('course-modal');
                const examModal = document.getElementById('exam-modal');
                if (event.target === itemModal) closeModal();
                if (event.target === courseModal) closeCourseModal();
                if (event.target === examModal) closeExamModal();
            }
        };
